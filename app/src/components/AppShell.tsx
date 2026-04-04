"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const primaryNavItems = [
  { href: "/", label: "Pay", icon: "₹" },
  { href: "/register", label: "Register", icon: "ID" },
  { href: "/history", label: "History", icon: "⏱" },
  { href: "/received", label: "Received", icon: "↓" },
  { href: "/refund", label: "Refund", icon: "↺" },
];

const docsNavItem = { href: "/docs", label: "Docs", icon: "📘" };

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isDocsRoute = pathname.startsWith("/docs");

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href));

  useEffect(() => {
    for (const item of [...primaryNavItems, docsNavItem]) {
      router.prefetch(item.href);
    }
    router.prefetch("/claim");
  }, [router]);

  return (
    <div className="min-h-screen px-3 py-4 sm:py-6">
      <div className="mx-auto hidden min-h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-[30px] border-2 border-[#103e28] bg-[#f6f6f1] shadow-[0_4px_0_#103e28] lg:block">
        <header className="flex items-center justify-between border-b-2 border-[#103e28] bg-[#07331f] px-8 py-5 text-white">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#c8ff58]">ZingPay</p>
            <h1 className="mt-1 text-2xl font-semibold">
              {isDocsRoute ? "Documentation" : "Payments Dashboard"}
            </h1>
          </div>
          <span className="rounded-full border-2 border-[#103e28] bg-[#abf047] px-3 py-1 text-xs font-semibold text-[#0f2d1c]">
            Devnet
          </span>
        </header>

        <div className="grid h-[calc(100vh-7.5rem)] grid-cols-[240px_1fr]">
          <aside className="flex flex-col border-r-2 border-[#103e28] bg-[#edf2e7] p-4">
            <div>
              <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#2a5a3d]">
                Payments
              </p>
              <ul className="space-y-1.5">
                {primaryNavItems.map((item) => {
                  const active = isActive(item.href);

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                          active
                            ? "border-2 border-[#103e28] bg-[#abf047] text-[#0f2d1c]"
                            : "text-[#2a5a3d] hover:bg-[#e3ead8]"
                        }`}
                      >
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="mt-auto pt-4">
              <Link
                href={docsNavItem.href}
                className={`flex items-center justify-between rounded-xl border-2 px-3 py-2 text-sm font-semibold transition ${
                  isActive(docsNavItem.href)
                    ? "border-[#103e28] bg-[#abf047] text-[#0f2d1c]"
                    : "border-[#103e28] bg-[#07331f] text-[#d9f6a5] hover:bg-[#0a3a23]"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{docsNavItem.icon}</span>
                  <span>{docsNavItem.label}</span>
                </span>
                <span>↗</span>
              </Link>
            </div>
          </aside>

          <main className="overflow-y-auto px-8 py-6">
            <div className={`mx-auto w-full ${isDocsRoute ? "max-w-none" : "max-w-4xl"}`}>
              {children}
            </div>
          </main>
        </div>
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-[28px] border-2 border-[#103e28] bg-[#f6f6f1] shadow-[0_4px_0_#103e28] lg:hidden">
        <header className="bg-[#07331f] px-4 pb-5 pt-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#c8ff58]">ZingPay</p>
              <h1 className="mt-1 text-xl font-semibold">
                {isDocsRoute ? "Documentation" : "Payments"}
              </h1>
            </div>
            <span className="rounded-full border-2 border-[#103e28] bg-[#abf047] px-3 py-1 text-xs font-semibold text-[#0f2d1c]">
              Devnet
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-4 pb-28">{children}</main>

        <nav className="border-t-2 border-[#103e28] bg-[#edf2e7] px-2 py-2">
          <ul className="grid grid-cols-5 gap-1">
            {primaryNavItems.map((item) => {
              const active = isActive(item.href);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition ${
                      active
                        ? "border-2 border-[#103e28] bg-[#abf047] text-[#0f2d1c]"
                        : "text-[#2a5a3d] hover:bg-[#e3ead8]"
                    }`}
                  >
                    <span className="text-sm">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <Link
            href={docsNavItem.href}
            className={`mt-2 flex items-center justify-center gap-2 rounded-2xl border-2 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition ${
              isActive(docsNavItem.href)
                ? "border-[#103e28] bg-[#abf047] text-[#0f2d1c]"
                : "border-[#103e28] bg-[#07331f] text-[#d9f6a5] hover:bg-[#0a3a23]"
            }`}
          >
            <span>{docsNavItem.icon}</span>
            <span>Open Docs</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}
