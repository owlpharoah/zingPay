"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import "@fontsource/fraunces";
import "@fontsource/outfit";
import { useWallet } from "@solana/wallet-adapter-react";
import AppNav from "@/components/AppNav";
import { WalletDropdown } from "@/components/WalletDropdown";

type SentRecord = {
  txSig: string;
  phone: string;
  amountSol: string;
  mode: "direct" | "escrow";
  createdAt: number;
};

export default function HistoryPage() {
  const { publicKey } = useWallet();
  const [history, setHistory] = useState<SentRecord[]>([]);

  const historyKey = publicKey
    ? `solpay_sent_history_${publicKey.toString()}`
    : "solpay_sent_history_guest";

  useEffect(() => {
    if (!publicKey) {
      setHistory([]);
      return;
    }
    try {
      const raw = localStorage.getItem(historyKey);
      const parsed: SentRecord[] = raw ? JSON.parse(raw) : [];
      setHistory(Array.isArray(parsed) ? parsed : []);
    } catch {
      setHistory([]);
    }
  }, [historyKey, publicKey]);

  return (
    <div className="bg-[#F6F5F0] min-h-screen flex flex-col font-[outfit]">
      {/* Header */}
      <div className="bg-[#0B2818] flex items-center justify-around h-[131px] max-sm:h-[80px] p-4 max-sm:px-2 shrink-0">
        <Link href="/">
          <div className="flex items-center">
            <Image alt="back" src="/back.svg" width={12} height={23} className="inline-block mr-4 max-sm:mr-2 max-sm:w-2 max-sm:h-[14px]" />
            <p className="text-white font-[outfit] font-semibold text-xl max-sm:text-sm">Back</p>
          </div>
        </Link>
        <Image alt="zingpay" src="/zingpay.svg" width={172} height={57} className="w-[172px] h-auto max-sm:w-[110px]" />
        <WalletDropdown />
      </div>

      <AppNav />

      {/* Main Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-6 max-sm:px-4 py-10 max-sm:py-6">
        <h1 className="text-4xl max-sm:text-3xl text-[#0B2818] font-[fraunces] font-black mb-2 tracking-tight">
          Transaction <span className="italic font-normal">History.</span>
        </h1>
        <p className="text-[#6B7280] text-sm max-sm:text-xs mb-8 max-sm:mb-6 font-medium">
          Last 50 transactions sent from this wallet on this browser.
        </p>

        {!publicKey ? (
          <div className="bg-white border-2 border-[#0B2818] rounded-2xl p-8 text-center">
            <p className="text-gray-500 text-sm">Connect your wallet to view sent transaction history.</p>
          </div>
        ) : history.length === 0 ? (
          <div className="bg-white border-2 border-[#0B2818] rounded-2xl p-8 text-center">
            <p className="text-gray-500 text-sm">No sent transactions yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((item) => (
              <div key={item.txSig} className="bg-white border-2 border-[#0B2818] rounded-2xl overflow-hidden">
                <div className="bg-[#0B2818] px-5 py-2.5 flex items-center justify-between">
                  <span className="text-[#B8FF4F] font-bold text-xs uppercase tracking-widest">{item.mode}</span>
                  <span className="text-gray-400 text-xs">{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Sent to</p>
                      <p className="text-[#0B2818] font-bold text-base">{item.phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 mb-1">Amount</p>
                      <p className="font-[fraunces] text-2xl font-black text-[#0B2818]">{item.amountSol} SOL</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400">{new Date(item.createdAt).toLocaleString()}</p>
                    <a
                      href={`https://explorer.solana.com/tx/${item.txSig}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-[#0B2818] hover:text-[#B8FF4F] transition-colors"
                    >
                      View on Explorer &rarr;
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <div className="bg-[#0B2818] p-10 max-sm:p-6 flex flex-col items-center justify-center shrink-0 mt-auto">
        <Image alt="zingpay" src="/zingpay.svg" width={130} height={37} className="block mx-auto max-sm:w-[100px] h-auto" />
        <p className="text-white text-lg max-sm:text-sm font-normal mt-4 max-sm:mt-2 font-[outfit] font-semibold text-center max-w-sm">
          No downloads, No signups, Just open the app and go!
        </p>
      </div>
    </div>
  );
}
