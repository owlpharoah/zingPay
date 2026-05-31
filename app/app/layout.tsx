import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces, Outfit } from "next/font/google";
import "./globals.css";
import AppWalletProvider from "@/components/AppWalletProvider"; 
import "@fontsource/fraunces/400.css";        // Regular weight
import "@fontsource/fraunces/200-italic.css"; // Regular Italic
import "@fontsource/fraunces/600.css";        // Semibold
import "@fontsource/fraunces/600-italic.css"; // Semibold Italic
import "@fontsource/fraunces/700.css";        // Bold
import "@fontsource/fraunces/700-italic.css"; // Bold Italic
import { Jersey_25 } from 'next/font/google';
import SmoothScroll from "@/components/SmoothScroll"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jersey = Jersey_25({ 
  weight: '400',
  subsets: ['latin'],
  variable: '--font-jersey', // Define a CSS variable for Tailwind
});

const outfit = Outfit({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-outfit', // Define a CSS variable for Tailwind
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ZingPay",
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
      className={`${geistSans.variable} ${geistMono.variable} ${jersey.variable} ${outfit.variable} antialiased`}
    >
      <head>
        <link rel="icon" href="/favicon.svg" />
      </head>
      <body className="min-h-screen flex flex-col">
        <SmoothScroll>
          <AppWalletProvider>{children}</AppWalletProvider>
        </SmoothScroll>
      </body>
    </html>
  );
}
