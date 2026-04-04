import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import AppWalletProvider from "@/components/AppWalletProvider"; 
import "@fontsource/fraunces/400.css";        // Regular weight
import "@fontsource/fraunces/200-italic.css"; // Regular Italic
import "@fontsource/fraunces/600.css";        // Semibold
import "@fontsource/fraunces/600-italic.css"; // Semibold Italic
import "@fontsource/fraunces/700.css";        // Bold
import "@fontsource/fraunces/700-italic.css"; // Bold Italic
import SmoothScroll from "@/components/SmoothScroll"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SolPay",
  description: "Phone-to-wallet resolution layer for Solana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen flex flex-col">
        <SmoothScroll>
          <AppWalletProvider>{children}</AppWalletProvider>
        </SmoothScroll>
      </body>
    </html>
  );
}
