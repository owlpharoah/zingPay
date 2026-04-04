"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import "@fontsource/fraunces";
import "@fontsource/outfit";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { CountryCode } from "libphonenumber-js";
import * as anchor from "@coral-xyz/anchor";
import { hashPhone } from "@/lib/hash";
import { getEscrowPda } from "@/lib/program";
import { normalizeToE164 } from "@/lib/phone";
import AppNav from "@/components/AppNav";
import { WalletDropdown } from "@/components/WalletDropdown";

const countries = [
  { code: "+91", label: "IN +91", country: "IN" as CountryCode },
  { code: "+1", label: "US +1", country: "US" as CountryCode },
  { code: "+44", label: "UK +44", country: "GB" as CountryCode },
  { code: "+61", label: "AU +61", country: "AU" as CountryCode },
  { code: "+971", label: "AE +971", country: "AE" as CountryCode },
  { code: "+65", label: "SG +65", country: "SG" as CountryCode },
  { code: "+81", label: "JP +81", country: "JP" as CountryCode },
];

export default function RefundPage() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "checking" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [txSig, setTxSig] = useState("");

  function getCountryForDial(dial: string): CountryCode {
    return countries.find(c => c.code === dial)?.country || "IN";
  }

  function formatError(err: any): string {
    const logs: string[] | undefined = err?.logs || err?.error?.logs;
    const raw = String(err?.message || err?.toString?.() || "Refund failed");

    if (raw.includes("NotExpiredYet") || raw.includes("Escrow has not expired") || logs?.some((l: string) => l.includes("NotExpiredYet"))) {
      return "Refund is not available yet. Escrow can be refunded only after 72 hours.";
    }
    if (raw.includes("InvalidSender") || logs?.some((l: string) => l.includes("InvalidSender"))) {
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

    // Validate phone
    let phoneE164: string;
    try {
      const country = getCountryForDial(countryCode);
      const fullPhone = `${countryCode}${phone.replace(/\D/g, "")}`;
      const e164 = normalizeToE164(fullPhone, country);
      if (!e164) throw new Error("Invalid");
      phoneE164 = e164;
    } catch {
      setStatus("error");
      setMessage("Enter a valid phone number");
      return;
    }

    setStatus("checking");
    setMessage("");
    setTxSig("");

    try {
      const phoneHash = await hashPhone(phoneE164);
      const phoneHashArray = Array.from(phoneHash);
      const [escrowPda] = getEscrowPda(publicKey, phoneHash);

      const escrowInfo = await connection.getAccountInfo(escrowPda);
      if (!escrowInfo) {
        setStatus("error");
        setMessage("No active escrow found for this phone number from your wallet (already claimed/refunded, or never created).");
        return;
      }

      const senderFromEscrow = new PublicKey(escrowInfo.data.slice(8, 40));
      if (!senderFromEscrow.equals(publicKey)) {
        setStatus("error");
        setMessage("This escrow belongs to a different sender wallet.");
        return;
      }

      const createdAt = Number(
        new DataView(escrowInfo.data.buffer, escrowInfo.data.byteOffset + 80, 8).getBigInt64(0, true)
      );
      const expiry = createdAt + 72 * 3600;
      const now = Math.floor(Date.now() / 1000);

      if (now < expiry) {
        const remaining = expiry - now;
        const hrs = Math.floor(remaining / 3600);
        const mins = Math.floor((remaining % 3600) / 60);
        setStatus("error");
        setMessage(`Refund not available yet. Try again in about ${hrs}h ${mins}m.`);
        return;
      }

      const idlResp = await fetch("/idl/solpay.json");
      const idl = await idlResp.json();

      const dummyWallet = {
        publicKey,
        signTransaction: async (tx: any) => tx,
        signAllTransactions: async (txs: any) => txs,
      };

      const provider = new anchor.AnchorProvider(connection, dummyWallet as any, { commitment: "confirmed" });
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
    <div className="bg-[#F6F5F0] min-h-screen flex flex-col font-[outfit]">
      {/* Header */}
      <div className="bg-[#0B2818] flex items-center justify-around h-[131px] max-sm:h-[80px] p-4 max-sm:px-2 shrink-0">
        <Link href="/">
          <div className="flex items-center">
            <Image alt="back" src="/back.svg" width={12} height={23} className="inline-block mr-4 max-sm:mr-2 max-sm:w-2 max-sm:h-[14px]" />
            <p className="text-white font-[outfit] font-semibold text-xl max-sm:text-sm">Back</p>
          </div>
        </Link>
        <Image alt="zingpay" src="/zingpay.svg" width={172} height={57} className="w-[172px] h-auto max-sm:w-[110px]" />
        <WalletDropdown />
      </div>

      <AppNav />

      {/* Main Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 max-sm:px-4 py-12 max-sm:py-6">
        <h1 className="text-5xl max-sm:text-3xl text-[#0B2818] font-[fraunces] font-black mb-2 tracking-tight">
          Refund <span className="italic font-normal">Escrow.</span>
        </h1>
        <p className="text-[#6B7280] text-sm md:text-base max-sm:text-xs mb-8 max-sm:mb-6 font-medium">
          Enter recipient mobile used during send. Refund is available after 72 hours.
        </p>

        <div className="bg-[#F6F5F0] rounded-[2rem] max-sm:rounded-2xl border-2 border-[#0B2818] p-8 max-sm:p-5 shadow-sm relative z-20">
          {/* Overlay for dropdown */}
          {isCountryOpen && (
            <div className="fixed inset-0 z-40" onClick={() => setIsCountryOpen(false)} />
          )}

          {/* Phone Number Input */}
          <div className={`mb-8 max-sm:mb-5 relative ${isCountryOpen ? 'z-50' : 'z-20'}`}>
            <label className="block text-xs max-sm:text-[10px] font-bold text-[#4B5563] mb-3 max-sm:mb-2 tracking-wide">
              RECIPIENT PHONE NUMBER
            </label>
            <div className="flex bg-white border-2 border-[#0B2818] rounded-2xl max-sm:rounded-xl overflow-visible h-[60px] max-sm:h-[50px]">
              <div className="relative flex items-center border-r-2 border-[#0B2818] bg-white rounded-l-2xl max-sm:rounded-l-xl">
                <div
                  onClick={() => setIsCountryOpen(!isCountryOpen)}
                  className="flex items-center justify-between w-[110px] max-sm:w-[90px] h-full px-4 max-sm:px-3 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <span className="font-bold text-[#0B2818] text-base max-sm:text-sm font-[outfit]">
                    {countries.find(c => c.code === countryCode)?.label}
                  </span>
                  <svg className={`w-2.5 h-2.5 text-[#0B2818] transition-transform duration-200 ${isCountryOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 10 6" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                {isCountryOpen && (
                  <div className="absolute top-[calc(100%+8px)] left-0 w-[140px] bg-white border-2 border-[#0B2818] rounded-xl shadow-lg overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150 z-50">
                    {countries.map((c) => (
                      <div
                        key={c.code}
                        onClick={() => { setCountryCode(c.code); setIsCountryOpen(false); }}
                        className={`px-4 py-3 max-sm:py-2.5 text-sm max-sm:text-xs font-bold font-[outfit] cursor-pointer transition-colors border-b last:border-b-0 border-[#0B2818]/10 ${countryCode === c.code ? 'bg-[#B8FF4F] text-[#0B2818]' : 'text-[#0B2818] hover:bg-[#B8FF4F]/50'}`}
                      >
                        {c.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter phone number"
                className="flex-1 px-4 max-sm:px-3 w-full text-base max-sm:text-sm font-medium font-[outfit] text-[#0B2818] focus:outline-none placeholder:text-gray-400 placeholder:font-normal bg-transparent rounded-r-2xl max-sm:rounded-r-xl"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleRefund}
            disabled={!publicKey || status === "checking" || status === "submitting"}
            className="w-full bg-[#EF4444] hover:bg-[#DC2626] text-white text-lg max-sm:text-base font-bold py-4 max-sm:py-3.5 rounded-2xl border-2 border-[#991B1B] shadow-[0_4px_0_0_#991B1B] active:shadow-none active:translate-y-1 transition-all duration-150 relative z-30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {!publicKey
              ? "Connect wallet to refund"
              : status === "checking"
                ? "Checking escrow..."
                : status === "submitting"
                  ? "Submitting refund..."
                  : "Start refund"}
          </button>
        </div>

        {/* Status Messages */}
        {message && (
          <div className={`mt-6 rounded-2xl border-2 p-4 text-sm font-medium font-[outfit] ${
            status === "error"
              ? "border-red-300 bg-red-50 text-red-700"
              : "border-green-300 bg-green-50 text-green-700"
          }`}>
            {message}
          </div>
        )}

        {/* Explorer Link */}
        {txSig && (
          <a
            href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block w-full text-center bg-white border-2 border-[#0B2818] text-[#0B2818] text-sm font-bold py-3 rounded-2xl"
          >
            View refund on Solana Explorer
          </a>
        )}

        {/* Info */}
        <div className="mt-8 bg-[#0B2818] rounded-2xl p-5 text-white">
          <h3 className="font-bold text-sm mb-2 text-[#B8FF4F]">How refunds work</h3>
          <ul className="text-xs text-gray-300 space-y-2">
            <li>&#8226; Refunds are available after 72 hours from when the escrow was created.</li>
            <li>&#8226; Only the original sender wallet can initiate the refund.</li>
            <li>&#8226; The full escrowed amount (minus rent) is returned to your wallet.</li>
            <li>&#8226; If the recipient has already claimed, no refund is possible.</li>
          </ul>
        </div>
      </main>

      {/* Footer */}
      <div className="bg-[#0B2818] p-10 max-sm:p-6 flex flex-col items-center justify-center shrink-0 mt-auto">
        <Image alt="zingpay" src="/zingpay.svg" width={130} height={37} className="block mx-auto max-sm:w-[100px] h-auto" />
        <p className="text-white text-lg max-sm:text-sm font-normal mt-4 max-sm:mt-2 font-[outfit] font-semibold text-center max-w-sm">
          No downloads, No signups, Just open the app and go!
        </p>
      </div>
    </div>
  );
}
