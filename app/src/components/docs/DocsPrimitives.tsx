import Link from "next/link";
import type { ReactNode } from "react";

export function DocHero({
  kicker,
  title,
  description,
  children,
}: {
  kicker: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="docs-hero">
      <div className="relative z-10">
        <p className="docs-chip">{kicker}</p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm text-[#d5ebde] sm:text-base">{description}</p>
        {children ? <div className="mt-5 flex flex-wrap gap-2">{children}</div> : null}
      </div>
    </section>
  );
}

export function DocLinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="upi-link-chip font-semibold">
      {children}
    </Link>
  );
}

export function DocCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="docs-card">
      <h2 className="text-xl font-semibold text-[#103e28]">{title}</h2>
      <div className="mt-2 space-y-3 text-sm text-[#234a35]">{children}</div>
    </section>
  );
}

export function DocCallout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn" | "danger";
  title: string;
  children: ReactNode;
}) {
  const className = tone === "info" ? "docs-callout" : `docs-callout ${tone}`;
  return (
    <aside className={className}>
      <p className="text-xs font-bold uppercase tracking-[0.12em]">{title}</p>
      <div className="mt-2 text-sm leading-6">{children}</div>
    </aside>
  );
}

export function DocList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-[#214630]">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function DocStep({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border-2 border-[#103e28] bg-[#f6f6f1] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2a5a3d]">Step {number}</p>
      <h3 className="mt-1 text-base font-semibold text-[#103e28]">{title}</h3>
      <div className="mt-2 text-sm leading-6 text-[#254936]">{children}</div>
    </div>
  );
}
