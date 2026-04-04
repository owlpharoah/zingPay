"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Bell, AlertCircle, ChevronDown, Check, ShieldCheck, Clock, Smartphone, X } from "lucide-react";
import "@fontsource/fraunces";
import "@fontsource/outfit";
import AppNav from "@/components/AppNav";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SendTransactionError, Transaction } from "@solana/web3.js";
import { CountryCode } from "libphonenumber-js";
import { BACKEND_URL } from "@/lib/constants";
import { downloadSecretKey, generateClaimKeypair } from "@/lib/walletless";
import { normalizeToE164 } from "@/lib/phone";
import { WalletDropdown } from "@/components/WalletDropdown";

// --- Country Codes Data ---
const COUNTRY_CODES = [
  { code: "IN" as CountryCode, dial: "+91", name: "India" },
  { code: "US" as CountryCode, dial: "+1", name: "United States" },
  { code: "GB" as CountryCode, dial: "+44", name: "United Kingdom" },
  { code: "CA" as CountryCode, dial: "+1", name: "Canada" },
  { code: "AU" as CountryCode, dial: "+61", name: "Australia" },
  { code: "DE" as CountryCode, dial: "+49", name: "Germany" },
  { code: "FR" as CountryCode, dial: "+33", name: "France" },
  { code: "JP" as CountryCode, dial: "+81", name: "Japan" },
  { code: "SG" as CountryCode, dial: "+65", name: "Singapore" },
  { code: "AE" as CountryCode, dial: "+971", name: "UAE" },
  { code: "BR" as CountryCode, dial: "+55", name: "Brazil" },
  { code: "NG" as CountryCode, dial: "+234", name: "Nigeria" },
  { code: "KE" as CountryCode, dial: "+254", name: "Kenya" },
  { code: "ZA" as CountryCode, dial: "+27", name: "South Africa" },
  { code: "PH" as CountryCode, dial: "+63", name: "Philippines" },
];

type ClaimState =
  | "loading"
  | "choose_mode"
  | "connect_wallet"
  | "generated_wallet_ready"
  | "otp_prompt"
  | "otp_input"
  | "submitting"
  | "success"
  | "error"
  | "already_claimed";

type ClaimMode = "connect" | "generated";

interface EscrowData {
  amount: number;
  sender: string;
  createdAt: number;
}

// --- Main Page Component (with Suspense for searchParams) ---
export default function ClaimPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F6F4EE] flex items-center justify-center font-[outfit] text-gray-500">Loading...</div>}>
      <ClaimPageInner />
    </Suspense>
  );
}

function ClaimPageInner() {
  const searchParams = useSearchParams();
  const escrowAddress = searchParams.get("escrow");
  const claimPhone = searchParams.get("phone");

  // If we have an escrow address in URL, go directly to claim flow
  if (escrowAddress) {
    return <DirectClaimFlow escrowAddress={escrowAddress} claimPhone={claimPhone} />;
  }

  // Otherwise show the list view (original UI)
  return <ClaimListView />;
}

// --- Direct Claim Flow (when arriving via claim link) ---
function DirectClaimFlow({ escrowAddress, claimPhone }: { escrowAddress: string; claimPhone: string | null }) {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();

  const [state, setState] = useState<ClaimState>("loading");
  const [claimMode, setClaimMode] = useState<ClaimMode | null>(null);
  const [escrowData, setEscrowData] = useState<EscrowData | null>(null);
  const [generatedKeypair, setGeneratedKeypair] = useState<Keypair | null>(null);
  const [keyDownloaded, setKeyDownloaded] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [message, setMessage] = useState("");
  const [txSig, setTxSig] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const claimantWallet = claimMode === "generated" ? generatedKeypair?.publicKey ?? null : publicKey;

  useEffect(() => {
    loadEscrow();
  }, [escrowAddress]);

  useEffect(() => {
    if (state === "connect_wallet" && publicKey && claimMode === "connect") {
      setState("otp_prompt");
    }
  }, [publicKey, state, claimMode]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadEscrow() {
    try {
      const pubkey = new PublicKey(escrowAddress);
      const info = await connection.getAccountInfo(pubkey);
      if (!info) {
        setState("already_claimed");
        return;
      }
      const data = info.data;
      const sender = new PublicKey(data.slice(8, 40));
      const amountBuf = data.slice(72, 80);
      const amount = Number(new DataView(amountBuf.buffer, amountBuf.byteOffset).getBigUint64(0, true)) / LAMPORTS_PER_SOL;
      const createdAtBuf = data.slice(80, 88);
      const createdAt = Number(new DataView(createdAtBuf.buffer, createdAtBuf.byteOffset).getBigInt64(0, true));

      setEscrowData({ amount, sender: sender.toString().slice(0, 8) + "...", createdAt });
      setState("choose_mode");
    } catch (err: any) {
      setMessage("Failed to load escrow: " + err.message);
      setState("error");
    }
  }

  function chooseConnectWalletMode() {
    setOtpCode(""); setMessage(""); setTxSig("");
    setClaimMode("connect");
    setGeneratedKeypair(null);
    setKeyDownloaded(false);
    setState(publicKey ? "otp_prompt" : "connect_wallet");
  }

  function chooseGeneratedMode() {
    setOtpCode(""); setMessage(""); setTxSig("");
    setClaimMode("generated");
    setGeneratedKeypair(generateClaimKeypair());
    setKeyDownloaded(false);
    setState("generated_wallet_ready");
  }

  function handleDownloadKeypair() {
    if (!generatedKeypair) return;
    downloadSecretKey(generatedKeypair);
    setKeyDownloaded(true);
  }

  async function handleSendOtp() {
    try {
      let phonePayload: string | undefined = claimPhone || undefined;
      if (!phonePayload) {
        const fullPhone = `${selectedCountry.dial}${phoneInput.replace(/\D/g, "")}`;
        const e164 = normalizeToE164(fullPhone, selectedCountry.code);
        if (!e164) throw new Error("Enter a valid phone number");
        phonePayload = e164;
      }
      const resp = await fetch(`${BACKEND_URL}/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escrow_address: escrowAddress, ...(phonePayload ? { phone: phonePayload } : {}) }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to send OTP");
      setState("otp_input");
    } catch (err: any) {
      setMessage(err.message);
      setState("error");
    }
  }

  async function handleVerifyAndClaim() {
    if (!claimantWallet || !otpCode || !claimMode) return;
    if (claimMode === "generated" && !generatedKeypair) return;
    if (claimMode === "generated" && !keyDownloaded) {
      setMessage("Please download and safely store your keypair before claiming.");
      setState("error");
      return;
    }

    setState("submitting");
    try {
      let phonePayload: string | undefined = claimPhone || undefined;
      if (!phonePayload && phoneInput) {
        const fullPhone = `${selectedCountry.dial}${phoneInput.replace(/\D/g, "")}`;
        const e164 = normalizeToE164(fullPhone, selectedCountry.code);
        if (e164) phonePayload = e164;
      }

      const resp = await fetch(`${BACKEND_URL}/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          escrow_address: escrowAddress,
          code: otpCode,
          claimant_wallet: claimantWallet.toString(),
          claim_mode: claimMode,
          ...(phonePayload ? { phone: phonePayload } : {}),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Verification failed");

      const tx = Transaction.from(Buffer.from(data.transaction, "base64"));

      let signedTx: Transaction;
      if (claimMode === "generated") {
        tx.partialSign(generatedKeypair!);
        signedTx = tx;
      } else {
        if (!signTransaction) throw new Error("Wallet cannot sign transaction");
        signedTx = await signTransaction(tx);
      }

      const sig = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(sig, "confirmed");

      setTxSig(sig);
      setState("success");
    } catch (err: any) {
      console.error("Claim failed:", err);
      if (err instanceof SendTransactionError) {
        const logs = await err.getLogs(connection).catch(() => null);
        if (logs?.length) console.error("Claim simulation logs:", logs);
      }
      const raw = String(err?.message || "Claim failed");
      if (raw.includes("unknown signer") || raw.includes("signature verification")) {
        setMessage("Signer mismatch. Reconnect wallet and try again.");
      } else if (raw.includes("Attempt to debit an account but found no record")) {
        setMessage("Gas sponsor wallet is missing or unfunded. Please contact support.");
      } else {
        setMessage(raw);
      }
      setState("error");
    }
  }

  const { elapsedHours, progressPercentage } = escrowData
    ? getTxStatus(new Date(escrowData.createdAt * 1000).toISOString())
    : { elapsedHours: 0, progressPercentage: 0 };

  return (
    <div className="min-h-screen bg-[#F6F4EE] flex flex-col font-[outfit]">
      {/* Top Bar */}
      <div className="bg-[#0B2818] flex items-center justify-between h-[131px] max-sm:h-[80px] p-4 max-sm:px-2 shrink-0">
        <Link href="/"><div className="flex items-center"><Image alt="back" src="/back.svg" width={12} height={23} className="inline-block mr-4 max-sm:mr-2 max-sm:w-2 max-sm:h-[14px]" /><p className="text-white font-[outfit] font-semibold text-xl max-sm:text-sm">Back</p></div></Link>
        <Image alt="zingpay" src="/zingpay.svg" width={172} height={57} className="w-[172px] h-auto max-sm:w-[110px]" />
        <WalletDropdown />
      </div>
      <AppNav />

      <div className="flex-1 max-w-lg mx-auto w-full p-6 max-sm:p-3">
        {/* Escrow info card */}
        {escrowData && state !== "loading" && state !== "already_claimed" && (
          <div className="bg-white border border-gray-200 rounded-[2rem] max-sm:rounded-[1.5rem] p-8 max-sm:p-5 mt-6 max-sm:mt-4 text-center shadow-sm relative z-0">
            <div className="inline-block border border-gray-300 rounded-full px-3 py-1 mb-6 max-sm:mb-4 text-[10px] max-sm:text-[9px] font-bold text-gray-500 uppercase tracking-wider">
              <span className="inline-block w-2 h-2 max-sm:w-1.5 max-sm:h-1.5 rounded-full bg-[#B8FF4F] mr-2"></span>
              Waiting for you
            </div>

            <div className="w-32 h-32 max-sm:w-24 max-sm:h-24 mx-auto bg-[#B8FF4F] rounded-full border-2 border-[#0B2818] flex flex-col items-center justify-center mb-6 max-sm:mb-4 shadow-[4px_4px_0_0_#0B2818] max-sm:shadow-[3px_3px_0_0_#0B2818] animate-hover-up-down">
              <span className="font-[fraunces] font-black text-2xl max-sm:text-lg text-[#0B2818] leading-none">{escrowData.amount.toFixed(4)} SOL</span>
              <span className="text-[#0B2818] text-xs max-sm:text-[10px] font-bold mt-1 uppercase tracking-widest">Waiting</span>
            </div>

            <h2 className="font-[fraunces] text-3xl max-sm:text-2xl font-black text-[#0B2818] mb-2 max-sm:mb-1">You've got<br /><span className="italic font-normal">money waiting.</span></h2>
            <p className="text-gray-500 text-sm max-sm:text-xs mb-6 max-sm:mb-4">From: {escrowData.sender}</p>

            {/* Choose mode */}
            {state === "choose_mode" && (
              <div className="space-y-3">
                <button onClick={chooseConnectWalletMode} className="w-full bg-[#B8FF4F] text-[#0B2818] font-bold py-4 max-sm:py-3 rounded-xl shadow-[0_4px_0_0_#8ABF3B] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#8ABF3B] active:translate-y-[4px] active:shadow-none transition-all text-base max-sm:text-sm">
                  I already have a wallet
                </button>
                <button onClick={chooseGeneratedMode} className="w-full bg-white border-2 border-[#0B2818] text-[#0B2818] font-bold py-4 max-sm:py-3 rounded-xl text-base max-sm:text-sm hover:bg-gray-50 transition-all">
                  I don't have a wallet
                </button>
              </div>
            )}

            {/* Connect wallet prompt */}
            {state === "connect_wallet" && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">Connect your wallet to continue.</p>
                <WalletDropdown />
              </div>
            )}

            {/* Generated wallet */}
            {state === "generated_wallet_ready" && generatedKeypair && (
              <div className="space-y-3 text-left">
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-800">
                  A new wallet was generated. Download the keypair now — if you lose it, you lose access forever.
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-500 mb-1">Generated wallet</p>
                  <p className="break-all font-mono text-xs text-[#0B2818]">{generatedKeypair.publicKey.toString()}</p>
                </div>
                <button onClick={handleDownloadKeypair} className="w-full bg-[#0B2818] text-[#B8FF4F] font-bold py-3 rounded-xl text-sm">
                  Download keypair
                </button>
                <button onClick={() => setState("otp_prompt")} disabled={!keyDownloaded} className="w-full bg-[#B8FF4F] text-[#0B2818] font-bold py-3 rounded-xl text-sm disabled:opacity-50">
                  {keyDownloaded ? "Continue to OTP" : "Download keypair first"}
                </button>
                <button onClick={() => setState("choose_mode")} className="w-full text-gray-500 text-sm py-2">Back</button>
              </div>
            )}

            {/* OTP prompt - phone input + send code */}
            {state === "otp_prompt" && (
              <div className="border border-gray-300 rounded-[1.5rem] max-sm:rounded-[1rem] p-5 max-sm:p-4 text-left bg-white mt-4">
                {!claimPhone && (
                  <>
                    <label className="text-xs max-sm:text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 max-sm:mb-1.5 block font-[outfit]">Phone Number</label>
                    <div className="flex gap-2 mb-4 max-sm:mb-3">
                      <div className="relative" ref={dropdownRef}>
                        <button type="button" onClick={() => setDropdownOpen(!dropdownOpen)} className={`border rounded-xl max-sm:rounded-lg px-3 max-sm:px-2 py-3 max-sm:py-2.5 flex items-center bg-white min-w-[80px] max-sm:min-w-[70px] justify-between gap-1 transition-colors font-[outfit] ${dropdownOpen ? "border-[#B8FF4F] ring-2 ring-[#B8FF4F]" : "border-gray-300"}`}>
                          <span className="text-sm max-sm:text-xs font-bold text-[#0B2818]">{selectedCountry.code}</span>
                          <span className="text-sm max-sm:text-xs text-gray-600">{selectedCountry.dial}</span>
                          <ChevronDown className={`w-4 h-4 max-sm:w-3 max-sm:h-3 text-gray-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
                        </button>
                        {dropdownOpen && (
                          <div className="absolute top-full left-0 mt-1 w-[220px] max-sm:w-[200px] bg-white border border-gray-200 rounded-xl max-sm:rounded-lg shadow-xl z-50 max-h-[240px] overflow-y-auto font-[outfit]">
                            {COUNTRY_CODES.map((country) => (
                              <button key={country.code + country.dial} type="button" onClick={() => { setSelectedCountry(country); setDropdownOpen(false); }} className={`w-full text-left px-4 max-sm:px-3 py-2.5 max-sm:py-2 flex items-center justify-between transition-colors ${selectedCountry.code === country.code && selectedCountry.dial === country.dial ? "bg-[#B8FF4F]/20 text-[#0B2818]" : "text-[#0B2818] hover:bg-[#B8FF4F]/10"}`}>
                                <span className="flex items-center gap-2"><span className="font-bold text-sm max-sm:text-xs">{country.code}</span><span className="text-gray-500 text-sm max-sm:text-xs truncate">{country.name}</span></span>
                                <span className="text-sm max-sm:text-xs text-gray-500 shrink-0">{country.dial}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <input type="tel" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} className="border border-gray-300 rounded-xl max-sm:rounded-lg px-4 max-sm:px-3 py-3 max-sm:py-2.5 flex-1 w-full focus:outline-none focus:border-[#B8FF4F] focus:ring-2 focus:ring-[#B8FF4F] text-[#0B2818] text-sm max-sm:text-xs font-[outfit]" placeholder="Enter phone number" />
                    </div>
                  </>
                )}
                <p className="text-sm text-gray-500 mb-3">We'll send a verification code to {claimPhone || "your phone"}.</p>
                <button onClick={handleSendOtp} className="w-full bg-[#B8FF4F] text-[#0B2818] font-bold py-4 max-sm:py-3 rounded-xl shadow-[0_4px_0_0_#8ABF3B] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#8ABF3B] active:translate-y-[4px] active:shadow-none transition-all text-base max-sm:text-sm">
                  Send me the code
                </button>
              </div>
            )}

            {/* OTP input */}
            {state === "otp_input" && (
              <div className="border border-gray-300 rounded-[1.5rem] max-sm:rounded-[1rem] p-5 max-sm:p-4 text-left bg-white mt-4">
                <label className="text-xs max-sm:text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 max-sm:mb-1.5 block font-[outfit]">6-Digit Verification Code</label>
                <input type="text" value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} className="border border-gray-300 rounded-xl max-sm:rounded-lg px-4 max-sm:px-3 py-3 max-sm:py-2.5 w-full mb-4 max-sm:mb-3 focus:outline-none focus:ring-2 focus:ring-[#B8FF4F] focus:border-transparent text-[#0B2818] text-sm max-sm:text-xs font-[outfit] tracking-[0.3em] text-center text-lg" placeholder="XXXXXX" maxLength={6} autoFocus />
                <button onClick={handleVerifyAndClaim} disabled={otpCode.length !== 6} className="w-full bg-[#B8FF4F] text-[#0B2818] font-bold py-4 max-sm:py-3 rounded-xl shadow-[0_4px_0_0_#8ABF3B] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#8ABF3B] active:translate-y-[4px] active:shadow-none transition-all text-base max-sm:text-sm disabled:opacity-50">
                  Verify & Claim
                </button>
              </div>
            )}

            {/* Submitting */}
            {state === "submitting" && (
              <div className="mt-4 p-4 text-center text-sm text-gray-500">Submitting claim transaction...</div>
            )}
          </div>
        )}

        {/* Loading */}
        {state === "loading" && (
          <div className="mt-10 text-center text-sm text-gray-500">Loading escrow details...</div>
        )}

        {/* Already claimed */}
        {state === "already_claimed" && (
          <div className="mt-10 bg-yellow-50 border border-yellow-200 rounded-2xl p-6 text-center">
            <h2 className="font-[fraunces] text-2xl font-black text-[#0B2818] mb-2">Already claimed</h2>
            <p className="text-sm text-gray-500">This escrow has already been claimed or refunded.</p>
          </div>
        )}

        {/* Success */}
        {state === "success" && (
          <SuccessModal
            amount={escrowData?.amount || 0}
            wallet={claimantWallet?.toString() || ""}
            txSig={txSig}
            onClose={() => window.location.href = "/"}
          />
        )}

        {/* Error */}
        {state === "error" && message && (
          <div className="mt-6 space-y-3">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">{message}</div>
            <button onClick={() => { setMessage(""); setState(claimMode === "generated" ? "otp_prompt" : publicKey ? "otp_prompt" : "connect_wallet"); }} className="w-full bg-white border-2 border-[#0B2818] text-[#0B2818] font-bold py-3 rounded-xl text-sm">
              Try again
            </button>
          </div>
        )}

        {/* Info cards */}
        {state !== "loading" && state !== "already_claimed" && state !== "success" && (
          <div className="mt-6 max-sm:mt-4 space-y-3 max-sm:space-y-2 pb-8 max-sm:pb-4">
            <InfoCard icon={<ShieldCheck className="max-sm:w-5 max-sm:h-5" />} title="Secured in smart contract" desc="Funds held on Solana, nobody can touch them except you." />
            <InfoCard icon={<Clock className="max-sm:w-5 max-sm:h-5" />} title="72 hours to claim" desc="After 72h the sender gets an automatic refund." />
            <InfoCard icon={<Smartphone className="max-sm:w-5 max-sm:h-5" />} title="No app download needed" desc="Works in any browser on any phone, anywhere." />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-[#0B2818] mt-auto p-10 flex flex-col items-center justify-center">
        <div className="text-white font-[fraunces] text-2xl font-bold italic mb-2">Zing<span className="text-[#B8FF4F]">Pay</span></div>
        <p className="text-gray-400 text-xs text-center">No download, No Signups, Just open the web app and go!</p>
      </div>
    </div>
  );
}

// --- Claim List View (no escrow in URL - shows pending claims from localStorage) ---
function ClaimListView() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const stored = localStorage.getItem("zingpay_transactions");
    if (stored) {
      setTransactions(JSON.parse(stored));
    } else {
      const seedData = [
        { id: "tx_1", amount: 0.1, currency: "Sol", createdAt: new Date(Date.now() - 44 * 60 * 60 * 1000).toISOString(), claimed: false },
        { id: "tx_2", amount: 0.2, currency: "Sol", createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), claimed: false },
      ];
      localStorage.setItem("zingpay_transactions", JSON.stringify(seedData));
      setTransactions(seedData);
    }
  }, []);

  useEffect(() => {
    if (isClient && transactions.length > 0) {
      localStorage.setItem("zingpay_transactions", JSON.stringify(transactions));
    }
  }, [transactions, isClient]);

  const handleClaimSubmit = () => {
    setShowModal(true);
    setTransactions((prev: any[]) => prev.map((tx: any) => (tx.id === selectedTx.id ? { ...tx, claimed: true } : tx)));
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedTx(null);
  };

  if (!isClient) return null;

  const pendingTransactions = transactions.filter((tx: any) => !tx.claimed);

  return (
    <div className="min-h-screen bg-[#F6F4EE] flex flex-col font-[outfit]">
      <div className="bg-[#0B2818] flex items-center justify-between h-[131px] max-sm:h-[80px] p-4 max-sm:px-2 shrink-0">
        <Link href="/"><div className="flex items-center"><Image alt="back" src="/back.svg" width={12} height={23} className="inline-block mr-4 max-sm:mr-2 max-sm:w-2 max-sm:h-[14px]" /><p className="text-white font-[outfit] font-semibold text-xl max-sm:text-sm">Back</p></div></Link>
        <Image alt="zingpay" src="/zingpay.svg" width={172} height={57} className="w-[172px] h-auto max-sm:w-[110px]" />
        <WalletDropdown />
      </div>

      {selectedTx ? (
        <ClaimDetailView tx={selectedTx} onClaim={handleClaimSubmit} showModal={showModal} onCloseModal={handleCloseModal} onCloseDetail={() => setSelectedTx(null)} />
      ) : (
        <>
          <AppNav />
          <div className="flex-1 max-w-2xl mx-auto w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="font-[fraunces] text-4xl font-black text-[#0B2818] tracking-tight">Claim money</h1>
              <div className="bg-[#B8FF4F] border border-[#0B2818] rounded-full px-4 py-1.5 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#0B2818]"></div>
                <span className="text-[#0B2818] font-bold text-sm">{pendingTransactions.length} pending</span>
              </div>
            </div>
            <div className="w-full h-[2px] bg-[#0B2818] mb-8"></div>

            <div className="bg-[#EAF2CC] border border-[#7BA039] rounded-2xl p-4 flex items-center gap-4 mb-10">
              <div className="w-12 h-12 rounded-full border border-[#0B2818] flex items-center justify-center bg-[#B8FF4F] shrink-0">
                <Bell className="w-5 h-5 text-[#0B2818]" />
              </div>
              <div>
                <h3 className="text-[#0B2818] font-bold text-lg">{pendingTransactions.length} payments waiting for you</h3>
                <p className="text-gray-600 text-sm">Verify your phone once to claim all of them instantly.</p>
              </div>
            </div>

            <p className="text-gray-500 font-bold text-xs uppercase tracking-widest mb-4">Unclaimed Payments</p>
            <div className="space-y-6">
              {pendingTransactions.map((tx: any) => (
                <TransactionCard key={tx.id} tx={tx} onClick={() => setSelectedTx(tx)} />
              ))}
            </div>

            <div className="bg-[#0B2818] rounded-2xl p-4 mt-8 flex items-center gap-4 text-white">
              <div className="w-8 h-8 rounded-full border-2 border-[#B8FF4F] flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-[#B8FF4F]" />
              </div>
              <p className="text-sm text-gray-300">Missed claims are auto-refunded to the sender after 72 hours. The money is never lost, either you get it or they do.</p>
            </div>
          </div>
        </>
      )}

      <div className="bg-[#0B2818] mt-auto p-10 flex flex-col items-center justify-center">
        <div className="text-white font-[fraunces] text-2xl font-bold italic mb-2">Zing<span className="text-[#B8FF4F]">Pay</span></div>
        <p className="text-gray-400 text-xs text-center">No download, No Signups, Just open the web app and go!</p>
      </div>
    </div>
  );
}

// --- Transaction Card Component ---
function TransactionCard({ tx, onClick }: { tx: any; onClick: () => void }) {
  const { elapsedHours, isUrgent, progressPercentage } = getTxStatus(tx.createdAt);
  return (
    <div onClick={onClick} className="rounded-3xl overflow-hidden border-2 border-[#7BA039] cursor-pointer transform transition-transform hover:scale-[1.01] shadow-sm">
      <div className="bg-[#0B2818] px-5 py-3 flex justify-between items-center text-white">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-[#B8FF4F]"></div>
          <span className="font-bold tracking-widest text-sm text-[#B8FF4F]">{isUrgent ? "URGENT" : "ACTIVE"}</span>
          <span className="text-gray-400 text-sm">{72 - Math.floor(elapsedHours)}hr left</span>
        </div>
        <span className="text-[#7BA039] text-sm hover:text-[#B8FF4F] transition-colors">Tap to claim</span>
      </div>
      <div className="bg-[#EAF2CC] p-6 flex items-center justify-between">
        <span className="font-[fraunces] text-4xl font-bold text-[#0B2818]">{tx.amount} {tx.currency}</span>
        <div className="w-[45%]">
          <div className="h-2 bg-gray-300 rounded-full w-full overflow-hidden">
            <div className={`h-full rounded-full ${isUrgent ? 'bg-[#EF4444]' : 'bg-[#0B2818]'}`} style={{ width: `${progressPercentage}%` }}></div>
          </div>
          <p className={`text-right text-xs mt-2 font-medium ${isUrgent ? 'text-[#EF4444]' : 'text-gray-500'}`}>{Math.floor(elapsedHours).toString().padStart(2, '0')} hours elapsed</p>
        </div>
      </div>
    </div>
  );
}

// --- Detail View Component (for list-based claims) ---
function ClaimDetailView({ tx, onClaim, showModal, onCloseModal, onCloseDetail }: any) {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();

  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [claimState, setClaimState] = useState<"idle" | "sending_otp" | "otp_sent" | "verifying" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex-1 w-full max-w-lg mx-auto p-6 max-sm:p-3 relative">
      <AppNav />
      <div className="bg-white border border-gray-200 rounded-[2rem] max-sm:rounded-[1.5rem] p-8 max-sm:p-5 mt-6 max-sm:mt-4 text-center shadow-sm relative z-0">
        <button onClick={onCloseDetail} className="absolute top-6 right-6 max-sm:top-4 max-sm:right-4 w-8 h-8 max-sm:w-7 max-sm:h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-500 focus:outline-none">
          <X className="w-5 h-5 max-sm:w-4 max-sm:h-4" />
        </button>
        <div className="inline-block border border-gray-300 rounded-full px-3 py-1 mb-6 max-sm:mb-4 text-[10px] max-sm:text-[9px] font-bold text-gray-500 uppercase tracking-wider">
          <span className="inline-block w-2 h-2 max-sm:w-1.5 max-sm:h-1.5 rounded-full bg-[#B8FF4F] mr-2"></span>Waiting for you
        </div>
        <div className="w-32 h-32 max-sm:w-24 max-sm:h-24 mx-auto bg-[#B8FF4F] rounded-full border-2 border-[#0B2818] flex flex-col items-center justify-center mb-6 max-sm:mb-4 shadow-[4px_4px_0_0_#0B2818] max-sm:shadow-[3px_3px_0_0_#0B2818] animate-hover-up-down">
          <span className="font-[fraunces] font-black text-2xl max-sm:text-lg text-[#0B2818] leading-none">{tx.amount} {tx.currency}</span>
          <span className="text-[#0B2818] text-xs max-sm:text-[10px] font-bold mt-1 uppercase tracking-widest">Waiting</span>
        </div>
        <h2 className="font-[fraunces] text-3xl max-sm:text-2xl font-black text-[#0B2818] mb-2 max-sm:mb-1">You've got<br /><span className="italic font-normal">money waiting.</span></h2>
        <p className="text-gray-500 text-sm max-sm:text-xs mb-8 max-sm:mb-5">Verify your phone number to claim. No wallet setup needed, we handle everything in the background.</p>

        <div className="border border-gray-300 rounded-[1.5rem] max-sm:rounded-[1rem] p-5 max-sm:p-4 text-left bg-white">
          <label className="text-xs max-sm:text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 max-sm:mb-1.5 block font-[outfit]">Phone Number</label>
          <div className="flex gap-2 mb-4 max-sm:mb-3">
            <div className="relative" ref={dropdownRef}>
              <button type="button" onClick={() => setDropdownOpen(!dropdownOpen)} className={`border rounded-xl max-sm:rounded-lg px-3 max-sm:px-2 py-3 max-sm:py-2.5 flex items-center bg-white min-w-[80px] max-sm:min-w-[70px] justify-between gap-1 transition-colors font-[outfit] ${dropdownOpen ? "border-[#B8FF4F] ring-2 ring-[#B8FF4F]" : "border-gray-300"}`}>
                <span className="text-sm max-sm:text-xs font-bold text-[#0B2818]">{selectedCountry.code}</span>
                <span className="text-sm max-sm:text-xs text-gray-600">{selectedCountry.dial}</span>
                <ChevronDown className={`w-4 h-4 max-sm:w-3 max-sm:h-3 text-gray-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {dropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-[220px] max-sm:w-[200px] bg-white border border-gray-200 rounded-xl max-sm:rounded-lg shadow-xl z-50 max-h-[240px] overflow-y-auto font-[outfit]">
                  {COUNTRY_CODES.map((country) => (
                    <button key={country.code + country.dial} type="button" onClick={() => { setSelectedCountry(country); setDropdownOpen(false); }} className={`w-full text-left px-4 max-sm:px-3 py-2.5 max-sm:py-2 flex items-center justify-between transition-colors ${selectedCountry.code === country.code ? "bg-[#B8FF4F]/20" : "hover:bg-[#B8FF4F]/10"}`}>
                      <span className="flex items-center gap-2"><span className="font-bold text-sm max-sm:text-xs">{country.code}</span><span className="text-gray-500 text-sm max-sm:text-xs truncate">{country.name}</span></span>
                      <span className="text-sm max-sm:text-xs text-gray-500 shrink-0">{country.dial}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input type="tel" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} className="border border-gray-300 rounded-xl max-sm:rounded-lg px-4 max-sm:px-3 py-3 max-sm:py-2.5 flex-1 w-full focus:outline-none focus:border-[#B8FF4F] focus:ring-2 focus:ring-[#B8FF4F] text-[#0B2818] text-sm max-sm:text-xs font-[outfit]" placeholder="Enter phone number" />
          </div>

          <label className="text-xs max-sm:text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 max-sm:mb-1.5 block font-[outfit]">6-Digit Verification Code</label>
          <input type="text" value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} className="border border-gray-300 rounded-xl max-sm:rounded-lg px-4 max-sm:px-3 py-3 max-sm:py-2.5 w-full mb-4 max-sm:mb-3 focus:outline-none focus:ring-2 focus:ring-[#B8FF4F] focus:border-transparent text-[#0B2818] text-sm max-sm:text-xs font-[outfit]" placeholder="XXXXXX" maxLength={6} />

          <div className="flex items-center gap-3 max-sm:gap-2 mb-6 max-sm:mb-4">
            <div className="w-10 h-10 max-sm:w-8 max-sm:h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-400 text-sm max-sm:text-xs font-[outfit]">00</div>
            <span className="text-sm max-sm:text-xs text-gray-400 font-medium font-[outfit]">Resend Code</span>
          </div>

          {errorMsg && <div className="mb-3 text-sm text-red-600">{errorMsg}</div>}

          <button onClick={onClaim} className="w-full bg-[#B8FF4F] text-[#0B2818] font-bold py-4 max-sm:py-3 rounded-xl max-sm:rounded-lg shadow-[0_4px_0_0_#8ABF3B] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#8ABF3B] active:translate-y-[4px] active:shadow-none transition-all text-base max-sm:text-sm font-[outfit]">
            Verify & Claim
          </button>
        </div>
      </div>

      <div className="mt-6 max-sm:mt-4 space-y-3 max-sm:space-y-2 pb-8 max-sm:pb-4">
        <InfoCard icon={<ShieldCheck className="max-sm:w-5 max-sm:h-5" />} title="Secured in smart contract" desc="Funds held on Solana, nobody can touch them except you." />
        <InfoCard icon={<Clock className="max-sm:w-5 max-sm:h-5" />} title="72 hours to claim" desc="After 72h the sender gets an automatic refund." />
        <InfoCard icon={<Smartphone className="max-sm:w-5 max-sm:h-5" />} title="No app download needed" desc="Works in any browser on any phone, anywhere." />
      </div>

      {showModal && <ClaimSuccessModal tx={tx} onClose={onCloseModal} />}
    </div>
  );
}

// --- Success Modal for list-based claims ---
function ClaimSuccessModal({ tx, onClose }: { tx: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-[#0B2818]/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-[#F6F4EE] rounded-[2rem] w-full max-w-sm p-8 text-center relative shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="w-10 h-1 mx-auto bg-gray-300 rounded-full mb-8"></div>
        <div className="w-20 h-20 mx-auto bg-[#0B2818] rounded-full flex items-center justify-center mb-6 shadow-lg">
          <Check className="w-10 h-10 text-[#B8FF4F]" strokeWidth={3} />
        </div>
        <h2 className="font-[fraunces] text-3xl font-black text-[#0B2818] mb-1">Money <span className="italic font-normal">Claimed!</span></h2>
        <p className="text-gray-500 text-sm mb-6">Your funds are in your wallet. Welcome to ZingPay</p>
        <div className="border border-gray-300 bg-white rounded-2xl overflow-hidden mb-6 text-sm">
          <div className="flex justify-between p-4 border-b border-gray-200"><span className="text-gray-500">Amount Reached</span><span className="font-bold text-[#0B2818]">{tx.amount} {tx.currency}</span></div>
          <div className="flex justify-between p-4 border-b border-gray-200"><span className="text-gray-500">Your wallet</span><span className="font-bold text-[#0B2818]">8f3a...c72B</span></div>
          <div className="flex justify-between p-4"><span className="text-gray-500">Status</span><span className="font-bold text-[#22C55E]">In your wallet</span></div>
        </div>
        <button onClick={onClose} className="w-full bg-[#B8FF4F] text-[#0B2818] font-bold py-4 rounded-xl mb-3 shadow-[0_4px_0_0_#8ABF3B] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#8ABF3B] active:translate-y-[4px] active:shadow-none transition-all">Send another</button>
        <button onClick={onClose} className="w-full bg-white text-[#0B2818] font-bold py-4 rounded-xl border border-gray-300">View in history</button>
      </div>
    </div>
  );
}

// --- Success Modal for direct claim flow ---
function SuccessModal({ amount, wallet, txSig, onClose }: { amount: number; wallet: string; txSig: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-[#0B2818]/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-[#F6F4EE] rounded-[2rem] w-full max-w-sm p-8 text-center relative shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="w-10 h-1 mx-auto bg-gray-300 rounded-full mb-8"></div>
        <div className="w-20 h-20 mx-auto bg-[#0B2818] rounded-full flex items-center justify-center mb-6 shadow-lg">
          <Check className="w-10 h-10 text-[#B8FF4F]" strokeWidth={3} />
        </div>
        <h2 className="font-[fraunces] text-3xl font-black text-[#0B2818] mb-1">Money <span className="italic font-normal">Claimed!</span></h2>
        <p className="text-gray-500 text-sm mb-6">You received {amount.toFixed(4)} SOL!</p>
        <div className="border border-gray-300 bg-white rounded-2xl overflow-hidden mb-6 text-sm">
          <div className="flex justify-between p-4 border-b border-gray-200"><span className="text-gray-500">Amount</span><span className="font-bold text-[#0B2818]">{amount.toFixed(4)} SOL</span></div>
          <div className="flex justify-between p-4 border-b border-gray-200"><span className="text-gray-500">Wallet</span><span className="font-bold text-[#0B2818] truncate max-w-[180px]">{wallet.slice(0, 6)}...{wallet.slice(-4)}</span></div>
          <div className="flex justify-between p-4"><span className="text-gray-500">Status</span><span className="font-bold text-[#22C55E]">In your wallet</span></div>
        </div>
        {txSig && (
          <a href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="w-full bg-[#0B2818] text-[#B8FF4F] font-bold py-3 rounded-xl mb-3 block text-center text-sm">View on Explorer</a>
        )}
        <button onClick={onClose} className="w-full bg-[#B8FF4F] text-[#0B2818] font-bold py-4 rounded-xl shadow-[0_4px_0_0_#8ABF3B] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#8ABF3B] active:translate-y-[4px] active:shadow-none transition-all">Done</button>
      </div>
    </div>
  );
}

// --- Helper Components ---
function InfoCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="bg-white border border-gray-300 rounded-2xl p-4 flex items-start gap-4">
      <div className="text-[#0B2818] bg-[#EAF2CC] p-2 rounded-xl shrink-0">{icon}</div>
      <div><h4 className="text-sm font-bold text-[#0B2818]">{title}</h4><p className="text-xs text-gray-500">{desc}</p></div>
    </div>
  );
}

function getTxStatus(createdAt: string) {
  const createdDate = new Date(createdAt);
  const now = new Date();
  const elapsedMs = now.getTime() - createdDate.getTime();
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  const isUrgent = elapsedHours > 24;
  const progressPercentage = Math.min((elapsedHours / 72) * 100, 100);
  return { elapsedHours, isUrgent, progressPercentage };
}
