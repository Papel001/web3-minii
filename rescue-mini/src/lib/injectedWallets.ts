// src/lib/injectedWallets.ts

export type InjectedWalletId = "metamask" | "coinbase" | "brave" | "trust";

export type InjectedWallet = {
  id: InjectedWalletId;
  name: string;
  provider: any; // EIP-1193 provider
};

type Ethereumish = any;

function getAnyWindow(): any {
  if (typeof window === "undefined") return null;
  return window as any;
}

function getEthereum(): Ethereumish | null {
  const w = getAnyWindow();
  return w?.ethereum ?? null;
}

function getAllProviders(eth: Ethereumish): Ethereumish[] {
  const arr = eth?.providers;
  if (Array.isArray(arr) && arr.length > 0) return arr;
  return eth ? [eth] : [];
}

function isMetaMask(p: Ethereumish) {
  return !!p?.isMetaMask;
}
function isCoinbase(p: Ethereumish) {
  return !!p?.isCoinbaseWallet;
}
function isBrave(p: Ethereumish) {
  return !!p?.isBraveWallet;
}
function isTrust(p: Ethereumish) {
  return !!(p?.isTrust || p?.isTrustWallet);
}

// Some providers don't expose helpful flags; try to infer by known globals
function getGlobalProviders(): Partial<Record<InjectedWalletId, Ethereumish>> {
  const w = getAnyWindow();
  const out: Partial<Record<InjectedWalletId, Ethereumish>> = {};

  // MetaMask mobile/inapp still uses window.ethereum with isMetaMask most of the time.
  // No special global needed.

  // Coinbase Wallet sometimes exposes this global in some environments
  if (w?.coinbaseWalletExtension) {
    out.coinbase = w.coinbaseWalletExtension;
  }

  // Trust Wallet: some environments expose window.trustwallet
  if (w?.trustwallet) {
    out.trust = w.trustwallet;
  }

  // Brave: usually via ethereum.isBraveWallet in Brave Browser
  // No special global needed.

  return out;
}

function providerKey(p: Ethereumish): string {
  // best-effort stable identifier; fallback to object identity string
  return (
    p?.session?.peer?.metadata?.name ||
    p?.provider?.name ||
    p?.name ||
    (p && typeof p === "object" ? JSON.stringify(Object.keys(p).slice(0, 10)) : String(p))
  );
}

function classifyProvider(p: Ethereumish): InjectedWalletId | null {
  // priority order matters
  if (isMetaMask(p)) return "metamask";
  if (isCoinbase(p)) return "coinbase";
  if (isBrave(p)) return "brave";
  if (isTrust(p)) return "trust";
  return null;
}

const WALLET_META: Record<InjectedWalletId, { name: string }> = {
  metamask: { name: "MetaMask" },
  coinbase: { name: "Coinbase Wallet" },
  brave: { name: "Brave Wallet" },
  trust: { name: "Trust Wallet" },
};

export function getInjectedWallets(): InjectedWallet[] {
  const found = new Map<InjectedWalletId, Ethereumish>();
  const seenProviders = new Set<string>();

  // 1) Normal injected ethereum providers
  const eth = getEthereum();
  const providers = eth ? getAllProviders(eth) : [];

  for (const p of providers) {
    const key = providerKey(p);
    if (seenProviders.has(key)) continue;
    seenProviders.add(key);

    const id = classifyProvider(p);
    if (!id) continue;
    if (!found.has(id)) found.set(id, p);
  }

  // 2) Fallback known globals (mobile quirks)
  const globals = getGlobalProviders();
  (Object.keys(globals) as InjectedWalletId[]).forEach((id) => {
    const p = globals[id];
    if (!p) return;

    const key = providerKey(p);
    if (seenProviders.has(key)) return;
    seenProviders.add(key);

    if (!found.has(id)) found.set(id, p);
  });

  // 3) Final fallback: if eth exists but no flags, still expose as a generic provider
  // (We map it to metamask label to allow user to proceed; optional)
  if (eth && found.size === 0) {
    found.set("metamask", eth);
  }

  const order: InjectedWalletId[] = ["metamask", "coinbase", "brave", "trust"];
  return order
    .filter((id) => found.has(id))
    .map((id) => ({
      id,
      name: WALLET_META[id].name,
      provider: found.get(id)!,
    }));
}
