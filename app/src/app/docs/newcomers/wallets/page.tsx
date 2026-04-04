import { DocCallout, DocCard, DocHero, DocList } from "@/components/docs/DocsPrimitives";

export default function WalletsPage() {
  return (
    <div className="space-y-5">
      <DocHero
        kicker="Wallet Basics"
        title="What is a wallet and what is it used for?"
        description="A Solana wallet stores your keys and signs transactions. It does not store your funds locally; funds live on-chain and your wallet proves ownership."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <DocCard title="Core Terms">
          <DocList
            items={[
              "Public key: Your wallet address that others can send funds to.",
              "Private key: Secret key that can spend your funds.",
              "Seed phrase: Human-readable backup that can regenerate wallet keys.",
              "Signer: The entity that authorizes a transaction.",
            ]}
          />
        </DocCard>
        <DocCard title="Custodial vs Non-Custodial">
          <DocList
            items={[
              "Custodial: A provider controls keys for you.",
              "Non-custodial: You control keys directly.",
              "ZingPay claim flow ends in your own non-custodial wallet.",
              "If you lose your keys in non-custodial mode, no one can recover funds for you.",
            ]}
          />
        </DocCard>
      </div>

      <DocCallout tone="warn" title="Practical Tip">
        Always test with small amounts on devnet first. Build confidence with receive and send before moving larger funds.
      </DocCallout>
    </div>
  );
}
