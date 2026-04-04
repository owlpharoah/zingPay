import {
  DocCallout,
  DocCard,
  DocHero,
  DocLinkButton,
  DocList,
} from "@/components/docs/DocsPrimitives";

export default function NewcomersDocsPage() {
  return (
    <div className="space-y-5">
      <DocHero
        kicker="New to Web3"
        title="Understand wallets before you move funds"
        description="This guide explains crypto concepts with ZingPay examples so you can send and claim securely without guessing."
      >
        <DocLinkButton href="/docs/newcomers/wallets">Wallet Fundamentals</DocLinkButton>
        <DocLinkButton href="/docs/newcomers/private-keys">Private Keys and Seed Phrases</DocLinkButton>
        <DocLinkButton href="/docs/newcomers/import-wallet">Import Wallets Safely</DocLinkButton>
      </DocHero>

      <DocCallout tone="danger" title="Critical Safety Rule">
        Never share your seed phrase or private key with anyone. ZingPay support, wallet teams, and exchanges will never ask for it.
      </DocCallout>

      <div className="grid gap-4 md:grid-cols-2">
        <DocCard title="Start Here">
          <DocList
            items={[
              "A wallet is your identity and signer on Solana.",
              "Your public key is like your account number.",
              "Your private key/seed phrase controls your funds.",
              "Transactions are valid only when signed by your wallet.",
            ]}
          />
        </DocCard>
        <DocCard title="How This Maps to ZingPay">
          <DocList
            items={[
              "Sender can transfer using a phone number.",
              "Receiver proves phone ownership using OTP.",
              "Claim transaction is sponsored by claim authority, then the temporary setup prefund is recovered in the same transaction.",
              "Receiver signs once and funds arrive in their wallet.",
            ]}
          />
        </DocCard>
      </div>
    </div>
  );
}
