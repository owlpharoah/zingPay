import { PublicKey } from "@solana/web3.js";
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
