"use client";

import { useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Transaction } from "@solana/web3.js";
import { CountryCode } from "libphonenumber-js";
import { BACKEND_URL } from "@/lib/constants";
import { getCountryOptions, normalizeToE164 } from "@/lib/phone";

type RegisterState =
  | "idle"
  | "otp_sent"
  | "verifying"
  | "submitting"
  | "success"
  | "error";

export default function RegisterPage() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();

  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<CountryCode>("IN");
  const [otpCode, setOtpCode] = useState("");
  const [state, setState] = useState<RegisterState>("idle");
  const [message, setMessage] = useState("");
  const [txSig, setTxSig] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
  const countryOptions = useMemo(() => getCountryOptions(), []);

  async function handleSendOtp() {
    if (!publicKey) {
      setMessage("Connect your wallet first");
      setState("error");
      return;
    }

    let parsed: string;
    try {
      const e164 = normalizeToE164(phone, country);
      if (!e164) throw new Error("Invalid");
      parsed = e164;
    } catch {
      setMessage("Enter a valid phone number");
      setState("error");
      return;
    }

    setPhoneE164(parsed);

    try {
      const resp = await fetch(`${BACKEND_URL}/otp/send-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: parsed }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to send OTP");
      setState("otp_sent");
    } catch (err: any) {
      setMessage(err.message);
      setState("error");
    }
  }

  async function handleVerifyAndRegister() {
    if (!publicKey || !signTransaction) return;

    setState("verifying");
    try {
      const resp = await fetch(`${BACKEND_URL}/otp/verify-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneE164,
          code: otpCode,
          wallet: publicKey.toString(),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Verification failed");

      setState("submitting");

      const tx = Transaction.from(Buffer.from(data.transaction, "base64"));
      const signedTx = await signTransaction(tx);

      const sig = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(sig, "confirmed");

      setTxSig(sig);
      setState("success");
    } catch (err: any) {
      console.error("Register failed:", err);
      setMessage(err.message || "Registration failed");
      setState("error");
    }
  }

  return (
    <div className="space-y-4">
      <section className="upi-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2d5c3d]">
          UPI Setup
        </p>
        <h2 className="mt-1 text-xl font-semibold text-[#0f2d1c]">
          Register your mobile
        </h2>
        <p className="mt-1 text-xs text-[#3f5f4a]">
          Link phone + wallet to receive direct payments without escrow.
        </p>
      </section>

      <section className="upi-card space-y-3">
        <div className="flex justify-end">
          <WalletMultiButton />
        </div>

        {state === "idle" || state === "error" ? (
          <div className="space-y-3">
            <div>
              <label className="upi-label">Mobile Number</label>
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
              onClick={handleSendOtp}
              disabled={!publicKey}
              className="upi-btn-primary"
            >
              Send OTP
            </button>
          </div>
        ) : null}

        {state === "otp_sent" && (
          <div className="space-y-3">
            <p className="upi-subtle-panel text-xs text-[#3f5f4a]">
              Enter the 6-digit code sent to your number.
            </p>
            <input
              type="text"
              maxLength={6}
              placeholder="123456"
              value={otpCode}
              onChange={(e) =>
                setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="upi-input text-center text-2xl tracking-[0.25em]"
              autoFocus
            />
            <button
              onClick={handleVerifyAndRegister}
              disabled={otpCode.length !== 6}
              className="upi-btn-primary"
            >
              Verify & Register
            </button>
          </div>
        )}

        {(state === "verifying" || state === "submitting") && (
          <div className="upi-subtle-panel py-8 text-center text-sm text-[#3f5f4a]">
            {state === "verifying"
              ? "Verifying OTP..."
              : "Submitting registration..."}
          </div>
        )}

        {state === "success" && (
          <div className="space-y-3">
            <div className="upi-status-success">
              Registration complete. Payments to this mobile now settle instantly.
            </div>
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
        )}

        {state === "error" && message && (
          <div className="upi-status-error">{message}</div>
        )}
      </section>
    </div>
  );
}
