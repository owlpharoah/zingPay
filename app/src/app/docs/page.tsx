import {
  DocCallout,
  DocCard,
  DocHero,
  DocLinkButton,
  DocList,
} from "@/components/docs/DocsPrimitives";

export default function DocsHomePage() {
  return (
    <div className="space-y-5">
      <DocHero
        kicker="ZingPay Docs"
        title="Webapp documentation for users and builders"
        description="ZingPay lets senders transfer with just a phone number while preserving on-chain settlement. This documentation covers onboarding, protocol behavior, and integration patterns."
      >
        <DocLinkButton href="/docs/newcomers">Start with Web3 Basics</DocLinkButton>
        <DocLinkButton href="/docs/developers">Read Developer Docs</DocLinkButton>
      </DocHero>

      <div className="docs-card">
        <h2 className="text-2xl font-semibold text-[#103e28]">Quickstart</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border-2 border-[#103e28] bg-[#f5faee] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#2a5a3d]">1. Learn</p>
            <p className="mt-1 text-sm text-[#214630]">Understand wallets, keys, and safe import steps before handling funds.</p>
          </div>
          <div className="rounded-2xl border-2 border-[#103e28] bg-[#f5faee] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#2a5a3d]">2. Build</p>
            <p className="mt-1 text-sm text-[#214630]">Integrate OTP flows and claim transaction handling with backend API contracts.</p>
          </div>
          <div className="rounded-2xl border-2 border-[#103e28] bg-[#f5faee] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#2a5a3d]">3. Operate</p>
            <p className="mt-1 text-sm text-[#214630]">Monitor claim authority balance, Twilio OTP health, and refund lifecycle behavior.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DocCard title="New to Web3">
          <p>This track is written for people who have never used crypto before.</p>
          <DocList
            items={[
              "What wallets are and why they matter",
              "Public key vs private key vs seed phrase",
              "How to safely import wallets",
              "How ZingPay claim flow works in plain language",
            ]}
          />
          <DocLinkButton href="/docs/newcomers">Open newcomer track</DocLinkButton>
        </DocCard>

        <DocCard title="For Developers">
          <p>This track documents ZingPay protocol behavior and integration details.</p>
          <DocList
            items={[
              "Backend endpoints and payloads",
              "Claim and register transaction assembly",
              "Account model, PDA seeds, and expiry semantics",
              "Security assumptions and key innovations",
            ]}
          />
          <DocLinkButton href="/docs/developers">Open developer track</DocLinkButton>
        </DocCard>
      </div>

      <DocCard title="Architecture Snapshot">
        <DocList
          items={[
            "Frontend app handles send, claim, register, and history experiences.",
            "Backend verifies OTP, builds partial transactions, and sends claim notifications.",
            "Solana program maintains escrow and registry PDAs with 72-hour expiry semantics.",
            "Twilio Verify service enforces phone possession as an authentication factor.",
          ]}
        />
      </DocCard>

      <DocCallout tone="warn" title="Trust Model">
        Current production design depends on two centralized services: the claim authority signer and Twilio Verify. This trade-off is intentional to reduce onboarding friction.
      </DocCallout>
    </div>
  );
}
