import { Keypair } from "@solana/web3.js";

export function generateClaimKeypair(): Keypair {
  return Keypair.generate();
}

export function downloadSecretKey(keypair: Keypair, fileName = "solpay-keypair.json") {
  const payload = JSON.stringify(Array.from(keypair.secretKey));
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(url);
}
