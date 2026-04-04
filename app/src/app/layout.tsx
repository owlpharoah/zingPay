import type { Metadata } from "next";
import "./globals.css";
import WalletProvider from "@/components/WalletProvider";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "ZingPay",
  description: "UPI-style mobile flow for sending, claiming and tracking SOL payments.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <AppShell>{children}</AppShell>
        </WalletProvider>
      </body>
    </html>
  );
}
