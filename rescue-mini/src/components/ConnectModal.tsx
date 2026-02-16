// src/components/ConnectModal.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getInjectedWallets } from "@/lib/injectedWallets";

type Props = {
  open: boolean;
  onClose: () => void;
  onConnected: (args: { provider: any; address: string }) => Promise<void> | void;
};

function isEip1193(p: any) {
  return !!p && typeof p.request === "function";
}

async function requestAccounts(p: any): Promise<string[]> {
  return (await p.request({ method: "eth_requestAccounts" })) as string[];
}

// ✅ WalletConnect (dynamic import so it never runs on server)
async function connectWithWalletConnect(): Promise<any> {
  const { default: EthereumProvider } = await import("@walletconnect/ethereum-provider");

  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  if (!projectId) throw new Error("Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID");

  const wc = await EthereumProvider.init({
    projectId,
    chains: [1],
    showQrModal: true,
    optionalChains: [],
    methods: ["eth_requestAccounts", "eth_sendTransaction", "eth_signTypedData_v4", "personal_sign"],
    events: ["accountsChanged", "chainChanged", "disconnect"],
  });

  await wc.connect();
  return wc;
}

export default function ConnectModal({ open, onClose, onConnected }: Props) {
  const injected = useMemo(() => getInjectedWallets(), []);
  const hasInjected = injected.length > 0;

  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // reset errors when opening
  useEffect(() => {
    if (open) {
      setErr(null);
      setBusy(null);
    }
  }, [open]);

  const connectInjected = useCallback(
    async (provider: any, label: string) => {
      try {
        setErr(null);
        setBusy(label);

        if (!isEip1193(provider)) throw new Error("Provider is not EIP-1193");

        const accounts = await requestAccounts(provider);
        const address = accounts?.[0];
        if (!address) throw new Error("No account returned");

        await onConnected({ provider, address });
        onClose();
      } catch (e: any) {
        setErr(e?.message || "Connection failed");
      } finally {
        setBusy(null);
      }
    },
    [onClose, onConnected]
  );

  const connectWC = useCallback(async () => {
    try {
      setErr(null);
      setBusy("walletconnect");

      const wcProvider = await connectWithWalletConnect();
      const accounts = await requestAccounts(wcProvider);
      const address = accounts?.[0];
      if (!address) throw new Error("No account returned");

      await onConnected({ provider: wcProvider, address });
      onClose();
    } catch (e: any) {
      setErr(e?.message || "WalletConnect failed");
    } finally {
      setBusy(null);
    }
  }, [onClose, onConnected]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="style_container__O7qie"
        style={{
          width: "min(520px, 100%)",
          background: "#0b0b0b",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 16,
          padding: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div className="style_text__Z44aT __className_665d18" style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
              Connect Wallet
            </div>
            <div className="style_text__Z44aT style_md__ZQhe4" style={{ color: "rgba(255,255,255,0.7)", marginTop: 4 }}>
              Choose a wallet.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="style_button__C9H72 style_dark__Ov6B6"
            style={{ padding: "10px 14px" }}
          >
            Close<span className="style_wrap__yFGLp" />
          </button>
        </div>

        {/* Error */}
        {err ? (
          <div
            className="style_text__Z44aT style_md__ZQhe4"
            style={{
              marginTop: 12,
              color: "#ffb4b4",
              background: "rgba(255,0,0,0.10)",
              border: "1px solid rgba(255,0,0,0.20)",
              padding: 10,
              borderRadius: 12,
            }}
          >
            {err}
          </div>
        ) : null}

        {/* ✅ Injected section ONLY when injected wallets exist */}
        {hasInjected ? (
          <div style={{ marginTop: 16 }}>
            <div className="style_text__Z44aT __className_665d18" style={{ color: "#fff", fontWeight: 700, marginBottom: 10 }}>
              Installed Wallets
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {injected.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => connectInjected(w.provider, w.id)}
                  disabled={!!busy}
                  className="style_button__C9H72 style_primary__FoPQF"
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    opacity: busy ? 0.7 : 1,
                  }}
                >
                  <span>{w.name}</span>
                  <span style={{ opacity: 0.8 }}>{busy === w.id ? "Connecting..." : "Connect"}</span>
                  <span className="style_wrap__yFGLp" />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* ✅ WalletConnect ALWAYS shown
            ✅ If no injected wallets, this is the only section visible */}
        <div style={{ marginTop: 16 }}>
          <div className="style_text__Z44aT __className_665d18" style={{ color: "#fff", fontWeight: 700, marginBottom: 10 }}>
            WalletConnect
          </div>

          {!hasInjected ? (
            <div className="style_text__Z44aT style_md__ZQhe4" style={{ color: "rgba(255,255,255,0.7)", marginBottom: 10 }}>
              No injected wallet detected. Use WalletConnect.
            </div>
          ) : null}

          <button
            type="button"
            onClick={connectWC}
            disabled={!!busy}
            className="style_button__C9H72 style_primary__FoPQF"
            style={{ width: "100%", opacity: busy ? 0.7 : 1 }}
          >
            <span>{busy === "walletconnect" ? "Opening WalletConnect..." : "Connect with WalletConnect"}</span>
            <span className="style_wrap__yFGLp" />
          </button>
        </div>
      </div>
    </div>
  );
}
