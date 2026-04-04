import { DocCallout, DocCard, DocHero, DocList } from "@/components/docs/DocsPrimitives";

export default function InnovationsPage() {
  return (
    <div className="space-y-5">
      <DocHero
        kicker="Innovations"
        title="What makes ZingPay different"
        description="ZingPay is designed to make crypto transfers feel like phone-native payments while retaining on-chain settlement."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <DocCard title="Phone-hash identity">
          <DocList
            items={[
              "Phone numbers are hashed (SHA-256) before on-chain usage.",
              "Registry and escrow account discovery use deterministic PDAs.",
              "Plain phone numbers are not stored on-chain.",
            ]}
          />
        </DocCard>

        <DocCard title="OTP-gated claim auth">
          <DocList
            items={[
              "Twilio Verify confirms control of destination phone.",
              "Backend builds claim tx only after OTP approval.",
              "Authentication is phone possession, settlement is wallet signature.",
            ]}
          />
        </DocCard>

        <DocCard title="Pseudo-gasless claim sponsorship">
          <DocList
            items={[
              "Claim authority partially signs claim transactions.",
              "Backend prefunds claimant for account setup and recovers that prefund in the same transaction.",
              "Claim authority still pays the network fee.",
              "Reduces onboarding friction for first-time claimants while limiting sponsor burn.",
            ]}
          />
        </DocCard>

        <DocCard title="Resilience mechanics">
          <DocList
            items={[
              "Escrows expire at 72h and become refundable.",
              "Refund call is permissionless after expiry.",
              "Auto-registration after claim enables future direct routing.",
            ]}
          />
        </DocCard>
      </div>

      <DocCallout title="Design Trade-off">
        The current model intentionally trades full decentralization for UX simplicity: centralized OTP and claim-authority signer provide smoother onboarding.
      </DocCallout>
    </div>
  );
}
