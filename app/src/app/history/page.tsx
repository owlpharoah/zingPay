"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

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
    <div className="space-y-4">
      <section className="upi-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2d5c3d]">
          History
        </p>
        <h2 className="mt-1 text-xl font-semibold text-[#0f2d1c]">Recent payments</h2>
        <p className="mt-1 text-xs text-[#3f5f4a]">
          Last 50 transactions sent from this wallet on this browser.
        </p>
      </section>

      <section className="upi-card space-y-2">
        {!publicKey ? (
          <div className="upi-subtle-panel text-sm text-[#3f5f4a]">
            Connect your wallet to view sent transaction history.
          </div>
        ) : history.length === 0 ? (
          <div className="upi-subtle-panel text-sm text-[#3f5f4a]">
            No sent transactions yet.
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((item) => (
              <div key={item.txSig} className="upi-subtle-panel">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[#123c26]">{item.phone}</p>
                  <span className="upi-pill uppercase">{item.mode}</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-[#0f5a34]">{item.amountSol} SOL</p>
                <p className="mt-0.5 text-xs text-[#55705e]">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
                <a
                  href={`https://explorer.solana.com/tx/${item.txSig}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs font-medium text-[#0f5a34]"
                >
                  Open transaction
                </a>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
