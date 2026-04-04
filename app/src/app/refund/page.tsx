"use client";

import { useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { CountryCode } from "libphonenumber-js";
import * as anchor from "@coral-xyz/anchor";

import { hashPhone } from "@/lib/hash";
import { getEscrowPda } from "@/lib/program";
import { getCountryOptions, normalizeToE164 } from "@/lib/phone";

export default function RefundPage() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const [country, setCountry] = useState<CountryCode>("IN");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<
    "idle" | "checking" | "submitting" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [txSig, setTxSig] = useState("");
  const countryOptions = useMemo(() => getCountryOptions(), []);

  function formatError(err: any): string {
    const logs: string[] | undefined = err?.logs || err?.error?.logs;
    const raw = String(err?.message || err?.toString?.() || "Refund failed");

    if (
      raw.includes("NotExpiredYet") ||
      raw.includes("Escrow has not expired") ||
      logs?.some((l) => l.includes("NotExpiredYet"))
    ) {
      return "Refund is not available yet. Escrow can be refunded only after 72 hours.";
    }

    if (
      raw.includes("InvalidSender") ||
      logs?.some((l) => l.includes("InvalidSender"))
    ) {
      return "Connected wallet does not match the sender wallet for this escrow.";
    }

    if (raw.includes("User rejected") || raw.includes("rejected the request")) {
      return "Transaction was rejected in wallet.";
    }

    return raw;
  }

  async function handleRefund() {
    if (!publicKey) {
      setStatus("error");
      setMessage("Connect your wallet first");
      return;
    }

    let phoneE164: string;
    try {
      const e164 = normalizeToE164(phone, country);
      if (!e164) throw new Error("Invalid");
      phoneE164 = e164;
    } catch {
      setStatus("error");
      setMessage("Enter a valid phone number");
      return;
    }

    setStatus("checking");
    setMessage("");

    try {
      const phoneHash = await hashPhone(phoneE164);
      const phoneHashArray = Array.from(phoneHash);
      const [escrowPda] = getEscrowPda(publicKey, phoneHash);

      const escrowInfo = await connection.getAccountInfo(escrowPda);
      if (!escrowInfo) {
        setStatus("error");
        setMessage(
          "No active escrow found for this phone number from your wallet (already claimed/refunded, or never created)."
        );
        return;
      }

      const senderFromEscrow = new PublicKey(escrowInfo.data.slice(8, 40));
      if (!senderFromEscrow.equals(publicKey)) {
        setStatus("error");
        setMessage("This escrow belongs to a different sender wallet.");
        return;
      }

      // created_at layout: discriminator(8) + sender(32) + phone_hash(32) + amount(8) + created_at(8)
      const createdAt = Number(
        new DataView(
          escrowInfo.data.buffer,
          escrowInfo.data.byteOffset + 80,
          8
        ).getBigInt64(0, true)
      );
      const expiry = createdAt + 72 * 3600;
      const now = Math.floor(Date.now() / 1000);

      if (now < expiry) {
        const remaining = expiry - now;
        const hrs = Math.floor(remaining / 3600);
        const mins = Math.floor((remaining % 3600) / 60);
        setStatus("error");
        setMessage(
          `Refund not available yet. Try again in about ${hrs}h ${mins}m.`
        );
        return;
      }

      const idlResp = await fetch("/idl/solpay.json");
      const idl = await idlResp.json();

      const dummyWallet = {
        publicKey,
        signTransaction: async (tx: any) => tx,
        signAllTransactions: async (txs: any) => txs,
      };

      const provider = new anchor.AnchorProvider(
        connection,
        dummyWallet as any,
        { commitment: "confirmed" }
      );
      const program = new anchor.Program(idl, provider);

      const ix = await program.methods
        .refundEscrow()
        .accounts({
          escrow: escrowPda,
          sender: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      const tx = new Transaction().add(ix);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      setStatus("submitting");
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      setTxSig(sig);
      setStatus("success");
      setMessage("Refund completed. SOL returned to your wallet.");
    } catch (err: any) {
      setMessage(formatError(err));
      setStatus("error");
    }
  }

  return (
    <div className="space-y-4">
      <section className="upi-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2d5c3d]">
          Refund Center
        </p>
        <h2 className="mt-1 text-xl font-semibold text-[#0f2d1c]">Refund escrow</h2>
        <p className="mt-1 text-xs text-[#3f5f4a]">
          Enter recipient mobile used during send. Refund is available after 72 hours.
        </p>
      </section>

      <section className="upi-card space-y-3">
        <div className="flex justify-end">
          <WalletMultiButton />
        </div>

        <div>
          <label className="upi-label">Recipient Mobile</label>
          <div className="grid grid-cols-[1.35fr_2fr] gap-2">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value as CountryCode)}
              className="upi-input"
            >
              {countryOptions.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              type="tel"
              placeholder="98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="upi-input"
            />
          </div>
        </div>

        <button
          onClick={handleRefund}
          disabled={!publicKey || status === "checking" || status === "submitting"}
          className="upi-btn-warning"
        >
          {status === "checking"
            ? "Checking escrow..."
            : status === "submitting"
              ? "Submitting refund..."
              : "Start refund"}
        </button>
      </section>

      {message && (
        <div className={status === "error" ? "upi-status-error" : "upi-status-success"}>
          {message}
        </div>
      )}

      {txSig && (
        <a
          href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="upi-link-chip"
        >
          View transaction
        </a>
      )}
    </div>
  );
}
