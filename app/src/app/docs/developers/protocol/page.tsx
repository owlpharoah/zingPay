import { DocCallout, DocCard, DocHero, DocList } from "@/components/docs/DocsPrimitives";

export default function ProtocolPage() {
  return (
    <div className="space-y-5">
      <DocHero
        kicker="Protocol"
        title="ZingPay architecture and lifecycle"
        description="ZingPay combines Solana escrow accounts, OTP verification, and claim authority sponsorship to deliver phone-first transfers."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <DocCard title="System Layers">
          <DocList
            items={[
              "Frontend app: send, claim, register, history UX.",
              "Backend server: Twilio OTP verification and transaction assembly.",
              "Solana program: escrow and registry state transitions.",
              "Twilio Verify: phone possession proof during claim/lookup/register.",
            ]}
          />
        </DocCard>

        <DocCard title="On-chain Accounts">
          <DocList
            items={[
              "RegistryAccount PDA: [registry, phone_hash]",
              "EscrowAccount PDA: [escrow, sender, phone_hash]",
              "Escrow holds amount and created_at timestamp",
              "Expiry window is 72 hours before refund eligibility",
            ]}
          />
        </DocCard>
      </div>

      <DocCard title="Primary Flows">
        <DocList
          items={[
            "send_escrow: lock funds for unregistered recipient phone hash",
            "notify: backend sends claim link SMS",
            "otp/send + otp/verify: Twilio verification then partial claim tx",
            "register_phone: explicit wallet registration for direct future transfers",
            "refund_escrow: permissionless reclaim after expiry",
          ]}
        />
      </DocCard>

      <DocCallout tone="info" title="Trust Boundary">
        Current deployment trusts a centralized claim authority signer and Twilio as OTP verifier. These are explicit dependencies for sponsored claims with prefund recovery and phone authentication.
      </DocCallout>
    </div>
  );
}
