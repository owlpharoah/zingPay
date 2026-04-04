import { DocCallout, DocHero, DocStep } from "@/components/docs/DocsPrimitives";

export default function ImportWalletPage() {
  return (
    <div className="space-y-5">
      <DocHero
        kicker="Import Guide"
        title="How to import a wallet safely"
        description="Importing a wallet means recreating access from your seed phrase or private key in a wallet app. Only perform this on trusted devices."
      />

      <div className="grid gap-4">
        <DocStep number={1} title="Install a trusted wallet app">
          Use an official source only. Verify the publisher and reviews before installation.
        </DocStep>
        <DocStep number={2} title="Choose Import Existing Wallet">
          Select recovery method using either seed phrase or private key. Do not paste this into random websites.
        </DocStep>
        <DocStep number={3} title="Enter recovery credentials offline">
          Disable screen sharing, avoid public Wi-Fi, and ensure no one can view your screen.
        </DocStep>
        <DocStep number={4} title="Set device security">
          Enable OS lock, wallet passcode, and biometric unlock where available.
        </DocStep>
        <DocStep number={5} title="Verify address and test">
          Confirm imported public key matches your expected address. Send a small test transfer first.
        </DocStep>
      </div>

      <DocCallout tone="warn" title="After Import">
        If you suspect credentials were exposed during import, immediately move funds to a newly created wallet with a fresh seed phrase.
      </DocCallout>
    </div>
  );
}
