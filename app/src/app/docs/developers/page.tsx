import {
  DocCard,
  DocHero,
  DocLinkButton,
  DocList,
} from "@/components/docs/DocsPrimitives";

export default function DeveloperDocsPage() {
  return (
    <div className="space-y-5">
      <DocHero
        kicker="Developer Docs"
        title="ZingPay protocol and integration guide"
        description="Architecture, APIs, transaction assembly, and operational assumptions for teams integrating with ZingPay."
      >
        <DocLinkButton href="/docs/developers/protocol">Protocol Overview</DocLinkButton>
        <DocLinkButton href="/docs/developers/api-reference">API Reference</DocLinkButton>
        <DocLinkButton href="/docs/developers/innovations">Key Innovations</DocLinkButton>
      </DocHero>

      <div className="grid gap-4 md:grid-cols-2">
        <DocCard title="Coverage">
          <DocList
            items={[
              "Phone-hash based identity and PDA derivations",
              "Claim and register OTP verification flows",
              "Claim prefund reimbursement policy (pseudo-gasless)",
              "Refund lifecycle and cron operation",
              "Trust boundaries: Twilio + claim authority",
            ]}
          />
        </DocCard>

        <DocCard title="Source of Truth">
          <DocList
            items={[
              "Backend behavior from server/src/index.ts",
              "Program constraints from programs/solpay/src/lib.rs",
              "Instruction/account schema from server/idl/solpay.json",
              "This docs route intentionally reflects current implementation",
            ]}
          />
        </DocCard>
      </div>
    </div>
  );
}
