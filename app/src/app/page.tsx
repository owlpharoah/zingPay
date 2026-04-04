"use client";

import { useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  CountryCode,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from "libphonenumber-js";
import { hashPhone, toHex } from "@/lib/hash";
import { getRegistryPda, getEscrowPda } from "@/lib/program";
import { PROGRAM_ID, BACKEND_URL } from "@/lib/constants";
import * as anchor from "@coral-xyz/anchor";

const ESCROW_EXPIRY_SECONDS = 72 * 3600;
const FIAT_OPTIONS = ["SOL", "USD", "INR", "EUR", "GBP", "JPY", "AED", "SGD"];

function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export default function SendPage() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  type PendingEscrow = {
    escrow: string;
    phone: string;
    phoneHashHex: string;
    amountSol: number;
    createdAt: number;
    expiresAt: number;
  };

  const [country, setCountry] = useState<CountryCode>("IN");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("SOL");
  const [solRate, setSolRate] = useState<number>(1);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "success" | "partial_success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [txSig, setTxSig] = useState("");
  const [pendingEscrow, setPendingEscrow] = useState<PendingEscrow | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [splashPhase, setSplashPhase] = useState<"idle" | "sending" | "success">("idle");

  const countryOptions = useMemo(() => {
    const display =
      typeof Intl !== "undefined" && "DisplayNames" in Intl
        ? new Intl.DisplayNames(["en"], { type: "region" })
        : null;

    return getCountries().map((code) => {
      const name = display?.of(code) || code;
      const dial = getCountryCallingCode(code);
      return {
        code,
        label: `${countryFlag(code)} ${name} (+${dial})`,
      };
    });
  }, []);

  const enteredAmount = Number(amount || 0);
  const solAmount =
    currency === "SOL"
      ? enteredAmount
      : solRate > 0
        ? enteredAmount / solRate
        : 0;

  useEffect(() => {
    let cancelled = false;

    async function loadRate() {
      if (currency === "SOL") {
        setSolRate(1);
        setRateError("");
        setRateLoading(false);
        return;
      }

      setRateLoading(true);
      setRateError("");
      try {
        const resp = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=${currency.toLowerCase()}`
        );
        const data = await resp.json();
        const nextRate = Number(data?.solana?.[currency.toLowerCase()]);
        if (!nextRate || Number.isNaN(nextRate)) {
          throw new Error("Rate unavailable");
        }
        if (!cancelled) {
          setSolRate(nextRate);
          setRateError("");
        }
      } catch {
        if (!cancelled) {
          setRateError(`Could not fetch SOL/${currency} rate.`);
        }
      } finally {
        if (!cancelled) {
          setRateLoading(false);
        }
      }
    }

    loadRate();
    return () => {
      cancelled = true;
    };
  }, [currency]);

  function appendHistoryRecord(record: {
    txSig: string;
    phone: string;
    amountSol: string;
    mode: "direct" | "escrow";
    createdAt: number;
  }) {
    const historyKey = publicKey
      ? `solpay_sent_history_${publicKey.toString()}`
      : "solpay_sent_history_guest";
    try {
      const raw = localStorage.getItem(historyKey);
      const current = raw ? JSON.parse(raw) : [];
      const next = [record, ...(Array.isArray(current) ? current : [])].slice(0, 50);
      localStorage.setItem(historyKey, JSON.stringify(next));
    } catch {
      localStorage.setItem(historyKey, JSON.stringify([record]));
    }
  }

  function formatTimeLeft(seconds: number): string {
    if (seconds <= 0) return "Expired (refund available)";
    const days = Math.floor(seconds / 86400);
    const hrs = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hrs}h ${mins}m left`;
    return `${hrs}h ${mins}m left`;
  }

  function readEscrowDetails(accountData: Uint8Array) {
    const amountLamports = Number(
      new DataView(accountData.buffer, accountData.byteOffset + 72, 8).getBigUint64(
        0,
        true
      )
    );
    const createdAt = Number(
      new DataView(accountData.buffer, accountData.byteOffset + 80, 8).getBigInt64(
        0,
        true
      )
    );

    return {
      amountSol: amountLamports / LAMPORTS_PER_SOL,
      createdAt,
      expiresAt: createdAt + ESCROW_EXPIRY_SECONDS,
    };
  }

  async function resendClaimSms() {
    if (!pendingEscrow) return;

    setIsResending(true);
    try {
      const notifyResp = await fetch(`${BACKEND_URL}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: pendingEscrow.phone,
          phone_hash: pendingEscrow.phoneHashHex,
          escrow_address: pendingEscrow.escrow,
        }),
      });
      const notifyData = await notifyResp
        .json()
        .catch(() => ({ error: "Unknown notification error" }));
      if (!notifyResp.ok) {
        throw new Error(notifyData.error || "Failed to resend SMS notification");
      }

      setStatus("success");
      setMessage(`Reminder SMS sent again to ${pendingEscrow.phone}.`);
    } catch (err: any) {
      setStatus("partial_success");
      setMessage(
        `Escrow exists, but SMS resend failed. Share claim link manually: ${window.location.origin}/claim?escrow=${pendingEscrow.escrow}&phone=${encodeURIComponent(pendingEscrow.phone)}`
      );
    } finally {
      setIsResending(false);
    }
  }

  async function copyClaimLink() {
    if (!pendingEscrow) return;
    const claimUrl = `${window.location.origin}/claim?escrow=${pendingEscrow.escrow}&phone=${encodeURIComponent(pendingEscrow.phone)}`;
    await navigator.clipboard.writeText(claimUrl);
    setStatus("success");
    setMessage("Claim link copied. Share it with the recipient.");
  }

  function showSendSuccessSplash() {
    setSplashPhase("success");
    window.setTimeout(() => setSplashPhase("idle"), 850);
  }

  async function handleSend() {
    if (!publicKey) {
      setMessage("Connect your wallet first");
      setStatus("error");
      return;
    }

    const solAmount =
      currency === "SOL"
        ? parseFloat(amount)
        : solRate > 0
          ? parseFloat(amount) / solRate
          : NaN;
    if (!solAmount || solAmount <= 0) {
      setMessage(
        currency === "SOL"
          ? "Enter a valid SOL amount"
          : `Enter a valid ${currency} amount`
      );
      setStatus("error");
      return;
    }

    if (currency !== "SOL" && (!solRate || rateError)) {
      setMessage(`Cannot convert ${currency} to SOL right now. Try again.`);
      setStatus("error");
      return;
    }

    let phoneE164: string;
    try {
      const parsed = phone.trim().startsWith("+")
        ? parsePhoneNumberFromString(phone.trim())
        : parsePhoneNumberFromString(phone.trim(), country);
      if (!parsed?.isValid()) throw new Error("Invalid");
      phoneE164 = parsed.number;
    } catch {
      setMessage("Enter a valid phone number");
      setStatus("error");
      return;
    }

    setStatus("sending");
    setSplashPhase("sending");
    setMessage("");
    setTxSig("");
    setPendingEscrow(null);

    try {
      const phoneHash = await hashPhone(phoneE164);
      const phoneHashArray = Array.from(phoneHash);
      const lamports = Math.round(solAmount * LAMPORTS_PER_SOL);

      // Check if phone is registered
      const [registryPda] = getRegistryPda(phoneHash);
      const registryInfo = await connection.getAccountInfo(registryPda);
      const isRegistered = registryInfo !== null;

      const [escrowPda] = getEscrowPda(publicKey, phoneHash);

      if (!isRegistered) {
        const existingEscrowInfo = await connection.getAccountInfo(escrowPda);
        if (existingEscrowInfo) {
          const details = readEscrowDetails(existingEscrowInfo.data);
          setPendingEscrow({
            escrow: escrowPda.toString(),
            phone: phoneE164,
            phoneHashHex: toHex(phoneHash),
            amountSol: details.amountSol,
            createdAt: details.createdAt,
            expiresAt: details.expiresAt,
          });
          setStatus("partial_success");
          setMessage(
            `A pending escrow already exists for ${phoneE164}. Resend claim link instead of creating a new escrow.`
          );
          setSplashPhase("idle");
          return;
        }
      }

      // Load IDL for instruction building
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

      let ix;
      if (isRegistered) {
        const registryAccount = await (program.account as any).registryAccount.fetch(
          registryPda
        );
        const recipientWallet = registryAccount.wallet as PublicKey;

        ix = await program.methods
          .sendDirect(phoneHashArray, new anchor.BN(lamports))
          .accounts({
            sender: publicKey,
            registry: registryPda,
            recipientWallet: recipientWallet,
            systemProgram: SystemProgram.programId,
          })
          .instruction();
      } else {
        ix = await program.methods
          .sendEscrow(phoneHashArray, new anchor.BN(lamports))
          .accounts({
            sender: publicKey,
            escrow: escrowPda,
            systemProgram: SystemProgram.programId,
          })
          .instruction();
      }

      const tx = new Transaction().add(ix);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (
        await connection.getLatestBlockhash()
      ).blockhash;

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      setTxSig(sig);
      appendHistoryRecord({
        txSig: sig,
        phone: phoneE164,
        amountSol: solAmount.toFixed(6),
        mode: isRegistered ? "direct" : "escrow",
        createdAt: Date.now(),
      });

      if (!isRegistered) {
        // Notify backend to send SMS
        const claimUrl = `${window.location.origin}/claim?escrow=${escrowPda.toString()}&phone=${encodeURIComponent(phoneE164)}`;
        try {
          const notifyResp = await fetch(`${BACKEND_URL}/notify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: phoneE164,
              phone_hash: toHex(phoneHash),
              escrow_address: escrowPda.toString(),
            }),
          });
          const notifyData = await notifyResp
            .json()
            .catch(() => ({ error: "Unknown notification error" }));
          if (!notifyResp.ok) {
            throw new Error(notifyData.error || "Failed to send SMS notification");
          }
          setMessage(
            `Escrow created! SMS sent to ${phoneE164}. They have 72h to claim.`
          );
          setStatus("success");
          showSendSuccessSplash();
        } catch (e) {
          console.warn("Failed to notify backend:", e);
          setMessage(
            `Escrow created, but SMS could not be sent. Share this claim link manually: ${claimUrl}`
          );
          setStatus("partial_success");
          showSendSuccessSplash();
        }
      } else {
        setMessage(`SOL sent directly to registered wallet!`);
        setStatus("success");
        showSendSuccessSplash();
      }
    } catch (err: any) {
      console.error("Send failed:", err);
      setMessage(err.message || "Transaction failed");
      setStatus("error");
      setSplashPhase("idle");
    }
  }

  return (
    <div className="space-y-4">
      {splashPhase !== "idle" && (
        <div className={`upi-send-splash ${splashPhase === "success" ? "success" : ""}`}>
          <span className="upi-send-wave" />
          <span className="upi-send-wave wave-2" />
          <span className="upi-send-wave wave-3" />
          <span className="upi-send-blob blob-1" />
          <span className="upi-send-blob blob-2" />
          <span className="upi-send-blob blob-3" />
          <span className="upi-send-ring" />
          <span className="upi-send-core">
            {splashPhase === "sending" ? "Sending" : "Paid"}
          </span>
        </div>
      )}

      <section className="upi-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2d5c3d]">
              Pay by Mobile
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#0f2d1c]">
              Send money
            </h2>
            <p className="mt-1 text-xs text-[#3f5f4a]">
              Registered users receive instantly. Others get an OTP claim link.
            </p>
          </div>
          <span className="upi-pill">UPI-like</span>
        </div>
      </section>

      <section className="upi-card space-y-3">
        <div className="flex justify-end">
          <WalletMultiButton />
        </div>

        <div>
          <label className="upi-label">Pay To</label>
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

        <div>
          <label className="upi-label">Amount</label>
          <div className="grid grid-cols-[1fr_1.6fr] gap-2">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="upi-input"
            >
              {FIAT_OPTIONS.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder={currency === "SOL" ? "0.05" : "100"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="upi-input text-lg font-semibold"
            />
          </div>
          <p className="mt-1 text-xs text-[#3f5f4a]">
            {currency === "SOL"
              ? "Recipient receives exactly entered SOL amount."
              : rateLoading
                ? `Loading SOL/${currency} rate...`
                : rateError
                  ? rateError
                  : `~ ${solAmount.toFixed(6)} SOL will be sent (1 SOL = ${solRate.toFixed(2)} ${currency}).`}
          </p>
        </div>

        <button
          onClick={handleSend}
          disabled={
            status === "sending" ||
            !publicKey ||
            (currency !== "SOL" && (!!rateError || rateLoading))
          }
          className="upi-btn-primary"
        >
          {status === "sending" ? "Processing payment..." : "Pay now"}
        </button>
      </section>

      {message && (
        <div
          className={
            status === "error"
              ? "upi-status-error"
              : status === "partial_success"
                ? "upi-status-warn"
                : "upi-status-success"
          }
        >
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
          View transaction on Solana Explorer
        </a>
      )}

      {pendingEscrow && (
        <section className="upi-card space-y-3">
          <h3 className="text-sm font-semibold text-[#123c26]">Pending escrow found</h3>
          <div className="upi-subtle-panel space-y-1.5 text-xs text-[#3f5f4a]">
            <p>Phone: {pendingEscrow.phone}</p>
            <p>Escrow amount: {pendingEscrow.amountSol.toFixed(4)} SOL</p>
            <p>Created: {new Date(pendingEscrow.createdAt * 1000).toLocaleString()}</p>
            <p>
              Refund timer: {formatTimeLeft(pendingEscrow.expiresAt - Math.floor(Date.now() / 1000))}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              onClick={resendClaimSms}
              disabled={isResending}
              className="upi-btn-secondary"
            >
              {isResending ? "Resending SMS..." : "Resend claim SMS"}
            </button>
            <button onClick={copyClaimLink} className="upi-btn-secondary">
              Copy claim link
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
