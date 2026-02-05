// src/components/ConnectModal.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import WalletRow from "./WalletRow";
import { getInjectedWallets, type InjectedWallet } from "@/lib/injectedWallets";
import {
  initWalletConnect,
  connectWalletConnect,
} from "@/lib/walletconnect";

type Props = {
  open: boolean;
  onClose: () => void;
  onConnected: (payload: { provider: any; address: string }) => void;
};

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

async function requestAccounts(provider: any): Promise<string[]> {
  // Standard EIP-1193
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  return accounts as string[];
}

export default function ConnectModal({ open, onClose, onConnected }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const injected: InjectedWallet[] = useMemo(() => {
    if (!open) return [];
    return getInjectedWallets();
  }, [open]);

  // Reset state when opening/closing
  useEffect(() => {
    if (!open) {
      setBusyId(null);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  async function handleInjectedClick(w: InjectedWallet) {
    setError(null);
    setBusyId(w.id);
    try {
      const accounts = await requestAccounts(w.provider);
      const address = accounts?.[0];
      if (!address) throw new Error("No account returned from wallet");
      onConnected({ provider: w.provider, address });
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Failed to connect wallet");
    } finally {
      setBusyId(null);
    }
  }

  async function handleWalletConnect() {
    setError(null);
    setBusyId("walletconnect");
    try {
      const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;
      if (!projectId) {
        throw new Error(
          "Missing NEXT_PUBLIC_WC_PROJECT_ID in .env.local"
        );
      }

      // Lazy init ONLY here
      const wc = await initWalletConnect({
        projectId,
        chains: [1], // ETH mainnet only
        showQrModal: true,
        metadata: {
          name: "Rescue Mini",
          description: "ETH Mainnet Rescue",
          url: "https://example.com",
          icons: ["https://example.com/icon.png"],
        },
      });

      const accounts = await connectWalletConnect(wc);
      const address = accounts?.[0];
      if (!address) throw new Error("No account returned from WalletConnect");

      onConnected({ provider: wc, address });
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Failed to connect WalletConnect");
    } finally {
      setBusyId(null);
    }
  }

  const injectedEmpty = injected.length === 0;

  return (
    <div className="fixed inset-0 z-50">
      {/* backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label="Close"
      />

      {/* modal */}
      <div className="relative mx-auto mt-24 w-[92vw] max-w-md">
        <div className="rounded-2xl bg-white shadow-xl border overflow-hidden">
          {/* header */}
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold text-gray-900">
                Connect wallet
              </div>
              <div className="text-sm text-gray-500">
                Choose an injected wallet or WalletConnect.
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-gray-500 hover:bg-gray-100"
            >
              ✕
            </button>
          </div>

          {/* content */}
          <div className="px-5 py-4 space-y-3">
            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="space-y-2">
              {injectedEmpty ? (
                <div className="rounded-xl border bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  No injected wallets detected in this browser.
                </div>
              ) : (
                injected.map((w) => (
                  <WalletRow
                    key={w.id}
                    name={w.name}
                    subtitle="Injected wallet"
                    disabled={busyId !== null}
                    onClick={() => handleInjectedClick(w)}
                    right={
                      busyId === w.id ? (
                        <span className="text-sm text-gray-500">Connecting…</span>
                      ) : (
                        <span className="text-sm text-gray-400">→</span>
                      )
                    }
                  />
                ))
              )}
            </div>
          </div>

          {/* footer pinned bottom */}
          <div className="px-5 py-4 border-t bg-gray-50">
            <WalletRow
              name="WalletConnect"
              subtitle="Scan QR with mobile wallet"
              disabled={busyId !== null}
              onClick={handleWalletConnect}
              right={
                busyId === "walletconnect" ? (
                  <span className="text-sm text-gray-500">Opening…</span>
                ) : (
                  <span className="text-sm text-gray-400">QR</span>
                )
              }
            />

            <div className="mt-3 text-xs text-gray-500">
              After connecting, we’ll switch to Ethereum Mainnet automatically.
            </div>
          </div>
        </div>

        {/* tiny helper showing connected address if you ever want it */}
        {/* kept out for now */}
      </div>
    </div>
  );
}
