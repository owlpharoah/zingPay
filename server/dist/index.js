"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const web3_js_1 = require("@solana/web3.js");
const anchor = __importStar(require("@coral-xyz/anchor"));
const twilio_1 = __importDefault(require("twilio"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
dotenv_1.default.config();
// ============================================================
// Config
// ============================================================
const PORT = parseInt(process.env.PORT || "3001");
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = new web3_js_1.PublicKey(process.env.PROGRAM_ID || "8ik9hQSoHoEnnzDz2ifBjjNK8PBEAQwgcgJpuRYsgRMs");
const APP_URL = process.env.APP_URL || "http://localhost:3000";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "http://localhost:3000";
const EXPECTED_CLAIM_AUTHORITY = new web3_js_1.PublicKey(process.env.EXPECTED_CLAIM_AUTHORITY ||
    "Ga5Xonhi7vWhhgmRcBbdRCeeVM5PCu1FiEThf6BEGt1x");
if (!process.env.CLAIM_AUTHORITY_KEYPAIR) {
    throw new Error("CLAIM_AUTHORITY_KEYPAIR is required. Gasless claim cannot work with an ephemeral server key.");
}
const claimAuthority = web3_js_1.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.CLAIM_AUTHORITY_KEYPAIR)));
if (!claimAuthority.publicKey.equals(EXPECTED_CLAIM_AUTHORITY)) {
    throw new Error(`Claim authority mismatch. Expected ${EXPECTED_CLAIM_AUTHORITY.toBase58()}, got ${claimAuthority.publicKey.toBase58()}`);
}
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? (0, twilio_1.default)(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;
const TWILIO_VERIFY_SID = process.env.TWILIO_VERIFY_SID || "";
const TWILIO_SMS_FROM = process.env.TWILIO_SMS_FROM || "";
function requireTwilioConfig() {
    if (!twilioClient || !TWILIO_VERIFY_SID) {
        throw new Error("Twilio is not configured");
    }
}
function getNotifyConfig() {
    if (!twilioClient || !TWILIO_VERIFY_SID) {
        throw new Error("Twilio is not configured");
    }
    return {
        client: twilioClient,
        from: TWILIO_SMS_FROM,
    };
}
function normalizePhoneForTwilio(phone) {
    const trimmed = String(phone || "").trim();
    if (trimmed.startsWith("+"))
        return trimmed;
    return `+${trimmed.replace(/\D/g, "")}`;
}
function twilioErrorMessage(err, fallback) {
    const code = err?.code ? ` [Twilio ${err.code}]` : "";
    const detail = err?.message ? ` ${err.message}` : "";
    let hint = "";
    if (err?.code === 21608) {
        hint = " (Trial account can only send to verified recipient numbers.)";
    }
    else if (err?.code === 21211) {
        hint = " (Phone must be in valid E.164 format, e.g. +14155552671.)";
    }
    else if (err?.code === 60200 || err?.code === 60203) {
        hint = " (Verify service or destination/channel is not allowed for this account/region.)";
    }
    return `${fallback}${code}.${detail}${hint}`.trim();
}
// ============================================================
// Solana setup
// ============================================================
const connection = new web3_js_1.Connection(RPC_URL, "confirmed");
const REGISTRY_ACCOUNT_SPACE = 8 + 32 + 32 + 1;
const CLAIMANT_PREFUND_BUFFER_LAMPORTS = 0;
const MIN_CLAIMANT_NET_LAMPORTS = 5000;
// Load IDL
const idlPath = path_1.default.join(__dirname, "..", "idl", "solpay.json");
let idl;
try {
    idl = JSON.parse(fs_1.default.readFileSync(idlPath, "utf-8"));
}
catch {
    console.warn("IDL not found at", idlPath, "— some features will fail until IDL is copied.");
}
// Create a read-only provider (claim_authority pays for claim txs)
const wallet = new anchor.Wallet(claimAuthority);
const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
});
let program;
if (idl) {
    program = new anchor.Program(idl, provider);
}
// ============================================================
// In-memory maps
// ============================================================
// phone_hash (hex) → { phone, escrow_address }
const notifyMap = new Map();
// escrow_address → phone
const escrowMap = new Map();
// Rate limiting: escrow_address → { count, resetAt }
const otpRateLimit = new Map();
function checkRateLimit(key) {
    const now = Date.now();
    const entry = otpRateLimit.get(key);
    if (!entry || now > entry.resetAt) {
        otpRateLimit.set(key, { count: 1, resetAt: now + 10 * 60 * 1000 });
        return true;
    }
    if (entry.count >= 3)
        return false;
    entry.count++;
    return true;
}
// ============================================================
// Express app
// ============================================================
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)({
    origin: ALLOWED_ORIGIN,
    methods: ["POST", "GET"],
}));
// Health check
app.get("/health", async (_req, res) => {
    const claimAuthorityBalance = await connection.getBalance(claimAuthority.publicKey);
    res.json({
        status: "ok",
        programId: PROGRAM_ID.toString(),
        claimAuthority: claimAuthority.publicKey.toBase58(),
        claimAuthorityBalanceLamports: claimAuthorityBalance,
    });
});
async function ensureClaimSponsorshipCapacity() {
    const minRent = await connection.getMinimumBalanceForRentExemption(REGISTRY_ACCOUNT_SPACE);
    const estimatedFee = 10000;
    const requiredLamports = minRent + CLAIMANT_PREFUND_BUFFER_LAMPORTS + estimatedFee;
    const balance = await connection.getBalance(claimAuthority.publicKey);
    if (balance < requiredLamports) {
        throw new Error(`Claim authority balance too low for gasless claim. Need >= ${requiredLamports} lamports, have ${balance}.`);
    }
}
function bnToLamports(value) {
    if (typeof value === "number")
        return value;
    if (typeof value === "bigint")
        return Number(value);
    if (value && typeof value.toString === "function") {
        return Number(value.toString());
    }
    throw new Error("Unable to parse lamports value");
}
async function resolvePhoneForEscrow(escrowAddress, phoneFromRequest) {
    const mapped = escrowMap.get(escrowAddress);
    if (mapped)
        return mapped;
    if (!phoneFromRequest || !program)
        return null;
    try {
        const escrowPubkey = new web3_js_1.PublicKey(escrowAddress);
        const escrowAccount = await program.account.escrowAccount.fetch(escrowPubkey);
        const onChainPhoneHash = Buffer.from(escrowAccount.phoneHash);
        const requestPhoneHash = crypto_1.default
            .createHash("sha256")
            .update(phoneFromRequest, "utf8")
            .digest();
        if (!onChainPhoneHash.equals(requestPhoneHash)) {
            return null;
        }
        escrowMap.set(escrowAddress, phoneFromRequest);
        return phoneFromRequest;
    }
    catch {
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
            const escrowPubkey = new web3_js_1.PublicKey(escrow_address);
            const accountInfo = await connection.getAccountInfo(escrowPubkey);
            if (!accountInfo) {
                return res
                    .status(400)
                    .json({ error: "Escrow account does not exist on-chain" });
            }
        }
        catch {
            return res.status(400).json({ error: "Invalid escrow address" });
        }
        // Store mappings
        notifyMap.set(phone_hash, { phone, escrow: escrow_address });
        escrowMap.set(escrow_address, phone);
        // Cleanup after 73h
        setTimeout(() => {
            notifyMap.delete(phone_hash);
            escrowMap.delete(escrow_address);
        }, 73 * 3600 * 1000);
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
    }
    catch (err) {
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
    }
    catch (err) {
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
        const escrowPubkey = new web3_js_1.PublicKey(escrow_address);
        const claimantPubkey = new web3_js_1.PublicKey(claimant_wallet);
        // Fetch escrow to get phone_hash and sender
        const escrowAccount = await program.account.escrowAccount.fetch(escrowPubkey);
        const phoneHash = Array.from(escrowAccount.phoneHash);
        const sender = escrowAccount.sender;
        const escrowAmountLamports = bnToLamports(escrowAccount.amount);
        // Derive registry PDA
        const [registryPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("registry"), Buffer.from(phoneHash)], PROGRAM_ID);
        const tx = new web3_js_1.Transaction();
        const minRent = await connection.getMinimumBalanceForRentExemption(REGISTRY_ACCOUNT_SPACE);
        const reimbursementLamports = minRent + CLAIMANT_PREFUND_BUFFER_LAMPORTS;
        const claimantNetLamports = escrowAmountLamports - reimbursementLamports;
        if (claimantNetLamports < MIN_CLAIMANT_NET_LAMPORTS) {
            return res.status(400).json({
                error: "Escrow amount is too small to claim after sponsored setup recovery. Ask sender to refund and resend a higher amount.",
            });
        }
        tx.add(web3_js_1.SystemProgram.transfer({
            fromPubkey: claimAuthority.publicKey,
            toPubkey: claimantPubkey,
            lamports: reimbursementLamports,
        }));
        const ix = await program.methods
            .claimEscrow(phoneHash)
            .accounts({
            claimAuthority: claimAuthority.publicKey,
            claimant: claimantPubkey,
            sender: sender,
            escrow: escrowPubkey,
            registry: registryPda,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .instruction();
        tx.add(ix);
        tx.add(web3_js_1.SystemProgram.transfer({
            fromPubkey: claimantPubkey,
            toPubkey: claimAuthority.publicKey,
            lamports: reimbursementLamports,
        }));
        tx.feePayer = claimAuthority.publicKey;
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        // Partial sign with claim_authority
        tx.partialSign(claimAuthority);
        const serialized = tx
            .serialize({ requireAllSignatures: false })
            .toString("base64");
        console.log(`[otp/verify] Claim tx built for escrow ${escrow_address} (mode=${claim_mode || "connect"}, escrow=${escrowAmountLamports}, reimbursement=${reimbursementLamports}, claimantNet=${claimantNetLamports})`);
        res.json({ transaction: serialized });
    }
    catch (err) {
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
    }
    catch (err) {
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
        const walletPubkey = new web3_js_1.PublicKey(wallet);
        // Hash phone to get PDA seed
        const phoneHash = crypto_1.default
            .createHash("sha256")
            .update(phone, "utf8")
            .digest();
        const phoneHashArray = Array.from(phoneHash);
        const [registryPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("registry"), phoneHash], PROGRAM_ID);
        const tx = new web3_js_1.Transaction();
        const ix = await program.methods
            .registerPhone(phoneHashArray, walletPubkey)
            .accounts({
            owner: walletPubkey,
            claimAuthority: claimAuthority.publicKey,
            registry: registryPda,
            systemProgram: web3_js_1.SystemProgram.programId,
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
    }
    catch (err) {
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
    }
    catch (err) {
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
        const phoneHash = crypto_1.default.createHash("sha256").update(phone, "utf8").digest();
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
            const sender = new web3_js_1.PublicKey(raw.subarray(8, 40)).toBase58();
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
    }
    catch (err) {
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
                const escrow = program.coder.accounts.decode("escrowAccount", account.data);
                const createdAt = escrow.createdAt.toNumber();
                if (now > createdAt + 72 * 3600) {
                    await program.methods
                        .refundEscrow()
                        .accounts({
                        escrow: pubkey,
                        sender: escrow.sender,
                        systemProgram: web3_js_1.SystemProgram.programId,
                    })
                        .rpc();
                    escrowMap.delete(pubkey.toString());
                    refunded++;
                    console.log(`[refund-cron] Refunded escrow ${pubkey}`);
                }
            }
            catch (err) {
                console.error(`[refund-cron] Failed to refund ${pubkey}: ${err.message}`);
            }
        }
        console.log(`[refund-cron] Checked ${accounts.length} escrows, refunded ${refunded}`);
    }
    catch (err) {
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
//# sourceMappingURL=index.js.map