import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PROGRAM_ID } from "./constants";

export function getRegistryPda(phoneHash: Uint8Array): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("registry"), Buffer.from(phoneHash)],
    PROGRAM_ID
  );
}

export function getEscrowPda(
  sender: PublicKey,
  phoneHash: Uint8Array
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), sender.toBuffer(), Buffer.from(phoneHash)],
    PROGRAM_ID
  );
}

export function getEscrowTokenStatePda(
  sender: PublicKey,
  phoneHash: Uint8Array,
  mint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("escrow_token"), sender.toBuffer(), Buffer.from(phoneHash), mint.toBuffer()],
    PROGRAM_ID
  );
}

export function getAta(owner: PublicKey, mint: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, owner, true);
}
