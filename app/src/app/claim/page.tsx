"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SendTransactionError,
  Transaction,
} from "@solana/web3.js";
import { CountryCode } from "libphonenumber-js";
import { BACKEND_URL } from "@/lib/constants";
import { downloadSecretKey, generateClaimKeypair } from "@/lib/walletless";
import { getCountryOptions, normalizeToE164 } from "@/lib/phone";

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

interface EscrowData {
  amount: number;
  sender: string;
}

type ClaimMode = "connect" | "generated";

export default function ClaimPage() {
  return (
    <Suspense
      fallback={
        <div className="upi-card text-center text-sm text-[#3f5f4a]">Loading claim page...</div>
      }
    >
      <ClaimPageContent />
    </Suspense>
  );
}

function ClaimPageContent() {
  const searchParams = useSearchParams();
  const escrowAddress = searchParams.get("escrow");
  const claimPhone = searchParams.get("phone");

  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();

  const [state, setState] = useState<ClaimState>("loading");
  const [claimMode, setClaimMode] = useState<ClaimMode | null>(null);
  const [escrowData, setEscrowData] = useState<EscrowData | null>(null);
  const [generatedKeypair, setGeneratedKeypair] = useState<Keypair | null>(null);
  const [keyDownloaded, setKeyDownloaded] = useState(false);
  const [country, setCountry] = useState<CountryCode>("IN");
  const [otpCode, setOtpCode] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [message, setMessage] = useState("");
  const [txSig, setTxSig] = useState("");
  const countryOptions = useMemo(() => getCountryOptions(), []);
  const claimantWallet =
    claimMode === "generated" ? generatedKeypair?.publicKey ?? null : publicKey;

  useEffect(() => {
    if (!escrowAddress) {
      setMessage("No escrow address provided");
      setState("error");
      return;
    }
    loadEscrow();
  }, [escrowAddress]);

  async function loadEscrow() {
    try {
      const pubkey = new PublicKey(escrowAddress!);
      const info = await connection.getAccountInfo(pubkey);
      if (!info) {
        setState("already_claimed");
        return;
      }

      // Decode escrow data manually (discriminator 8 + sender 32 + phone_hash 32 + amount 8 + created_at 8 + bump 1)
      const data = info.data;
      const sender = new PublicKey(data.slice(8, 40));
      const amountBuf = data.slice(72, 80);
      const amount =
        Number(
          new DataView(amountBuf.buffer, amountBuf.byteOffset).getBigUint64(
            0,
            true
          )
        ) / LAMPORTS_PER_SOL;

      setEscrowData({
        amount,
        sender: sender.toString().slice(0, 8) + "...",
      });
      setState("choose_mode");
    } catch (err: any) {
      setMessage("Failed to load escrow: " + err.message);
      setState("error");
    }
  }

  function resetClaimAttempt() {
    setOtpCode("");
    setMessage("");
    setTxSig("");
  }

  useEffect(() => {
    if (state === "connect_wallet" && publicKey && claimMode === "connect") {
      setState("otp_prompt");
    }
  }, [publicKey, state, claimMode]);

  function chooseConnectWalletMode() {
    resetClaimAttempt();
    setClaimMode("connect");
    setGeneratedKeypair(null);
    setKeyDownloaded(false);
    setState(publicKey ? "otp_prompt" : "connect_wallet");
  }

  function chooseGeneratedMode() {
    resetClaimAttempt();
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
        const e164 = normalizeToE164(manualPhone, country);
        if (!e164) throw new Error("Enter a valid phone number");
        phonePayload = e164;
      }

      const resp = await fetch(`${BACKEND_URL}/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          escrow_address: escrowAddress,
          ...(phonePayload ? { phone: phonePayload } : {}),
        }),
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
      if (!phonePayload && manualPhone) {
        const e164 = normalizeToE164(manualPhone, country);
        if (e164) phonePayload = e164;
      }

      // Verify OTP and get partially-signed transaction
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

      // Deserialize transaction
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
        if (logs?.length) {
          console.error("Claim simulation logs:", logs);
        }
      }
      const raw = String(err?.message || "Claim failed");
      if (
        raw.includes("unknown signer") ||
        raw.includes("Unknown signer") ||
        raw.includes("signature verification")
      ) {
        setMessage("Signer mismatch. Reconnect wallet and try again.");
      } else if (
        raw.includes("Attempt to debit an account but found no record of a prior credit")
      ) {
        setMessage(
          "Gas sponsor wallet is missing or unfunded on this cluster. Please contact support to fund the claim authority."
        );
      } else {
        setMessage(raw);
      }
      setState("error");
    }
  }

  if (!escrowAddress) {
    return (
      <div className="upi-status-error text-center">
        <p>Invalid claim link. No escrow address provided.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="upi-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2d5c3d]">
          Claim Payment
        </p>
        <h2 className="mt-1 text-xl font-semibold text-[#0f2d1c]">Receive escrow</h2>
      </section>

      {/* Loading */}
      {state === "loading" && (
        <div className="upi-card text-center text-sm text-[#3f5f4a]">
          Loading escrow details...
        </div>
      )}

      {/* Already claimed */}
      {state === "already_claimed" && (
        <div className="upi-status-warn">
          This escrow has already been claimed or refunded.
        </div>
      )}

      {/* Escrow info */}
      {escrowData && state !== "loading" && state !== "already_claimed" && (
        <div className="upi-card">
          <p className="text-lg font-semibold text-[#0f5a34]">
            {escrowData.amount.toFixed(4)} SOL waiting for you
          </p>
          <p className="mt-1 text-sm text-[#3f5f4a]">
            From: {escrowData.sender}
          </p>
        </div>
      )}

      {/* Choose mode */}
      {state === "choose_mode" && (
        <section className="upi-card space-y-3">
          <p className="text-sm text-[#3f5f4a]">
            Choose how you want to claim this escrow.
          </p>
          <button
            onClick={chooseConnectWalletMode}
            className="upi-btn-primary"
          >
            I already have a wallet
          </button>
          <button
            onClick={chooseGeneratedMode}
            className="upi-btn-secondary"
          >
            I don't have a wallet (create one for me)
          </button>
        </section>
      )}

      {/* Connect wallet */}
      {state === "connect_wallet" && (
        <section className="upi-card space-y-4">
          <p className="text-sm text-[#3f5f4a]">
            Connect your wallet to continue claiming this escrow.
          </p>
          <div className="flex justify-center">
            <WalletMultiButton />
          </div>
        </section>
      )}

      {/* Generated wallet details */}
      {state === "generated_wallet_ready" && generatedKeypair && (
        <section className="upi-card space-y-3">
          <p className="text-sm text-[#3f5f4a]">
            A new wallet was generated in your browser. Download the keypair now.
          </p>
          <p className="upi-status-warn text-xs">
            Important: If you lose this keypair file, you will lose access to this wallet forever.
          </p>
          <div className="upi-subtle-panel">
            <p className="mb-1 text-xs text-[#3f5f4a]">Generated wallet address</p>
            <p className="break-all font-mono text-sm text-[#0f5a34]">
              {generatedKeypair.publicKey.toString()}
            </p>
          </div>
          <button
            onClick={handleDownloadKeypair}
            className="upi-btn-primary"
          >
            Download keypair
          </button>
          <button
            onClick={() => setState("otp_prompt")}
            disabled={!keyDownloaded}
            className="upi-btn-secondary"
          >
            {keyDownloaded ? "Continue to OTP" : "Download keypair to continue"}
          </button>
          <button
            onClick={() => setState("choose_mode")}
            className="upi-btn-secondary"
          >
            Back
          </button>
        </section>
      )}

      {/* OTP prompt */}
      {state === "otp_prompt" && (
        <section className="upi-card space-y-3">
          {!claimPhone && (
            <div>
              <label className="upi-label">
                Phone Number
              </label>
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
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  className="upi-input"
                />
              </div>
            </div>
          )}
          <p className="text-sm text-[#3f5f4a]">
            We'll send a verification code to the phone number on file.
          </p>
          <button
            onClick={handleSendOtp}
            className="upi-btn-primary"
          >
            Send me the code
          </button>
        </section>
      )}

      {/* OTP input */}
      {state === "otp_input" && (
        <section className="upi-card space-y-3">
          <p className="text-sm text-[#3f5f4a]">
            Enter the 6-digit code sent to your phone:
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
            onClick={handleVerifyAndClaim}
            disabled={otpCode.length !== 6}
            className="upi-btn-primary"
          >
            Verify & Claim
          </button>
        </section>
      )}

      {/* Submitting */}
      {state === "submitting" && (
        <div className="upi-card text-center text-sm text-[#3f5f4a]">
          Submitting claim transaction...
        </div>
      )}

      {/* Success */}
      {state === "success" && (
        <section className="upi-card space-y-3">
          <div className="upi-status-success">
            You received {escrowData?.amount.toFixed(4)} SOL!
          </div>

          {claimantWallet && (
            <p className="text-sm text-[#3f5f4a]">
              Wallet:{" "}
              <span className="font-mono text-[#0f5a34]">
                {claimantWallet.toString()}
              </span>
            </p>
          )}

          {txSig && (
            <a
              href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="upi-link-chip"
            >
              View on Solana Explorer
            </a>
          )}
        </section>
      )}

      {/* Error */}
      {state === "error" && message && (
        <section className="upi-card space-y-3">
          <div className="upi-status-error">{message}</div>
          <button
            onClick={() => {
              setMessage("");
              if (claimMode === "generated") {
                setState("otp_prompt");
              } else {
                setState(publicKey ? "otp_prompt" : "connect_wallet");
              }
            }}
            className="upi-btn-secondary"
          >
            Try again
          </button>
        </section>
      )}
    </div>
  );
}
