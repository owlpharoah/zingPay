import { DocCallout, DocCard, DocHero, DocList } from "@/components/docs/DocsPrimitives";

export default function PrivateKeysPage() {
  return (
    <div className="space-y-5">
      <DocHero
        kicker="Private Keys"
        title="Seed phrase and private key safety"
        description="Your private key and seed phrase are the only credentials needed to control your wallet. Treat them like irreversible master passwords."
      />

      <DocCallout tone="danger" title="Never Do This">
        Do not share seed phrases in chat, email, forms, screenshots, or cloud notes. Anyone with these words can drain your wallet.
      </DocCallout>

      <div className="grid gap-4 md:grid-cols-2">
        <DocCard title="What to back up">
          <DocList
            items={[
              "Write seed phrase on paper and store it offline.",
              "Use two physically separate backup locations.",
              "Confirm word order and spelling exactly.",
              "Run a recovery test on a spare device before funding wallet.",
            ]}
          />
        </DocCard>
        <DocCard title="Common attack patterns">
          <DocList
            items={[
              "Fake support agents asking for recovery phrase.",
              "Phishing pages that look like real wallet sites.",
              "Clipboard malware replacing copied addresses.",
              "Browser extensions that request unnecessary permissions.",
            ]}
          />
        </DocCard>
      </div>
    </div>
  );
}
