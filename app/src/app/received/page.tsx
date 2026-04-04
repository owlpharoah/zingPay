"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { CountryCode } from "libphonenumber-js";
import { BACKEND_URL } from "@/lib/constants";
import { getCountryOptions, normalizeToE164 } from "@/lib/phone";

type IncomingEscrow = {
  escrow: string;
  sender: string;
  amountSol: number;
  createdAt: number;
  expired: boolean;
};

const ESCROW_ACCOUNT_LEN = 89;
const ESCROW_EXPIRY_SECONDS = 72 * 3600;

export default function ReceivedPage() {
  const [country, setCountry] = useState<CountryCode>("IN");
  const [phone, setPhone] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [status, setStatus] = useState<
    "idle" | "otp_sending" | "otp_input" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState<IncomingEscrow[]>([]);
  const countryOptions = useMemo(() => getCountryOptions(), []);

  async function handleSendOtp() {
    let normalized: string;
    try {
      const e164 = normalizeToE164(phone, country);
      if (!e164) throw new Error("Invalid");
      normalized = e164;
    } catch {
      setStatus("error");
      setMessage("Enter a valid phone number");
      return;
    }

    setStatus("otp_sending");
    setMessage("");
    setRows([]);

    try {
      const resp = await fetch(`${BACKEND_URL}/received/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Failed to send OTP");
      }

      setPhoneE164(normalized);
      setStatus("otp_input");
      setMessage("OTP sent. Enter the code to view received escrows.");
    } catch (err: any) {
      setStatus("error");
      setMessage(String(err?.message || "Failed to send OTP"));
    }
  }

  async function handleVerifyAndLookup() {
    if (!phoneE164) {
      setStatus("error");
      setMessage("Send OTP first");
      return;
    }
    if (otpCode.length !== 6) {
      setStatus("error");
      setMessage("Enter a valid 6-digit code");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const resp = await fetch(`${BACKEND_URL}/received/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneE164, code: otpCode }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Lookup failed");
      }

      const now = Math.floor(Date.now() / 1000);
      const list: IncomingEscrow[] = (data.escrows || []).map((e: any) => ({
        escrow: String(e.escrow),
        sender: String(e.sender),
        amountSol: Number(e.amountLamports) / LAMPORTS_PER_SOL,
        createdAt: Number(e.createdAt),
        expired:
          typeof e.expired === "boolean"
            ? e.expired
            : now > Number(e.createdAt) + ESCROW_EXPIRY_SECONDS,
      }));

      setRows(list);
      setStatus("success");
      if (list.length === 0) {
        setMessage("No active escrow sends found for this phone number.");
      }
    } catch (err: any) {
      setStatus("error");
      setMessage(String(err?.message || "Failed to load received history"));
    }
  }

  return (
    <div className="space-y-4">
      <section className="upi-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2d5c3d]">
          Payment Inbox
        </p>
        <h2 className="mt-1 text-xl font-semibold text-[#0f2d1c]">
          Received escrows
        </h2>
        <p className="mt-1 text-xs text-[#3f5f4a]">
          Verify OTP to see pending incoming transfers by mobile number.
        </p>
      </section>

      <section className="upi-card space-y-3">
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
          disabled={status === "otp_sending" || status === "loading"}
          className="upi-btn-primary"
        >
          {status === "otp_sending" ? "Sending OTP..." : "Send OTP"}
        </button>

        {status === "otp_input" || status === "loading" || status === "success" ? (
          <>
            <input
              type="text"
              maxLength={6}
              placeholder="123456"
              value={otpCode}
              onChange={(e) =>
                setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="upi-input text-center text-2xl tracking-[0.25em]"
            />
            <button
              onClick={handleVerifyAndLookup}
              disabled={status === "loading" || otpCode.length !== 6}
              className="upi-btn-secondary"
            >
              {status === "loading" ? "Verifying..." : "Verify & View"}
            </button>
          </>
        ) : null}
      </section>

      {message && (
        <div className={status === "error" ? "upi-status-error" : "upi-status-warn"}>
          {message}
        </div>
      )}

      {rows.length > 0 && (
        <section className="upi-card space-y-2">
          <h3 className="text-sm font-semibold text-[#123c26]">Incoming list</h3>
          {rows.map((row) => (
            <div
              key={row.escrow}
              className="upi-subtle-panel"
            >
              <p className="text-xs text-[#3f5f4a]">
                Sender: <span className="font-mono text-[#0f5a34]">{row.sender}</span>
              </p>
              <p className="mt-1 text-sm font-semibold text-[#123c26]">
                {row.amountSol.toFixed(4)} SOL
              </p>
              <p className="mt-0.5 text-xs text-[#55705e]">
                {new Date(row.createdAt * 1000).toLocaleString()}
              </p>
              <p className="mt-1 text-xs font-medium text-[#0f5a34]">
                {row.expired ? "Expired (sender can refund)" : "Claimable now"}
              </p>
              <Link
                href={`/claim?escrow=${row.escrow}`}
                prefetch
                className="mt-2 inline-block text-xs font-semibold text-[#0f5a34]"
              >
                Open claim flow
              </Link>
            </div>
          ))}
        </section>
      )}

      <p className="px-1 text-[11px] text-[#55705e]">
        Note: Direct transfers to already-registered wallets are not shown in this list.
      </p>
    </div>
  );
}
