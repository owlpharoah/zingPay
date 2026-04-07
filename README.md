# ZingPay

A Solana payment protocol that uses phone numbers as wallet identifiers.

Wallet addresses are the main reason crypto payments don't spread beyond developers. A 44-character base58 string is not something normal people copy correctly, share over WhatsApp, or remember. Phone numbers are. ZingPay replaces the address with the phone number at the protocol level, not just in the UI.

---

## How it works

ZingPay handles two cases.

**Registered recipient.** The sender inputs a phone number and amount. ZingPay hashes the number (SHA-256, E.164 normalized), looks up the on-chain registry PDA, and executes a direct SOL transfer. No escrow, no intermediary, no delay.

**Unregistered recipient.** Funds lock into a sender-bound escrow PDA on-chain. The recipient receives an SMS with a claim link, verifies ownership via OTP, and receives the SOL. If they have no wallet, a fresh keypair is generated in-browser and force-downloaded before the claim transaction is signed and broadcast. If the escrow goes unclaimed for 72 hours, the sender can reclaim the funds. This check runs on-chain; no backend involvement required.

---

## Architecture

**On-chain Anchor program** (`DJBNMKMALGKKncXBPvy9NDeFactR5pgJ6bpU3qbMEddm`)

Five instructions: `register_phone`, `send_direct`, `send_escrow`, `claim_escrow`, `refund_escrow`.

Two account types:

- `RegistryAccount`: maps a phone hash to a wallet pubkey
- `EscrowAccount`: stores sender, phone hash, amount, creation timestamp, bump

PDA seeds:

```
registry: ["registry", sha256(e164_phone)]
escrow:   ["escrow", sender_pubkey, sha256(e164_phone)]
```

The 72-hour expiry is enforced as a program constant. The refund instruction is permissionless after expiry; anyone can crank it, no backend required.

**Backend (Express + Twilio Verify)**

The backend holds the claim authority keypair and co-signs claim and register transactions after OTP verification. It constructs a partially signed transaction, returns it to the frontend, and the claimant provides the final signature before broadcast.

An hourly cron scans on-chain escrow accounts and triggers refunds for expired ones. All other state is in-memory by design; the source of truth is the chain.

Endpoints: `/otp/send`, `/otp/verify`, `/otp/verify-register`, `/notify`, `/received/lookup`.

**Frontend (Next.js 16 + React 19)**

Six routes: send, claim, register, refund, history, landing. Wallet adapter supports Phantom, Solflare, and Coinbase Wallet.

---

## Security model

The claim authority keypair lives on the backend. That is the central trust assumption. Compromising the backend compromises the claim and register flows.

What is enforced on-chain with no backend dependency:

- PDA seeds bind each escrow to a specific sender and phone hash pair
- Claim and register require the claim authority signature
- Refund verifies the 72-hour timestamp before releasing funds
- `send_direct` transfers directly to the registry wallet; no backend call is made

Phone numbers are never stored on-chain. Only their SHA-256 hash is.

---

## Running locally

Prerequisites: Rust, Anchor 0.32.1, Node.js, a Twilio account, a funded devnet wallet.

```bash
# Build and deploy the program
anchor build
anchor deploy --provider.cluster devnet

# Backend
cd backend
cp .env.example .env
npm install
npm run dev

# Frontend
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

The backend `CLAIM_AUTHORITY_KEYPAIR` must match the pubkey hardcoded in the program . A mismatch will cause every claim to fail at the on-chain signature check.

---

## Stack

| Layer | Tech |
|---|---|
| Smart contract | Rust, Anchor 0.32.1 |
| Backend | Node.js, Express, Twilio Verify, Solana web3.js |
| Frontend | Next.js 16, React 19, Solana Wallet Adapter |
| Chain | Solana devnet |

---

## Known limitations

**In-memory backend state.** If the backend restarts after an escrow is created but before `/notify` stores the phone mapping, the recipient does not get an SMS. They can still claim if they have the escrow address, but the flow breaks. Fixing this requires a persistent store (Redis or Postgres).

**Devnet only.** Mainnet deployment needs an audit of the claim authority flow, hardened rate limiting, and a proper key management setup for the claim authority keypair.

**SMS-dependent claim discovery.** Recipients currently rely on the notification SMS to find their escrow. An on-chain indexer or event listener would let users discover unclaimed escrows by verifying their phone number directly, removing the SMS dependency from the trust path.

---

## The case for phone-number payments on Solana

UPI works because the identifier is a phone number. Crypto payments have worse adoption than a two-decade-old NPCI protocol partly because the identifier is a base58 string. That is a solvable problem.

ZingPay moves the identifier down to the phone layer. A sender anywhere can transfer SOL to someone who has never opened a wallet app. The recipient claims into a fresh keypair generated in-browser, or into a wallet they already have. The sender's funds are not at risk either: they lock on-chain and are fully refundable after 72 hours if nobody claims.

The goal is not to replace existing rails. It is to make Solana usable for payments where the recipient has a phone but no wallet address to share.

---
