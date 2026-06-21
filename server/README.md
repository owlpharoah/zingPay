# ZingPay Server

Backend for ZingPay: OTP verification (Twilio), gasless/sponsored claim & registration
transaction building (Solana + Anchor), and an automatic refund sweep for expired escrows.

It is a single Express app deployed as **one Vercel serverless function**. Every request
the frontend makes (`/otp/*`, `/notify`, `/received/*`, `/phone/*`, `/health`) is routed to
that function; the expired-escrow refund job runs on a **Vercel Cron** instead of an
in-process timer.

---

## 1. File & folder reference

| Path | What it is |
|------|------------|
| `src/index.ts` | The entire backend: config, Solana/Anchor setup, all Express routes, the refund-cron logic, and the local-dev `app.listen`. Exports the Express `app` as its default. |
| `api/index.ts` | **Vercel entrypoint.** A 3-line file that imports `src/index.ts` and re-exports the Express app as the serverless handler. Vercel only treats files under `api/` as functions, so this is what Vercel actually invokes. |
| `vercel.json` | Vercel config: rewrites **all** paths to the `api/index` function, sets the function `maxDuration`, and registers the hourly refund **cron** (`/cron/refund`). |
| `idl/solpay.json` | The Anchor IDL for the on-chain program. Imported (bundled) by `src/index.ts` to build transactions. Its `address` field must equal `PROGRAM_ID`. |
| `.env.example` | Template of every environment variable. Copy to `.env` for local dev; mirror into Vercel for production. |
| `.gitignore` | Keeps `node_modules/`, `dist/`, and `.env*` out of git. |
| `package.json` | Dependencies and scripts (`dev`, `build`, `start`, `typecheck`, `vercel-build`). |
| `package-lock.json` | Locked dependency versions (used by `npm ci`). |
| `tsconfig.json` | TypeScript config. Compiles `src/` and `api/`. |

### API routes (all defined in `src/index.ts`)

| Method | Path | Purpose |
|--------|------|---------|
| `GET`  | `/health` | Liveness + claim-authority balance. |
| `POST` | `/notify` | Send the claim-link SMS after an escrow is created. |
| `POST` | `/otp/send` | Send a claim OTP for an escrow. |
| `POST` | `/otp/verify` | Verify claim OTP, return partially-signed claim + register txs. |
| `POST` | `/otp/send-register` | Send a registration OTP. |
| `POST` | `/otp/verify-register` | Verify registration OTP, return a register tx. |
| `POST` | `/otp/verify-change` | Verify OTP for a phone change, return delete+register tx. |
| `POST` | `/received/send-otp` | Send OTP for the "received history" lookup. |
| `POST` | `/received/lookup` | List pending escrows for a verified phone. |
| `POST` | `/phone/build-delete-tx` | Build an unsigned delete-phone tx. |
| `GET` / `POST` | `/cron/refund` | Refund expired escrows. Called by the Vercel Cron (guarded by `CRON_SECRET`). |

---

## 2. Environment variables

Every variable below is read in `src/index.ts`. Defaults shown are the fallbacks hard-coded
in the **Config** block (`src/index.ts` lines ~28–73); they target **Solana devnet** and are
fine for testing, but you should set explicit values in production.

> ⚠️ `PROGRAM_ID` and `USDC_MINT` **must match** the frontend's `NEXT_PUBLIC_PROGRAM_ID` and
> `NEXT_PUBLIC_USDC_MINT` (see `app/lib/constants.ts`), or the two halves will read/write
> different on-chain accounts.

### Required

| Variable | Read at | What it is & where to get it |
|----------|---------|------------------------------|
| `CLAIM_AUTHORITY_KEYPAIR` | `src/index.ts:52,59` | JSON byte array of the claim authority's **secret key**, e.g. `[12,34,...]` (64 numbers). This is the wallet that sponsors gas and co-signs registrations, so **it must hold SOL** on your cluster. Generate with `solana-keygen new --outfile authority.json` (the file *is* the array) or use an existing keypair file (`~/.config/solana/id.json`). Fund it with `solana airdrop 2 <pubkey> --url devnet`. The server refuses to start if this is missing or doesn't match `EXPECTED_CLAIM_AUTHORITY`. |
| `EXPECTED_CLAIM_AUTHORITY` | `src/index.ts:44` | The **public key** of the keypair above (a safety check against loading the wrong key). Get it with `solana-keygen pubkey authority.json`. |
| `TWILIO_ACCOUNT_SID` | `src/index.ts:69` | Twilio account SID (`AC…`). **Twilio Console** → dashboard home: https://console.twilio.com → *Account Info*. |
| `TWILIO_AUTH_TOKEN` | `src/index.ts:69` | Twilio auth token. Same Console dashboard, next to the SID (click to reveal). |
| `TWILIO_VERIFY_SID` | `src/index.ts:72` | Twilio **Verify Service** SID (`VA…`). Console → **Verify → Services** (create one if needed): https://console.twilio.com/us1/develop/verify/services |
| `TWILIO_SMS_FROM` | `src/index.ts:73` | Sender phone number in E.164 (e.g. `+1415…`) used by `/notify` for the claim-link SMS. Console → **Phone Numbers → Manage → Active numbers**: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming |

> Note: without the Twilio vars the OTP/notify routes return `503` but the rest still loads.
> On a Twilio **trial** account you can only message verified recipient numbers.

### Recommended in production

| Variable | Read at | What it is & where to get it |
|----------|---------|------------------------------|
| `SOLANA_RPC_URL` | `src/index.ts:30` | Solana RPC endpoint. Default `https://api.devnet.solana.com` (public, rate-limited). Use a paid provider in production — the claim lookup and refund cron do heavy `getProgramAccounts` scans. Get a URL from **Helius** (https://helius.dev), **QuickNode** (https://quicknode.com), or **Alchemy** (https://alchemy.com). |
| `ALLOWED_ORIGIN` | `src/index.ts:42` | CORS allowlist — set to your deployed **frontend** origin (e.g. `https://zingpay.vercel.app`). Default `http://localhost:3000`. |
| `APP_URL` | `src/index.ts:41` | Frontend base URL used to build the claim link inside the SMS. Set to the same frontend origin. Default `http://localhost:3000`. |
| `CRON_SECRET` | `src/index.ts:1103` | Shared secret guarding `/cron/refund`. Generate one: `openssl rand -hex 32`. When set in Vercel, Vercel automatically sends it as `Authorization: Bearer <CRON_SECRET>` on cron invocations. If unset, the endpoint is publicly callable (a warning is logged). |

### Optional / advanced

| Variable | Read at | What it is & where to get it |
|----------|---------|------------------------------|
| `PROGRAM_ID` | `src/index.ts:32` | The deployed Anchor program's address. Default is the devnet program. Source of truth: the program's `declare_id!` / `anchor keys list`, and it must equal `idl/solpay.json`'s `address`. |
| `USDC_MINT` | `src/index.ts:35` | SPL mint treated as USDC. Default is a devnet test mint. Mainnet USDC is `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`. For devnet, use the mint you created with `spl-token create-token`. |
| `PROVIDER_USDC_ATA` | `src/index.ts:39` | The provider's USDC associated token account (receives the swap-fee carve-out on token claims). Derive with `spl-token create-account <USDC_MINT> --owner <EXPECTED_CLAIM_AUTHORITY>` or `getAssociatedTokenAddressSync`. |
| `REFUND_CRON_MAX` | `src/index.ts:1007` | Max refund transactions per cron run (keeps the function within `maxDuration`). Default `15`. Raise it (and `maxDuration`) on a Pro plan if backlogs grow. |
| `PORT` | `src/index.ts:29` | Local-dev port only (default `3001`). **Vercel sets this itself** — do not configure it there. |
| `VERCEL` | `src/index.ts:1134` | Set automatically by Vercel. When present, the app skips `app.listen` (it's invoked as a function) and the in-process refund loop is disabled in favor of the cron. **Do not set this manually.** |

---

## 3. Deploy to Vercel

1. **Push** this repo to GitHub/GitLab/Bitbucket.
2. In Vercel, **New Project → Import** the repo.
3. Set **Root Directory** to `server/` and **Framework Preset** to **Other**.
   (Build/output settings can be left default — Vercel compiles the `api/` function
   automatically; `vercel-build` is a no-op.)
4. Add every variable from [section 2](#2-environment-variables) under
   **Settings → Environment Variables**.
5. **Deploy.** Your API is then served at `https://<project>.vercel.app` with the same paths
   (e.g. `POST https://<project>.vercel.app/otp/send`).
6. **Point the frontend at it:** in the frontend (`app/`) Vercel project, set
   `NEXT_PUBLIC_BACKEND_URL=https://<project>.vercel.app` and redeploy. No other frontend
   change is needed — the paths are unchanged.

**Verify:** `curl https://<project>.vercel.app/health` should return JSON with the claim
authority's pubkey and balance.

### The refund cron

`vercel.json` registers `/cron/refund` to run **hourly** (`0 * * * *`). Vercel calls it with
the `CRON_SECRET` bearer token; the handler sweeps and refunds expired (>72h) escrows, capped
at `REFUND_CRON_MAX` per run.

> ⏱️ **Plan note:** hourly crons require **Vercel Pro** — on the **Hobby** plan crons run at
> most once per day. The same plan tier matters if you raise `maxDuration` above 60s for
> larger refund batches.

You can trigger it manually:
```bash
curl -X POST https://<project>.vercel.app/cron/refund \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## 4. Local development

```bash
cd server
npm install
cp .env.example .env      # then fill in the values from section 2
npm run dev               # ts-node src/index.ts → http://localhost:3001
```

Locally the server runs as a normal long-lived process (it binds `PORT` and runs the refund
sweep on an in-process interval — the cron endpoint is only needed on Vercel).

Other scripts:

| Script | Does |
|--------|------|
| `npm run dev` | Run with `ts-node` (hot-ish local dev). |
| `npm run typecheck` | `tsc --noEmit` — type-check `src/` and `api/`. |
| `npm run build` | Compile to `dist/` (legacy non-serverless build). |
| `npm start` | Run the compiled `dist/src/index.js` (legacy). |

---

## 5. Notes & caveats

- **Rate limiting is in-memory** (`otpRateLimit` in `src/index.ts`). On serverless this is
  per-instance and resets on cold starts — effective but not a strict global cap. For hard
  limits, back it with a shared store (Upstash Redis / Vercel KV).
- **`escrowMap` is a best-effort warm cache.** A cold function starts empty; the claim flow
  still works because the claim link carries the phone, which `resolvePhoneForEscrow` verifies
  against the on-chain phone hash.
- **Keep the claim authority funded.** If its SOL balance falls below ~0.01 SOL, claim and
  token-refund transactions will fail (`/health` reports the current balance).
