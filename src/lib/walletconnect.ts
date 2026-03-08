// src/lib/walletconnect.ts

import EthereumProvider from "@walletconnect/ethereum-provider";

let wcProvider: any | null = null;

export type InitWalletConnectOptions = {
  projectId: string; // WalletConnect Cloud projectId
  chains?: number[]; // default [1]
  optionalChains?: number[];
  showQrModal?: boolean; // default true
  metadata?: {
    name: string;
    description: string;
    url: string;
    icons: string[];
  };
};

/**
 * Lazy WalletConnect init.
 * Call this ONLY when the user clicks "WalletConnect".
 */
export async function initWalletConnect(
  opts: InitWalletConnectOptions
): Promise<any> {
  if (wcProvider) return wcProvider;

  const {
    projectId,
    chains = [1],
    optionalChains,
    showQrModal = true,
    metadata,
  } = opts;

  if (!projectId) throw new Error("WalletConnect projectId is required");

  // Build options without optionalChains unless it's non-empty
  const wcOpts: any = {
    projectId,
    chains,
    showQrModal,
    metadata,
  };

  if (optionalChains && optionalChains.length > 0) {
    wcOpts.optionalChains = optionalChains; // now it's definitely non-empty
  }

  wcProvider = await EthereumProvider.init(wcOpts);
  return wcProvider;
}

/**
 * Optional helper: ensure connect is triggered only when user intends.
 */
export async function connectWalletConnect(provider: any): Promise<string[]> {
  // Some versions require enable(), some use connect()
  if (typeof provider.enable === "function") {
    const accounts = await provider.enable();
    return accounts as string[];
  }
  if (typeof provider.connect === "function") {
    const accounts = await provider.connect();
    return accounts as string[];
  }
  // Fallback to request
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  return accounts as string[];
}

export function getWalletConnectProvider(): any | null {
  return wcProvider;
}

export async function disconnectWalletConnect(): Promise<void> {
  if (!wcProvider) return;
  try {
    if (typeof wcProvider.disconnect === "function") {
      await wcProvider.disconnect();
    }
  } finally {
    wcProvider = null;
  }
}
