import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = {
  title: "ZingPay Docs",
  description: "ZingPay documentation for newcomers and developers.",
};

export default function DocsLayout({ children }: { children: ReactNode }) {
  const sections = [
    {
      title: "Start",
      links: [
        { href: "/docs", label: "Overview" },
        { href: "/docs/newcomers", label: "New to Web3" },
        { href: "/docs/developers", label: "Developer Docs" },
      ],
    },
    {
      title: "Newcomer Guides",
      links: [
        { href: "/docs/newcomers/wallets", label: "Wallet Basics" },
        { href: "/docs/newcomers/private-keys", label: "Private Keys" },
        { href: "/docs/newcomers/import-wallet", label: "Import Wallet" },
      ],
    },
    {
      title: "Protocol",
      links: [
        { href: "/docs/developers/protocol", label: "Architecture" },
        { href: "/docs/developers/api-reference", label: "API Reference" },
        { href: "/docs/developers/innovations", label: "Innovations" },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-[18px] border-2 border-[#103e28] bg-[#07331f] p-4 text-[#d7efdc]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="docs-chip">ZingPay Docs</span>
          <p className="text-sm text-[#d7efdc]">
            Phone-first payments on Solana. Learn as a newcomer or integrate as a developer.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="docs-card h-fit lg:sticky lg:top-4">
          {sections.map((group) => (
            <div key={group.title} className="mb-4 last:mb-0">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2d5c40]">{group.title}</p>
              <ul className="mt-2 space-y-1.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="block rounded-xl border border-[#b8c7b8] bg-[#f8fbf4] px-3 py-2 text-sm font-medium text-[#1e4a33] transition hover:border-[#103e28] hover:bg-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </aside>

        <article className="space-y-4">{children}</article>
      </div>
    </div>
  );
}
