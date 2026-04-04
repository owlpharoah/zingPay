"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import Image from "next/image";

export function WalletDropdown() {
  const { wallets, select, wallet, disconnect, publicKey } = useWallet();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-4 max-sm:p-2 max-sm:px-3 flex items-center bg-[#B8FF4F] rounded-4xl space-x-2 cursor-pointer transition-transform active:scale-95"
      >
        <Image alt="wallet icon" src="/wallet.svg" width={18} height={18} className="max-sm:w-4 max-sm:h-4" />
        <p className="text-[#0B2818] font-[outfit] font-semibold max-sm:text-xs">
          {publicKey
            ? `${publicKey.toString().slice(0, 4)}...${publicKey.toString().slice(-4)}`
            : "Connect Wallet"}
        </p>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-14 right-0 bg-white border-2 border-[#0B2818] rounded-2xl shadow-lg w-64 z-50 overflow-hidden font-[outfit]">
            {wallets.length === 0 && (
              <p className="p-4 text-sm text-gray-500">No wallets detected</p>
            )}

            {wallets.map((w) => {
              const isInstalled =
                w.readyState === "Installed" || w.readyState === "Loadable";

              return (
                <button
                  key={w.adapter.name}
                  onClick={() => {
                    if (!isInstalled) {
                      window.open(w.adapter.url, "_blank");
                      return;
                    }
                    select(w.adapter.name);
                    setOpen(false);
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-[#B8FF4F]/20 text-left transition-colors border-b border-gray-100 last:border-b-0"
                >
                  <img
                    src={w.adapter.icon}
                    className="w-6 h-6 rounded-md"
                    alt={w.adapter.name}
                  />
                  <span className="flex-1 font-semibold text-sm text-[#0B2818]">
                    {w.adapter.name}
                  </span>
                  {wallet?.adapter.name === w.adapter.name && publicKey ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#0B2818] bg-[#B8FF4F] px-2 py-1 rounded-full">
                      Connected
                    </span>
                  ) : !isInstalled ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                      Install
                    </span>
                  ) : null}
                </button>
              );
            })}

            {publicKey && (
              <button
                onClick={() => {
                  disconnect();
                  setOpen(false);
                }}
                className="w-full px-4 py-3 text-left text-red-600 hover:bg-red-50 border-t-2 border-[#0B2818]/10 text-sm font-semibold transition-colors"
              >
                Disconnect
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
