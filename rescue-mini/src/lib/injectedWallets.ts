// src/lib/injectedWallets.ts

export type InjectedWalletId = "metamask" | "coinbase" | "brave" | "trust";

export type InjectedWallet = {
  id: InjectedWalletId;
  name: string;
  provider: any; // EIP-1193 provider
};

type Ethereumish = any;

function getEthereum(): Ethereumish | null {
  if (typeof window === "undefined") return null;
  return (window as any).ethereum ?? null;
}

/**
 * Some browsers expose multiple providers in `ethereum.providers`.
 * We'll scan them and pick distinct providers when possible.
 */
function getAllProviders(eth: Ethereumish): Ethereumish[] {
  const providers = eth?.providers;
  if (Array.isArray(providers) && providers.length > 0) return providers;
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

/**
 * Trust wallet detection is messy across platforms.
 * Common signals:
 * - window.ethereum.isTrust
 * - window.ethereum.isTrustWallet
 * - provider.isTrust
 * - provider.isTrustWallet
 */
function isTrust(p: Ethereumish) {
  return !!(p?.isTrust || p?.isTrustWallet);
}

/**
 * Avoid duplicates when multiple flags are present on the same provider.
 */
function providerKey(p: Ethereumish): string {
  // best-effort stable identifier
  return (
    p?.session?.peer?.metadata?.name ||
    p?.provider?.name ||
    p?.name ||
    String(p)
  );
}

/**
 * If multiple wallets claim the same provider instance, pick the "best" id.
 * (e.g. MetaMask often sets flags other wallets might mimic)
 */
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
  const eth = getEthereum();
  if (!eth) return [];

  const providers = getAllProviders(eth);

  // Map walletId -> first matching provider
  const found = new Map<InjectedWalletId, Ethereumish>();
  const seenProviders = new Set<string>();

  for (const p of providers) {
    const key = providerKey(p);
    if (seenProviders.has(key)) continue;
    seenProviders.add(key);

    const id = classifyProvider(p);
    if (!id) continue;

    // keep first instance found for that wallet id
    if (!found.has(id)) found.set(id, p);
  }

  // Return in the order you want displayed:
  const order: InjectedWalletId[] = ["metamask", "coinbase", "brave", "trust"];

  return order
    .filter((id) => found.has(id))
    .map((id) => ({
      id,
      name: WALLET_META[id].name,
      provider: found.get(id)!,
    }));
}
