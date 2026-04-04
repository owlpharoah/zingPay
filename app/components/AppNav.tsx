"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/send", label: "Send" },
  { href: "/claim", label: "Claim" },
  { href: "/register", label: "ID Register" },
  { href: "/history", label: "History" },
  { href: "/refund", label: "Refund" },
];

export default function AppNav() {
  const pathname = usePathname();

  return (
    <nav className=" bg-[#f6f6f1] px-4 py-3 lg:px-8">
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
