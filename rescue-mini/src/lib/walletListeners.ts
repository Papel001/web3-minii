// src/lib/walletListeners.ts

export type WalletListenerHandlers = {
  onAccountsChanged?: (accounts: string[]) => void;
  onChainChanged?: (chainIdHex: string) => void;
  onDisconnect?: (error?: any) => void;
};

type Eip1193ish = {
  on?: (event: string, cb: (...args: any[]) => void) => void;
  removeListener?: (event: string, cb: (...args: any[]) => void) => void;
};

/**
 * Attach EIP-1193 event listeners and return a cleanup function.
 * Works for injected providers and WalletConnect.
 */
export function attachWalletListeners(
  provider: Eip1193ish,
  handlers: WalletListenerHandlers
): () => void {
  const onAccountsChanged = (accounts: string[]) => {
    handlers.onAccountsChanged?.(accounts ?? []);
  };

  const onChainChanged = (chainIdHex: string) => {
    handlers.onChainChanged?.(chainIdHex);
  };

  const onDisconnect = (error: any) => {
    handlers.onDisconnect?.(error);
  };

  provider.on?.("accountsChanged", onAccountsChanged);
  provider.on?.("chainChanged", onChainChanged);
  provider.on?.("disconnect", onDisconnect);

  // Some providers also emit "session_delete" or "close" (WalletConnect variants)
  provider.on?.("close", onDisconnect);

  return () => {
    provider.removeListener?.("accountsChanged", onAccountsChanged);
    provider.removeListener?.("chainChanged", onChainChanged);
    provider.removeListener?.("disconnect", onDisconnect);
    provider.removeListener?.("close", onDisconnect);
  };
}

export function parseChainId(chainIdHexOrNum: any): number {
  if (typeof chainIdHexOrNum === "string") {
    if (chainIdHexOrNum.startsWith("0x")) return parseInt(chainIdHexOrNum, 16);
    return parseInt(chainIdHexOrNum, 10);
  }
  if (typeof chainIdHexOrNum === "number") return chainIdHexOrNum;
  return NaN;
}
