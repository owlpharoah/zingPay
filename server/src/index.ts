import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import twilio from "twilio";
import fs from "fs";
import path from "path";
import crypto from "crypto";

dotenv.config();

// ============================================================
// Config
// ============================================================

const PORT = parseInt(process.env.PORT || "3001");
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey(
  process.env.PROGRAM_ID || "3mxRLcYoNynggNLDtpe9iZXMBoomYXQQPFHVAapzc3iZ",
);
const USDC_MINT = new PublicKey(
  process.env.USDC_MINT || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);
// Provider's USDC token account (receives swap fee carve-out)
const PROVIDER_USDC_ATA = new PublicKey(
  process.env.PROVIDER_USDC_ATA || "DbQYAzzdGajKZPJV4brtGy6d9UWbDEUjpDTeWyxCKrtg",
);
const APP_URL = process.env.APP_URL || "http://localhost:3000";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "http://localhost:3000";
const EXPECTED_CLAIM_AUTHORITY = new PublicKey(
  process.env.EXPECTED_CLAIM_AUTHORITY ||
    "5JWiQfGELyHtntzkiDgs57PGTHgAFQ3D5ia5S6RdJjpz",
);

const SOL_USD_FEED_ID =
  "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
const PYTH_HERMES_URL = `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${SOL_USD_FEED_ID}`;

if (!process.env.CLAIM_AUTHORITY_KEYPAIR) {
  throw new Error(
    "CLAIM_AUTHORITY_KEYPAIR is required. Gasless claim cannot work without it.",
  );
}

const claimAuthority = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(process.env.CLAIM_AUTHORITY_KEYPAIR)),
);

if (!claimAuthority.publicKey.equals(EXPECTED_CLAIM_AUTHORITY)) {
  throw new Error(
    `Claim authority mismatch. Expected ${EXPECTED_CLAIM_AUTHORITY.toBase58()}, got ${claimAuthority.publicKey.toBase58()}`,
  );
}

const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;
const TWILIO_VERIFY_SID = process.env.TWILIO_VERIFY_SID || "";
const TWILIO_SMS_FROM = process.env.TWILIO_SMS_FROM || "";

function getNotifyConfig(): {
  client: NonNullable<typeof twilioClient>;
  from: string;
} {
  if (!twilioClient || !TWILIO_VERIFY_SID) {
    throw new Error("Twilio is not configured");
  }
  return { client: twilioClient, from: TWILIO_SMS_FROM };
}

function normalizePhoneForTwilio(phone: string): string {
  const trimmed = String(phone || "").trim();
  if (trimmed.startsWith("+")) return trimmed;
  return `+${trimmed.replace(/\D/g, "")}`;
}

function twilioErrorMessage(err: any, fallback: string): string {
  const code = err?.code ? ` [Twilio ${err.code}]` : "";
  const detail = err?.message ? ` ${err.message}` : "";
  let hint = "";
  if (err?.code === 21608) hint = " (Trial: must be a verified recipient number.)";
  else if (err?.code === 21211) hint = " (Phone must be in E.164 format.)";
  else if (err?.code === 60200 || err?.code === 60203)
    hint = " (Verify service or destination not allowed for this account/region.)";
  return `${fallback}${code}.${detail}${hint}`.trim();
}

// ============================================================
// Account size constants
// ============================================================

const ESCROW_NATIVE_SIZE = 89;    // 8+32+32+8+8+1
const ESCROW_TOKEN_SIZE = 121;    // 8+32+32+8+8+32+1
const REGISTRY_ACCOUNT_SIZE = 73; // 8+32+32+1
const ATA_SIZE = 165;

// ============================================================
// Solana setup
// ============================================================

const connection = new Connection(RPC_URL, "confirmed");

const idlPath = path.join(__dirname, "..", "idl", "solpay.json");
let idl: any;
try {
  idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
} catch {
  console.warn("IDL not found at", idlPath, "— some features will fail.");
}

const wallet = new anchor.Wallet(claimAuthority);
const provider = new anchor.AnchorProvider(connection, wallet, {
  commitment: "confirmed",
});
let program: anchor.Program;
if (idl) {
  program = new anchor.Program(idl, provider);
}

// ============================================================
// In-memory state
// ============================================================

// phone_hash (hex) → { phone, escrow_address }
const notifyMap = new Map<string, { phone: string; escrow: string }>();
// escrow_address → phone
const escrowMap = new Map<string, string>();
// rate limiting: key → { count, resetAt }
const otpRateLimit = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = otpRateLimit.get(key);
  if (!entry || now > entry.resetAt) {
    otpRateLimit.set(key, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 3) return false;
  entry.count++;
  return true;
}

// ============================================================
// Helpers
// ============================================================

async function fetchSolUsdPrice(): Promise<{ price: bigint; expo: number }> {
  const res = await fetch(PYTH_HERMES_URL);
  if (!res.ok) throw new Error(`Pyth fetch failed: ${res.status}`);
  const data: any = await res.json();
  const parsed = data.parsed[0].price;
  return { price: BigInt(parsed.price), expo: Number(parsed.expo) };
}

function calculateSwapTokens(
  solLamports: bigint,
  price: bigint,
  expo: number,
): bigint {
  if (price <= 0n) throw new Error("Invalid Pyth price");
  if (expo > 0) throw new Error("Unexpected positive exponent");
  const absExp = BigInt(-expo);
  let scale = 1n;
  for (let i = 0n; i < absExp; i++) scale *= 10n;
  const numerator = solLamports * price * 1_000_000n;
  const denominator = 1_000_000_000n * scale;
  return (numerator + denominator - 1n) / denominator;
}

async function fetchTx4Fee(): Promise<bigint> {
  const { blockhash } = await connection.getLatestBlockhash();
  const testTx = new Transaction({
    recentBlockhash: blockhash,
    feePayer: claimAuthority.publicKey,
  }).add(
    SystemProgram.transfer({
      fromPubkey: claimAuthority.publicKey,
      toPubkey: claimAuthority.publicKey,
      lamports: 0,
    }),
  );
  const feeResponse = await connection.getFeeForMessage(testTx.compileMessage());
  const baseFee = BigInt(feeResponse.value ?? 5000);
  return (baseFee * 120n) / 100n;
}

function parseNativeEscrow(data: Buffer): {
  sender: PublicKey;
  phoneHash: Uint8Array;
  amount: bigint;
  createdAt: bigint;
} {
  return {
    sender: new PublicKey(data.subarray(8, 40)),
    phoneHash: Uint8Array.from(data.subarray(40, 72)),
    amount: data.readBigUInt64LE(72),
    createdAt: data.readBigInt64LE(80),
  };
}

function parseTokenEscrow(data: Buffer): {
  sender: PublicKey;
  phoneHash: Uint8Array;
  amount: bigint;
  createdAt: bigint;
  mint: PublicKey;
} {
  return {
    sender: new PublicKey(data.subarray(8, 40)),
    phoneHash: Uint8Array.from(data.subarray(40, 72)),
    amount: data.readBigUInt64LE(72),
    createdAt: data.readBigInt64LE(80),
    mint: new PublicKey(data.subarray(88, 120)),
  };
}

function getAta(owner: PublicKey, mint: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, owner, true);
}

function getEscrowTokenPda(
  sender: PublicKey,
  phoneHash: Uint8Array,
  mint: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("escrow_token"),
      sender.toBuffer(),
      Buffer.from(phoneHash),
      mint.toBuffer(),
    ],
    PROGRAM_ID,
  )[0];
}

function getRegistryPda(phoneHash: Uint8Array): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("registry"), Buffer.from(phoneHash)],
    PROGRAM_ID,
  )[0];
}

async function resolvePhoneForEscrow(
  escrowAddress: string,
  phoneFromRequest?: string,
): Promise<string | null> {
  const mapped = escrowMap.get(escrowAddress);
  if (mapped) return mapped;
  if (!phoneFromRequest) return null;
  try {
    const escrowPubkey = new PublicKey(escrowAddress);
    const accountInfo = await connection.getAccountInfo(escrowPubkey);
    if (!accountInfo) return null;
    const data = accountInfo.data;
    let onChainPhoneHash: Buffer;
    if (data.length === ESCROW_NATIVE_SIZE || data.length === ESCROW_TOKEN_SIZE) {
      onChainPhoneHash = Buffer.from(data.subarray(40, 72));
    } else {
      return null;
    }
    const requestPhoneHash = crypto
      .createHash("sha256")
      .update(phoneFromRequest, "utf8")
      .digest();
    if (!onChainPhoneHash.equals(requestPhoneHash)) return null;
    escrowMap.set(escrowAddress, phoneFromRequest);
    return phoneFromRequest;
  } catch {
    return null;
  }
}

async function ensureClaimSponsorshipCapacity(): Promise<void> {
  const balance = await connection.getBalance(claimAuthority.publicKey);
  const minRequired = 10_000_000; // 0.01 SOL
  if (balance < minRequired) {
    throw new Error(
      `Claim authority balance too low (${balance} lamports). Need >= ${minRequired} lamports.`,
    );
  }
}

// ============================================================
// Express app
// ============================================================

const app = express();
app.use(express.json());
app.use(cors({ origin: ALLOWED_ORIGIN, methods: ["POST", "GET"] }));

app.get("/health", async (_req, res) => {
  const balance = await connection.getBalance(claimAuthority.publicKey);
  res.json({
    status: "ok",
    programId: PROGRAM_ID.toString(),
    claimAuthority: claimAuthority.publicKey.toBase58(),
    claimAuthorityBalanceLamports: balance,
  });
});

// ============================================================
// POST /notify
// ============================================================

app.post("/notify", async (req, res) => {
  try {
    const { client, from } = getNotifyConfig();
    const { phone, phone_hash, escrow_address, token, symbol, amount_ui } = req.body;

    if (!phone || !phone_hash || !escrow_address) {
      return res
        .status(400)
        .json({ error: "Missing phone, phone_hash, or escrow_address" });
    }

    try {
      const accountInfo = await connection.getAccountInfo(
        new PublicKey(escrow_address),
      );
      if (!accountInfo) {
        return res
          .status(400)
          .json({ error: "Escrow account does not exist on-chain" });
      }
    } catch {
      return res.status(400).json({ error: "Invalid escrow address" });
    }

    notifyMap.set(phone_hash, { phone, escrow: escrow_address });
    escrowMap.set(escrow_address, phone);
    setTimeout(
      () => {
        notifyMap.delete(phone_hash);
        escrowMap.delete(escrow_address);
      },
      73 * 3600 * 1000,
    );

    const claimUrl = `${APP_URL}/claim?escrow=${escrow_address}&phone=${encodeURIComponent(phone)}`;
    const to = normalizePhoneForTwilio(phone);

    let amountText: string;
    if (token && amount_ui && symbol) {
      amountText = `${amount_ui} ${symbol}`;
    } else if (amount_ui) {
      amountText = `${amount_ui} SOL`;
    } else {
      amountText = "SOL";
    }

    await client.messages.create({
      from,
      to,
      body: `You received ${amountText}! Claim it here: ${claimUrl}\nExpires in 72 hours.`,
    });

    console.log(`[notify] SMS sent to ${to} for escrow ${escrow_address}`);
    res.json({ ok: true });
  } catch (err: any) {
    const detail = err?.message || "Unknown error";
    const code = err?.code ? ` (code ${err.code})` : "";
    console.error("[notify] Error:", detail, code);
    res
      .status(500)
      .json({ error: `Failed to send notification: ${detail}${code}` });
  }
});

// ============================================================
// POST /otp/send
// ============================================================

app.post("/otp/send", async (req, res) => {
  try {
    if (!twilioClient || !TWILIO_VERIFY_SID) {
      return res.status(503).json({ error: "Twilio is not configured" });
    }

    const { escrow_address, phone } = req.body;
    if (!escrow_address) {
      return res.status(400).json({ error: "Missing escrow_address" });
    }

    const resolvedPhone = await resolvePhoneForEscrow(escrow_address, phone);
    if (!resolvedPhone) {
      return res.status(404).json({
        error:
          "Escrow phone not found. Use the latest claim link or provide the original phone number.",
      });
    }

    if (!checkRateLimit(escrow_address)) {
      return res
        .status(429)
        .json({ error: "Too many OTP requests. Try again in 10 minutes." });
    }

    const to = normalizePhoneForTwilio(resolvedPhone);
    await twilioClient.verify.v2
      .services(TWILIO_VERIFY_SID)
      .verifications.create({ to, channel: "sms" });

    console.log(`[otp/send] OTP sent for escrow ${escrow_address} to ${to}`);
    res.json({ ok: true });
  } catch (err: any) {
    const msg = twilioErrorMessage(err, "Failed to send OTP");
    console.error("[otp/send] Error:", msg);
    res.status(500).json({ error: msg });
  }
});

// ============================================================
// POST /otp/verify
//
// Verifies OTP for a claim. Detects escrow type by account size:
//   89 bytes  → native SOL (EscrowAccount)
//   121 bytes → USDC token (EscrowTokenState)
//
// Both txs are partial-signed by claimAuthority. Frontend signs
// both as claimant (signAllTransactions for wallet, silent for
// generated keypair) then submits tx1, waits, submits tx2.
//
// Response (native): { transaction, register_transaction }
// Response (token):  { transaction, register_transaction, type: "token", escrow_amount_ui }
// ============================================================

app.post("/otp/verify", async (req, res) => {
  try {
    if (!twilioClient || !TWILIO_VERIFY_SID) {
      return res.status(503).json({ error: "Twilio is not configured" });
    }

    const { escrow_address, code, claimant_wallet, phone } = req.body;
    if (!escrow_address || !code || !claimant_wallet) {
      return res
        .status(400)
        .json({ error: "Missing escrow_address, code, or claimant_wallet" });
    }

    const resolvedPhone = await resolvePhoneForEscrow(escrow_address, phone);
    if (!resolvedPhone) {
      return res.status(404).json({ error: "Escrow phone not found" });
    }

    const check = await twilioClient.verify.v2
      .services(TWILIO_VERIFY_SID)
      .verificationChecks.create({
        to: normalizePhoneForTwilio(resolvedPhone),
        code,
      });

    if (check.status !== "approved") {
      return res.status(400).json({ error: "Invalid OTP code" });
    }

    if (!program) {
      return res.status(500).json({ error: "Program IDL not loaded" });
    }

    await ensureClaimSponsorshipCapacity();

    const escrowPubkey = new PublicKey(escrow_address);
    const claimantPubkey = new PublicKey(claimant_wallet);
    const accountInfo = await connection.getAccountInfo(escrowPubkey);
    if (!accountInfo) {
      return res.status(404).json({ error: "Escrow account not found on-chain" });
    }

    const { blockhash } = await connection.getLatestBlockhash();

    if (accountInfo.data.length === ESCROW_NATIVE_SIZE) {
      // ── Native SOL escrow ──────────────────────────────────────────────
      const parsed = parseNativeEscrow(accountInfo.data);
      const phoneHashArray = Array.from(parsed.phoneHash);
      const registryPda = getRegistryPda(parsed.phoneHash);

      const tx1 = new Transaction({
        recentBlockhash: blockhash,
        feePayer: claimAuthority.publicKey,
      });
      tx1.add(
        await program.methods
          .claimEscrow(phoneHashArray)
          .accounts({
            claimAuthority: claimAuthority.publicKey,
            claimant: claimantPubkey,
            sender: parsed.sender,
            escrow: escrowPubkey,
            systemProgram: SystemProgram.programId,
          })
          .instruction(),
      );
      tx1.partialSign(claimAuthority);

      const tx2 = new Transaction({
        recentBlockhash: blockhash,
        feePayer: claimAuthority.publicKey,
      });
      tx2.add(
        await program.methods
          .registerPhone(phoneHashArray, claimantPubkey)
          .accounts({
            owner: claimantPubkey,
            claimAuthority: claimAuthority.publicKey,
            registry: registryPda,
            systemProgram: SystemProgram.programId,
          })
          .instruction(),
      );
      tx2.partialSign(claimAuthority);

      console.log(
        `[otp/verify] Native claim txs built for ${escrow_address} amount=${parsed.amount}`,
      );
      return res.json({
        transaction: tx1
          .serialize({ requireAllSignatures: false })
          .toString("base64"),
        register_transaction: tx2
          .serialize({ requireAllSignatures: false })
          .toString("base64"),
      });
    } else if (accountInfo.data.length === ESCROW_TOKEN_SIZE) {
      // ── Token (USDC) escrow ────────────────────────────────────────────
      const parsed = parseTokenEscrow(accountInfo.data);
      const phoneHashArray = Array.from(parsed.phoneHash);
      const registryPda = getRegistryPda(parsed.phoneHash);

      const { price, expo } = await fetchSolUsdPrice();
      const tx4Fee = await fetchTx4Fee();

      const rentExemptAta = BigInt(
        await connection.getMinimumBalanceForRentExemption(ATA_SIZE),
      );
      const rentExemptRegistry = BigInt(
        await connection.getMinimumBalanceForRentExemption(REGISTRY_ACCOUNT_SIZE),
      );
      const rentExemptWallet = BigInt(
        await connection.getMinimumBalanceForRentExemption(0),
      );
      const totalSolRecovery =
        rentExemptAta + rentExemptRegistry + rentExemptWallet + tx4Fee * 2n;

      const swapAmountTokens = calculateSwapTokens(totalSolRecovery, price, expo);

      if (parsed.amount <= swapAmountTokens) {
        return res.status(400).json({
          error:
            "Token escrow amount too small to cover provider fees. Ask sender to refund and resend a higher amount.",
        });
      }

      const netClaimantTokens = parsed.amount - swapAmountTokens;
      const escrowTokenPda = getEscrowTokenPda(
        parsed.sender,
        parsed.phoneHash,
        parsed.mint,
      );
      const escrowVaultAta = getAta(escrowTokenPda, parsed.mint);
      const claimantTokenAta = getAta(claimantPubkey, parsed.mint);

      // claimAuthority doubles as providerNative (same key)
      const tx1 = new Transaction({
        recentBlockhash: blockhash,
        feePayer: claimAuthority.publicKey,
      });
      tx1.add(
        await program.methods
          .claimEscrowToken(
            phoneHashArray,
            new anchor.BN(swapAmountTokens.toString()),
            new anchor.BN(tx4Fee.toString()),
          )
          .accounts({
            claimAuthority: claimAuthority.publicKey,
            claimant: claimantPubkey,
            sender: parsed.sender,
            escrowTokenState: escrowTokenPda,
            mint: parsed.mint,
            escrowToken: escrowVaultAta,
            claimantToken: claimantTokenAta,
            providerToken: PROVIDER_USDC_ATA,
            providerNative: claimAuthority.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction(),
      );
      tx1.partialSign(claimAuthority);

      const tx2 = new Transaction({
        recentBlockhash: blockhash,
        feePayer: claimAuthority.publicKey,
      });
      tx2.add(
        await program.methods
          .registerPhone(phoneHashArray, claimantPubkey)
          .accounts({
            owner: claimantPubkey,
            claimAuthority: claimAuthority.publicKey,
            registry: registryPda,
            systemProgram: SystemProgram.programId,
          })
          .instruction(),
      );
      tx2.partialSign(claimAuthority);

      const netUi = (Number(netClaimantTokens) / 1_000_000).toFixed(6);
      console.log(
        `[otp/verify] Token claim txs built for ${escrow_address} ` +
          `swap=${swapAmountTokens} net=${netClaimantTokens} (${netUi} USDC)`,
      );
      return res.json({
        transaction: tx1
          .serialize({ requireAllSignatures: false })
          .toString("base64"),
        register_transaction: tx2
          .serialize({ requireAllSignatures: false })
          .toString("base64"),
        type: "token",
        escrow_amount_ui: netUi,
      });
    } else {
      return res.status(400).json({
        error: `Unexpected escrow account size: ${accountInfo.data.length}`,
      });
    }
  } catch (err: any) {
    const msg = String(err?.message || "Failed to build claim transaction");
    console.error("[otp/verify] Error:", msg);
    res.status(500).json({ error: msg });
  }
});

// ============================================================
// POST /otp/send-register
// ============================================================

app.post("/otp/send-register", async (req, res) => {
  try {
    if (!twilioClient || !TWILIO_VERIFY_SID) {
      return res.status(503).json({ error: "Twilio is not configured" });
    }

    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "Missing phone" });
    }

    if (!checkRateLimit(`register:${phone}`)) {
      return res
        .status(429)
        .json({ error: "Too many OTP requests. Try again in 10 minutes." });
    }

    const to = normalizePhoneForTwilio(phone);
    await twilioClient.verify.v2
      .services(TWILIO_VERIFY_SID)
      .verifications.create({ to, channel: "sms" });

    console.log(`[otp/send-register] OTP sent to ${to}`);
    res.json({ ok: true });
  } catch (err: any) {
    const msg = twilioErrorMessage(err, "Failed to send OTP");
    console.error("[otp/send-register] Error:", msg);
    res.status(500).json({ error: msg });
  }
});

// ============================================================
// POST /otp/verify-register
// ============================================================

app.post("/otp/verify-register", async (req, res) => {
  try {
    if (!twilioClient || !TWILIO_VERIFY_SID) {
      return res.status(503).json({ error: "Twilio is not configured" });
    }

    const { phone, code, wallet } = req.body;
    if (!phone || !code || !wallet) {
      return res.status(400).json({ error: "Missing phone, code, or wallet" });
    }

    const check = await twilioClient.verify.v2
      .services(TWILIO_VERIFY_SID)
      .verificationChecks.create({
        to: normalizePhoneForTwilio(phone),
        code,
      });

    if (check.status !== "approved") {
      return res.status(400).json({ error: "Invalid OTP code" });
    }

    if (!program) {
      return res.status(500).json({ error: "Program IDL not loaded" });
    }

    const walletPubkey = new PublicKey(wallet);
    const phoneHash = crypto.createHash("sha256").update(phone, "utf8").digest();
    const phoneHashArray = Array.from(phoneHash);
    const registryPda = getRegistryPda(new Uint8Array(phoneHash));

    const { blockhash } = await connection.getLatestBlockhash();
    const tx = new Transaction({ recentBlockhash: blockhash, feePayer: walletPubkey });
    tx.add(
      await program.methods
        .registerPhone(phoneHashArray, walletPubkey)
        .accounts({
          owner: walletPubkey,
          claimAuthority: claimAuthority.publicKey,
          registry: registryPda,
          systemProgram: SystemProgram.programId,
        })
        .instruction(),
    );
    tx.partialSign(claimAuthority);

    console.log(`[otp/verify-register] Register tx built for ${phone}`);
    res.json({
      transaction: tx.serialize({ requireAllSignatures: false }).toString("base64"),
    });
  } catch (err: any) {
    console.error("[otp/verify-register] Error:", err.message);
    res.status(500).json({ error: "Failed to build register transaction" });
  }
});

// ============================================================
// POST /otp/verify-change
//
// Verify OTP for new phone, return atomic tx:
//   delete_phone(old_phone_hash) + register_phone(new_phone)
//
// Body:     { old_phone_hash_hex, new_phone, code, wallet }
// Response: { transaction }
//
// Partial-signed by claimAuthority (for register_phone).
// Frontend (wallet) signs as owner for both instructions.
// ============================================================

app.post("/otp/verify-change", async (req, res) => {
  try {
    if (!twilioClient || !TWILIO_VERIFY_SID) {
      return res.status(503).json({ error: "Twilio is not configured" });
    }

    const { old_phone_hash_hex, new_phone, code, wallet } = req.body;
    if (!old_phone_hash_hex || !new_phone || !code || !wallet) {
      return res
        .status(400)
        .json({ error: "Missing old_phone_hash_hex, new_phone, code, or wallet" });
    }

    const check = await twilioClient.verify.v2
      .services(TWILIO_VERIFY_SID)
      .verificationChecks.create({
        to: normalizePhoneForTwilio(new_phone),
        code,
      });

    if (check.status !== "approved") {
      return res.status(400).json({ error: "Invalid OTP code" });
    }

    if (!program) {
      return res.status(500).json({ error: "Program IDL not loaded" });
    }

    const walletPubkey = new PublicKey(wallet);
    const oldPhoneHash = Uint8Array.from(Buffer.from(old_phone_hash_hex, "hex"));
    const oldRegistryPda = getRegistryPda(oldPhoneHash);

    const newPhoneHash = crypto
      .createHash("sha256")
      .update(new_phone, "utf8")
      .digest();
    const newRegistryPda = getRegistryPda(new Uint8Array(newPhoneHash));

    const { blockhash } = await connection.getLatestBlockhash();
    const tx = new Transaction({ recentBlockhash: blockhash, feePayer: walletPubkey });

    // delete_phone: only owner signs (no claimAuthority)
    tx.add(
      await program.methods
        .deletePhone(Array.from(oldPhoneHash))
        .accounts({
          owner: walletPubkey,
          registry: oldRegistryPda,
          systemProgram: SystemProgram.programId,
        })
        .instruction(),
    );

    // register_phone: owner + claimAuthority both sign
    tx.add(
      await program.methods
        .registerPhone(Array.from(newPhoneHash), walletPubkey)
        .accounts({
          owner: walletPubkey,
          claimAuthority: claimAuthority.publicKey,
          registry: newRegistryPda,
          systemProgram: SystemProgram.programId,
        })
        .instruction(),
    );

    tx.partialSign(claimAuthority);

    console.log(`[otp/verify-change] Change phone tx built for wallet ${wallet}`);
    res.json({
      transaction: tx.serialize({ requireAllSignatures: false }).toString("base64"),
    });
  } catch (err: any) {
    console.error("[otp/verify-change] Error:", err.message);
    res.status(500).json({ error: "Failed to build change-phone transaction" });
  }
});

// ============================================================
// POST /received/send-otp
// ============================================================

app.post("/received/send-otp", async (req, res) => {
  try {
    if (!twilioClient || !TWILIO_VERIFY_SID) {
      return res.status(503).json({ error: "Twilio is not configured" });
    }

    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "Missing phone" });
    }

    if (!checkRateLimit(`received:${phone}`)) {
      return res
        .status(429)
        .json({ error: "Too many OTP requests. Try again in 10 minutes." });
    }

    const to = normalizePhoneForTwilio(phone);
    await twilioClient.verify.v2
      .services(TWILIO_VERIFY_SID)
      .verifications.create({ to, channel: "sms" });

    console.log(`[received/send-otp] OTP sent to ${to}`);
    res.json({ ok: true });
  } catch (err: any) {
    const msg = twilioErrorMessage(err, "Failed to send OTP");
    console.error("[received/send-otp] Error:", msg);
    res.status(500).json({ error: msg });
  }
});

// ============================================================
// POST /received/lookup
// Returns all pending native SOL and token escrows for a phone.
// ============================================================

app.post("/received/lookup", async (req, res) => {
  try {
    if (!twilioClient || !TWILIO_VERIFY_SID) {
      return res.status(503).json({ error: "Twilio is not configured" });
    }

    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ error: "Missing phone or code" });
    }

    const check = await twilioClient.verify.v2
      .services(TWILIO_VERIFY_SID)
      .verificationChecks.create({
        to: normalizePhoneForTwilio(phone),
        code,
      });

    if (check.status !== "approved") {
      return res.status(400).json({ error: "Invalid OTP code" });
    }

    const phoneHash = crypto
      .createHash("sha256")
      .update(phone, "utf8")
      .digest();
    const now = Math.floor(Date.now() / 1000);
    const phoneHashEncoded = anchor.utils.bytes.bs58.encode(phoneHash);

    const [nativeAccounts, tokenAccounts] = await Promise.all([
      connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          { dataSize: ESCROW_NATIVE_SIZE },
          { memcmp: { offset: 40, bytes: phoneHashEncoded, encoding: "base58" } },
        ],
      }),
      connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          { dataSize: ESCROW_TOKEN_SIZE },
          { memcmp: { offset: 40, bytes: phoneHashEncoded, encoding: "base58" } },
        ],
      }),
    ]);

    const escrows = [
      ...nativeAccounts.map(({ pubkey, account }) => {
        const raw = account.data;
        return {
          escrow: pubkey.toBase58(),
          sender: new PublicKey(raw.subarray(8, 40)).toBase58(),
          type: "native" as const,
          amountLamports: Number(raw.readBigUInt64LE(72)),
          createdAt: Number(raw.readBigInt64LE(80)),
          expired: now > Number(raw.readBigInt64LE(80)) + 72 * 3600,
        };
      }),
      ...tokenAccounts.map(({ pubkey, account }) => {
        const raw = account.data;
        const createdAt = Number(raw.readBigInt64LE(80));
        return {
          escrow: pubkey.toBase58(),
          sender: new PublicKey(raw.subarray(8, 40)).toBase58(),
          type: "token" as const,
          amount: Number(raw.readBigUInt64LE(72)),
          mint: new PublicKey(raw.subarray(88, 120)).toBase58(),
          createdAt,
          expired: now > createdAt + 72 * 3600,
        };
      }),
    ].sort((a, b) => b.createdAt - a.createdAt);

    res.json({ escrows });
  } catch (err: any) {
    console.error("[received/lookup] Error:", err.message);
    res.status(500).json({ error: "Failed to lookup received history" });
  }
});

// ============================================================
// POST /phone/build-delete-tx
//
// Builds an unsigned delete_phone transaction for the caller.
// No OTP or claim authority needed — delete_phone only requires
// the owner's signature (wallet signs client-side after this call).
//
// Body:     { phone_hash_hex, wallet }
// Response: { transaction }
// ============================================================

app.post("/phone/build-delete-tx", async (req, res) => {
  try {
    const { phone_hash_hex, wallet } = req.body;
    if (!phone_hash_hex || !wallet) {
      return res.status(400).json({ error: "Missing phone_hash_hex or wallet" });
    }

    if (!program) {
      return res.status(500).json({ error: "Program IDL not loaded" });
    }

    const walletPubkey = new PublicKey(wallet);
    const phoneHash = Uint8Array.from(Buffer.from(phone_hash_hex, "hex"));
    const registryPda = getRegistryPda(phoneHash);

    const { blockhash } = await connection.getLatestBlockhash();
    const tx = new Transaction({ recentBlockhash: blockhash, feePayer: walletPubkey });
    tx.add(
      await program.methods
        .deletePhone(Array.from(phoneHash))
        .accounts({
          owner: walletPubkey,
          registry: registryPda,
          systemProgram: SystemProgram.programId,
        })
        .instruction(),
    );

    console.log(`[phone/build-delete-tx] Delete tx built for wallet ${wallet}`);
    res.json({
      transaction: tx.serialize({ requireAllSignatures: false }).toString("base64"),
    });
  } catch (err: any) {
    console.error("[phone/build-delete-tx] Error:", err.message);
    res.status(500).json({ error: "Failed to build delete transaction" });
  }
});

// ============================================================
// Refund cron — every hour, refunds expired native and token escrows
// ============================================================

async function runRefundCron() {
  if (!program) {
    console.warn("[refund-cron] Program not initialized, skipping");
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  let refunded = 0;
  let checked = 0;

  // Native escrows
  try {
    const nativeAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [{ dataSize: ESCROW_NATIVE_SIZE }],
    });
    checked += nativeAccounts.length;

    for (const { pubkey, account } of nativeAccounts) {
      try {
        const escrow = program.coder.accounts.decode("escrowAccount", account.data);
        if (now > (escrow.createdAt as anchor.BN).toNumber() + 72 * 3600) {
          await program.methods
            .refundEscrow()
            .accounts({
              escrow: pubkey,
              sender: escrow.sender as PublicKey,
              systemProgram: SystemProgram.programId,
            })
            .rpc();
          escrowMap.delete(pubkey.toString());
          refunded++;
          console.log(`[refund-cron] Refunded native escrow ${pubkey}`);
        }
      } catch (err: any) {
        console.error(`[refund-cron] Failed native ${pubkey}: ${err.message}`);
      }
    }
  } catch (err: any) {
    console.error("[refund-cron] Native scan error:", err.message);
  }

  // Token escrows — permissionless after expiry, payer = claimAuthority
  try {
    const tokenAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [{ dataSize: ESCROW_TOKEN_SIZE }],
    });
    checked += tokenAccounts.length;

    for (const { pubkey, account } of tokenAccounts) {
      try {
        const parsed = parseTokenEscrow(account.data);
        if (now > Number(parsed.createdAt) + 72 * 3600) {
          const escrowVaultAta = getAta(pubkey, parsed.mint);
          const senderTokenAta = getAta(parsed.sender, parsed.mint);

          await program.methods
            .refundEscrowToken()
            .accounts({
              payer: claimAuthority.publicKey,
              sender: parsed.sender,
              escrowTokenState: pubkey,
              mint: parsed.mint,
              escrowToken: escrowVaultAta,
              senderToken: senderTokenAta,
              tokenProgram: TOKEN_PROGRAM_ID,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .rpc();
          escrowMap.delete(pubkey.toString());
          refunded++;
          console.log(`[refund-cron] Refunded token escrow ${pubkey}`);
        }
      } catch (err: any) {
        console.error(`[refund-cron] Failed token ${pubkey}: ${err.message}`);
      }
    }
  } catch (err: any) {
    console.error("[refund-cron] Token scan error:", err.message);
  }

  console.log(`[refund-cron] Checked ${checked} escrows, refunded ${refunded}`);
}

// ============================================================
// Start server
// ============================================================

app.listen(PORT, () => {
  console.log(`SolPay server running on port ${PORT}`);
  console.log(`Program ID: ${PROGRAM_ID}`);
  console.log(`Claim authority: ${claimAuthority.publicKey}`);
  console.log(`Frontend URL: ${APP_URL}`);

  setTimeout(() => {
    runRefundCron();
    setInterval(runRefundCron, 60 * 60 * 1000);
  }, 60 * 1000);
});
