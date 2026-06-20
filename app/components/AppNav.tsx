"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRegistration, isLocalhost } from "@/lib/useRegistration";

export default function AppNav() {
  const pathname = usePathname();
  const { registered } = useRegistration();

  // Once the connected wallet is registered, the "ID Register" entry becomes
  // "Modify". Until then we show "ID Register" (the default while loading or
  // when no wallet is connected). On localhost we always surface "Modify" too,
  // so the route stays reachable during development.
  const navItems: { href: string; label: string }[] = [
    { href: "/send", label: "Send" },
    registered
      ? { href: "/modify", label: "Modify" }
      : { href: "/register", label: "ID Register" },
    { href: "/history", label: "History" },
  ];

  if (!registered && isLocalhost()) {
    navItems.push({ href: "/modify", label: "Modify (dev)" });
  }

  return (
    <nav className=" bg-white px-4 py-3 lg:px-8">
      <div className="mx-auto flex max-w-2xl flex-wrap justify-center gap-2">
        {navItems.map((item) => {
          const active =
            pathname === item.href ||
            pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex items-center rounded-full border-2 border-[#103e28] px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-[#0B2818] text-[#B8FF4F] hover:bg-[#0B2818]"
                  : "bg-white text-[#0f2d1c] hover:bg-[#f3f5ea]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
