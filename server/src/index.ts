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
  process.env.PROGRAM_ID || "8ik9hQSoHoEnnzDz2ifBjjNK8PBEAQwgcgJpuRYsgRMs",
);
const APP_URL = process.env.APP_URL || "http://localhost:3000";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "http://localhost:3000";
const EXPECTED_CLAIM_AUTHORITY = new PublicKey(
  process.env.EXPECTED_CLAIM_AUTHORITY ||
    "Ga5Xonhi7vWhhgmRcBbdRCeeVM5PCu1FiEThf6BEGt1x",
);

if (!process.env.CLAIM_AUTHORITY_KEYPAIR) {
  throw new Error(
    "CLAIM_AUTHORITY_KEYPAIR is required. Gasless claim cannot work with an ephemeral server key.",
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

function requireTwilioConfig() {
  if (!twilioClient || !TWILIO_VERIFY_SID) {
    throw new Error("Twilio is not configured");
  }
}

function getNotifyConfig(): {
  client: NonNullable<typeof twilioClient>;
  from: string;
} {
  if (!twilioClient || !TWILIO_VERIFY_SID) {
    throw new Error("Twilio is not configured");
  }
  return {
    client: twilioClient,
    from: TWILIO_SMS_FROM,
  };
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

  if (err?.code === 21608) {
    hint = " (Trial account can only send to verified recipient numbers.)";
  } else if (err?.code === 21211) {
    hint = " (Phone must be in valid E.164 format, e.g. +14155552671.)";
  } else if (err?.code === 60200 || err?.code === 60203) {
    hint = " (Verify service or destination/channel is not allowed for this account/region.)";
  }

  return `${fallback}${code}.${detail}${hint}`.trim();
}

// ============================================================
// Solana setup
// ============================================================

const connection = new Connection(RPC_URL, "confirmed");
const REGISTRY_ACCOUNT_SPACE = 8 + 32 + 32 + 1;
const CLAIMANT_PREFUND_BUFFER_LAMPORTS = 0;
const MIN_CLAIMANT_NET_LAMPORTS = 5_000;

// Load IDL
const idlPath = path.join(__dirname, "..", "idl", "solpay.json");
let idl: any;
try {
  idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
} catch {
  console.warn(
    "IDL not found at",
    idlPath,
    "— some features will fail until IDL is copied.",
  );
}

// Create a read-only provider (claim_authority pays for claim txs)
const wallet = new anchor.Wallet(claimAuthority);
const provider = new anchor.AnchorProvider(connection, wallet, {
  commitment: "confirmed",
});
let program: anchor.Program;
if (idl) {
  program = new anchor.Program(idl, provider);
}

// ============================================================
// In-memory maps
// ============================================================

// phone_hash (hex) → { phone, escrow_address }
const notifyMap = new Map<string, { phone: string; escrow: string }>();
// escrow_address → phone
const escrowMap = new Map<string, string>();

// Rate limiting: escrow_address → { count, resetAt }
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
// Express app
// ============================================================

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    methods: ["POST", "GET"],
  }),
);

// Health check
app.get("/health", async (_req, res) => {
  const claimAuthorityBalance = await connection.getBalance(
    claimAuthority.publicKey,
  );
  res.json({
    status: "ok",
    programId: PROGRAM_ID.toString(),
    claimAuthority: claimAuthority.publicKey.toBase58(),
    claimAuthorityBalanceLamports: claimAuthorityBalance,
  });
});

async function ensureClaimSponsorshipCapacity(): Promise<void> {
  const minRent = await connection.getMinimumBalanceForRentExemption(
    REGISTRY_ACCOUNT_SPACE,
  );
  const estimatedFee = 10_000;
  const requiredLamports =
    minRent + CLAIMANT_PREFUND_BUFFER_LAMPORTS + estimatedFee;
  const balance = await connection.getBalance(claimAuthority.publicKey);

  if (balance < requiredLamports) {
    throw new Error(
      `Claim authority balance too low for gasless claim. Need >= ${requiredLamports} lamports, have ${balance}.`,
    );
  }
}

function bnToLamports(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (value && typeof (value as { toString: () => string }).toString === "function") {
    return Number((value as { toString: () => string }).toString());
  }
  throw new Error("Unable to parse lamports value");
}

async function resolvePhoneForEscrow(
  escrowAddress: string,
  phoneFromRequest?: string,
): Promise<string | null> {
  const mapped = escrowMap.get(escrowAddress);
  if (mapped) return mapped;

  if (!phoneFromRequest || !program) return null;

  try {
    const escrowPubkey = new PublicKey(escrowAddress);
    const escrowAccount =
      await (program.account as any).escrowAccount.fetch(escrowPubkey);

    const onChainPhoneHash = Buffer.from(
      escrowAccount.phoneHash as Uint8Array,
    );
    const requestPhoneHash = crypto
      .createHash("sha256")
      .update(phoneFromRequest, "utf8")
      .digest();

    if (!onChainPhoneHash.equals(requestPhoneHash)) {
      return null;
    }

    escrowMap.set(escrowAddress, phoneFromRequest);
    return phoneFromRequest;
  } catch {
    return null;
  }
}

// ============================================================
// POST /notify — frontend calls after creating escrow
// ============================================================

app.post("/notify", async (req, res) => {
  try {
    const { client, from } = getNotifyConfig();

    const { phone, phone_hash, escrow_address } = req.body;

    if (!phone || !phone_hash || !escrow_address) {
      return res
        .status(400)
        .json({ error: "Missing phone, phone_hash, or escrow_address" });
    }

    // Validate escrow exists on-chain
    try {
      const escrowPubkey = new PublicKey(escrow_address);
      const accountInfo = await connection.getAccountInfo(escrowPubkey);
      if (!accountInfo) {
        return res
          .status(400)
          .json({ error: "Escrow account does not exist on-chain" });
      }
    } catch {
      return res.status(400).json({ error: "Invalid escrow address" });
    }

    // Store mappings
    notifyMap.set(phone_hash, { phone, escrow: escrow_address });
    escrowMap.set(escrow_address, phone);

    // Cleanup after 73h
    setTimeout(
      () => {
        notifyMap.delete(phone_hash);
        escrowMap.delete(escrow_address);
      },
      73 * 3600 * 1000,
    );

    // Send SMS notification
    const claimUrl = `${APP_URL}/claim?escrow=${escrow_address}&phone=${encodeURIComponent(phone)}`;
    const to = normalizePhoneForTwilio(phone);
    await client.messages.create({
      from,
      to,
      body: `You have received SOL! Claim it here: ${claimUrl}\nExpires in 72 hours.`,
    });

    console.log(`[notify] SMS sent to ${to} for escrow ${escrow_address}`);
    res.json({ ok: true });
  } catch (err: any) {
    const detail = err?.message || "Unknown error";
    const code = err?.code ? ` (code ${err.code})` : "";
    console.error("[notify] Error:", detail, code);
    res.status(500).json({ error: `Failed to send notification: ${detail}${code}` });
  }
});

// ============================================================
// POST /otp/send — claim flow: sends OTP to the phone on file
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
      return res
        .status(404)
        .json({ error: "Escrow phone not found. Use the latest claim link or provide the original phone number." });
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
// POST /otp/verify — claim flow: verifies OTP, returns partial tx
// ============================================================

app.post("/otp/verify", async (req, res) => {
  try {
    if (!twilioClient || !TWILIO_VERIFY_SID) {
      return res.status(503).json({ error: "Twilio is not configured" });
    }

    const { escrow_address, code, claimant_wallet, phone, claim_mode } = req.body;
    if (!escrow_address || !code || !claimant_wallet) {
      return res
        .status(400)
        .json({ error: "Missing escrow_address, code, or claimant_wallet" });
    }

    const resolvedPhone = await resolvePhoneForEscrow(escrow_address, phone);
    if (!resolvedPhone) {
      return res.status(404).json({ error: "Escrow phone not found" });
    }

    // Verify OTP with Twilio
    const check = await twilioClient.verify.v2
      .services(TWILIO_VERIFY_SID)
      .verificationChecks.create({ to: resolvedPhone, code });

    if (check.status !== "approved") {
      return res.status(400).json({ error: "Invalid OTP code" });
    }

    if (!program) {
      return res.status(500).json({ error: "Program IDL not loaded" });
    }

    await ensureClaimSponsorshipCapacity();

    // Build claim_escrow transaction
    const escrowPubkey = new PublicKey(escrow_address);
    const claimantPubkey = new PublicKey(claimant_wallet);

    // Fetch escrow to get phone_hash and sender
    const escrowAccount =
      await (program.account as any).escrowAccount.fetch(escrowPubkey);
    const phoneHash: number[] = Array.from(
      escrowAccount.phoneHash as Uint8Array,
    );
    const sender = escrowAccount.sender as PublicKey;
    const escrowAmountLamports = bnToLamports(escrowAccount.amount);

    // Derive registry PDA
    const [registryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("registry"), Buffer.from(phoneHash)],
      PROGRAM_ID,
    );

    const tx = new Transaction();

    const minRent = await connection.getMinimumBalanceForRentExemption(
      REGISTRY_ACCOUNT_SPACE,
    );
    const reimbursementLamports = minRent + CLAIMANT_PREFUND_BUFFER_LAMPORTS;
    const claimantNetLamports = escrowAmountLamports - reimbursementLamports;

    if (claimantNetLamports < MIN_CLAIMANT_NET_LAMPORTS) {
      return res.status(400).json({
        error:
          "Escrow amount is too small to claim after sponsored setup recovery. Ask sender to refund and resend a higher amount.",
      });
    }

    tx.add(
      SystemProgram.transfer({
        fromPubkey: claimAuthority.publicKey,
        toPubkey: claimantPubkey,
        lamports: reimbursementLamports,
      }),
    );

    const ix = await program.methods
      .claimEscrow(phoneHash)
      .accounts({
        claimAuthority: claimAuthority.publicKey,
        claimant: claimantPubkey,
        sender: sender,
        escrow: escrowPubkey,
        registry: registryPda,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    tx.add(ix);
    tx.add(
      SystemProgram.transfer({
        fromPubkey: claimantPubkey,
        toPubkey: claimAuthority.publicKey,
        lamports: reimbursementLamports,
      }),
    );
    tx.feePayer = claimAuthority.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    // Partial sign with claim_authority
    tx.partialSign(claimAuthority);

    const serialized = tx
      .serialize({ requireAllSignatures: false })
      .toString("base64");

    console.log(
      `[otp/verify] Claim tx built for escrow ${escrow_address} (mode=${claim_mode || "connect"}, escrow=${escrowAmountLamports}, reimbursement=${reimbursementLamports}, claimantNet=${claimantNetLamports})`,
    );
    res.json({ transaction: serialized });
  } catch (err: any) {
    const msg = String(err?.message || "Failed to build claim transaction");
    console.error("[otp/verify] Error:", msg);
    res.status(500).json({ error: msg });
  }
});

// ============================================================
// POST /otp/send-register — registration flow: takes phone directly
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
// POST /otp/verify-register — registration flow: verifies OTP, returns partial tx
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

    // Verify OTP
    const check = await twilioClient.verify.v2
      .services(TWILIO_VERIFY_SID)
      .verificationChecks.create({ to: phone, code });

    if (check.status !== "approved") {
      return res.status(400).json({ error: "Invalid OTP code" });
    }

    if (!program) {
      return res.status(500).json({ error: "Program IDL not loaded" });
    }

    // Build register_phone transaction
    const walletPubkey = new PublicKey(wallet);

    // Hash phone to get PDA seed
    const phoneHash: Buffer = crypto
      .createHash("sha256")
      .update(phone, "utf8")
      .digest();
    const phoneHashArray = Array.from(phoneHash);

    const [registryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("registry"), phoneHash],
      PROGRAM_ID,
    );

    const tx = new Transaction();
    const ix = await program.methods
      .registerPhone(phoneHashArray, walletPubkey)
      .accounts({
        owner: walletPubkey,
        claimAuthority: claimAuthority.publicKey,
        registry: registryPda,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    tx.add(ix);
    tx.feePayer = walletPubkey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    tx.partialSign(claimAuthority);

    const serialized = tx
      .serialize({ requireAllSignatures: false })
      .toString("base64");

    console.log(`[otp/verify-register] Register tx built for ${phone}`);
    res.json({ transaction: serialized });
  } catch (err: any) {
    console.error("[otp/verify-register] Error:", err.message);
    res.status(500).json({ error: "Failed to build register transaction" });
  }
});

// ============================================================
// POST /received/send-otp — received history access: send OTP to phone
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
// POST /received/lookup — received history access: verify OTP and fetch escrows
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
      .verificationChecks.create({ to: phone, code });

    if (check.status !== "approved") {
      return res.status(400).json({ error: "Invalid OTP code" });
    }

    const phoneHash = crypto.createHash("sha256").update(phone, "utf8").digest();
    const ESCROW_SIZE = 8 + 32 + 32 + 8 + 8 + 1;

    const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        { dataSize: ESCROW_SIZE },
        {
          memcmp: {
            offset: 40,
            bytes: anchor.utils.bytes.bs58.encode(phoneHash),
            encoding: "base58",
          },
        },
      ],
    });

    const now = Math.floor(Date.now() / 1000);
    const escrows = accounts
      .map(({ pubkey, account }) => {
        const raw = account.data;
        const sender = new PublicKey(raw.subarray(8, 40)).toBase58();
        const amountLamports = Number(raw.readBigUInt64LE(72));
        const createdAt = Number(raw.readBigInt64LE(80));
        return {
          escrow: pubkey.toBase58(),
          sender,
          amountLamports,
          createdAt,
          expired: now > createdAt + 72 * 3600,
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    res.json({ escrows });
  } catch (err: any) {
    console.error("[received/lookup] Error:", err.message);
    res.status(500).json({ error: "Failed to lookup received history" });
  }
});

// ============================================================
// Refund cron — runs every hour, refunds expired escrows
// ============================================================

async function runRefundCron() {
  if (!program) {
    console.warn("[refund-cron] Program not initialized, skipping");
    return;
  }

  try {
    const ESCROW_SIZE = 8 + 32 + 32 + 8 + 8 + 1; // 89 bytes
    const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [{ dataSize: ESCROW_SIZE }],
    });

    const now = Math.floor(Date.now() / 1000);
    let refunded = 0;

    for (const { pubkey, account } of accounts) {
      try {
        const escrow = program.coder.accounts.decode(
          "escrowAccount",
          account.data,
        );
        const createdAt = (escrow.createdAt as anchor.BN).toNumber();

        if (now > createdAt + 72 * 3600) {
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
          console.log(`[refund-cron] Refunded escrow ${pubkey}`);
        }
      } catch (err: any) {
        console.error(
          `[refund-cron] Failed to refund ${pubkey}: ${err.message}`,
        );
      }
    }

    console.log(
      `[refund-cron] Checked ${accounts.length} escrows, refunded ${refunded}`,
    );
  } catch (err: any) {
    console.error("[refund-cron] Error:", err.message);
  }
}

// ============================================================
// Start server
// ============================================================

app.listen(PORT, () => {
  console.log(`SolPay server running on port ${PORT}`);
  console.log(`Program ID: ${PROGRAM_ID}`);
  console.log(`Claim authority: ${claimAuthority.publicKey}`);
  console.log(`Frontend URL: ${APP_URL}`);

  // Start refund cron: first run after 60s, then every hour
  setTimeout(() => {
    runRefundCron();
    setInterval(runRefundCron, 60 * 60 * 1000);
  }, 60 * 1000);
});
