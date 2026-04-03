import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Solpay } from "../target/types/solpay";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { createHash } from "crypto";
import { expect } from "chai";

describe("solpay", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.solpay as Program<Solpay>;
  const payer = provider.wallet as anchor.Wallet;

  // Generate a claim_authority keypair for testing
  // In real use, the program has a hardcoded CLAIM_AUTHORITY pubkey.
  // For local tests, the program's constant is 11111...1 which won't work.
  // We'll need to either:
  // 1. Update the program constant to match this keypair before deploying
  // 2. Or skip claim_authority checks in localnet tests
  //
  // For now, we test what we can without claim_authority.

  const testPhone = "+919876543210";
  const phoneHash = createHash("sha256").update(testPhone, "utf8").digest();
  const phoneHashArray = Array.from(phoneHash);

  function getRegistryPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("registry"), phoneHash],
      program.programId
    );
  }

  function getEscrowPda(sender: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), sender.toBuffer(), phoneHash],
      program.programId
    );
  }

  it("send_escrow — creates escrow for unregistered phone", async () => {
    const amount = 0.05 * LAMPORTS_PER_SOL;
    const [escrowPda] = getEscrowPda(payer.publicKey);

    const balanceBefore = await provider.connection.getBalance(payer.publicKey);

    const tx = await program.methods
      .sendEscrow(phoneHashArray, new anchor.BN(amount))
      .accounts({
        sender: payer.publicKey,
        escrow: escrowPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("send_escrow tx:", tx);

    // Verify escrow account
    const escrow = await program.account.escrowAccount.fetch(escrowPda);
    expect(escrow.sender.toString()).to.equal(payer.publicKey.toString());
    expect(escrow.amount.toNumber()).to.equal(amount);
    expect(Buffer.from(escrow.phoneHash as number[]).toString("hex")).to.equal(
      phoneHash.toString("hex")
    );

    // Verify escrow has SOL
    const escrowBalance = await provider.connection.getBalance(escrowPda);
    expect(escrowBalance).to.be.greaterThan(amount); // amount + rent
    console.log("Escrow balance:", escrowBalance / LAMPORTS_PER_SOL, "SOL");
  });

  it("send_escrow — rejects zero amount", async () => {
    const [escrowPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        payer.publicKey.toBuffer(),
        createHash("sha256").update("+910000000000", "utf8").digest(),
      ],
      program.programId
    );

    try {
      await program.methods
        .sendEscrow(
          Array.from(
            createHash("sha256").update("+910000000000", "utf8").digest()
          ),
          new anchor.BN(0)
        )
        .accounts({
          sender: payer.publicKey,
          escrow: escrowPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.toString()).to.include("ZeroAmount");
    }
  });

  it("refund_escrow — rejects before 72h", async () => {
    const [escrowPda] = getEscrowPda(payer.publicKey);

    try {
      await program.methods
        .refundEscrow()
        .accounts({
          escrow: escrowPda,
          sender: payer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.toString()).to.include("NotExpiredYet");
    }
  });

  // Note: register_phone, claim_escrow, and send_direct require claim_authority
  // signature. In production the CLAIM_AUTHORITY constant in lib.rs must be set
  // to the actual claim_authority pubkey. For local testing, you can temporarily
  // set it to the provider wallet's pubkey. These tests verify the core escrow
  // mechanics which don't need claim_authority.
});
