import { DocCallout, DocCard, DocHero, DocList } from "@/components/docs/DocsPrimitives";

export default function ApiReferencePage() {
  return (
    <div className="space-y-5">
      <DocHero
        kicker="API Reference"
        title="Backend endpoints used by ZingPay"
        description="This page documents request contracts and behavior currently implemented in server/src/index.ts."
      />

      <DocCard title="Core Endpoints">
        <DocList
          items={[
            "GET /health -> status, programId, claimAuthority, claimAuthorityBalanceLamports",
            "POST /notify -> validates escrow account and sends claim SMS",
            "POST /otp/send -> sends claim OTP for escrow-bound phone",
            "POST /otp/verify -> verifies OTP and returns base64 partial claim transaction",
            "POST /otp/send-register + /otp/verify-register -> wallet registration flow",
            "POST /received/send-otp + /received/lookup -> recipient history access",
          ]}
        />
      </DocCard>

      <DocCard title="Claim Tx assembly in /otp/verify">
        <DocList
          items={[
            "Resolves recipient phone from escrow map or on-chain phone hash check",
            "Checks claim authority sponsorship capacity (rent + estimated fee)",
            "Transfers temporary prefund lamports to claimant for registry setup",
            "Builds claimEscrow instruction with claimAuthority partial signature",
            "Adds claimant -> claimAuthority reimbursement transfer (prefund recovery only)",
            "Returns serialized transaction for claimant co-sign and broadcast",
          ]}
        />
      </DocCard>

      <DocCallout tone="warn" title="Operational Notes">
        OTP rate limits are currently in-memory. Restarting the backend clears buckets. For production hardening, move limits to a shared store.
      </DocCallout>
    </div>
  );
}
