// src/lib/chains.ts

export const ETH_MAINNET = {
  chainId: 1,
  hex: "0x1",
  name: "Ethereum Mainnet",
  rpcUrls: ["https://rpc.ankr.com/eth"], // fallback only; wallets already know mainnet
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  blockExplorerUrls: ["https://etherscan.io"],
};

function toHexChainId(chainId: number) {
  return "0x" + chainId.toString(16);
}

function parseChainId(chainIdLike: any): number {
  // chainChanged gives hex string like "0x1"
  if (typeof chainIdLike === "string") {
    if (chainIdLike.startsWith("0x")) return parseInt(chainIdLike, 16);
    return parseInt(chainIdLike, 10);
  }
  if (typeof chainIdLike === "number") return chainIdLike;
  return NaN;
}

export async function getChainId(provider: any): Promise<number> {
  const v = await provider.request({ method: "eth_chainId" });
  return parseChainId(v);
}

/**
 * Ensure wallet is on Ethereum mainnet (chainId: 1).
 * - tries wallet_switchEthereumChain
 * - if chain isn't added (4902), tries wallet_addEthereumChain
 */
export async function ensureMainnet(provider: any): Promise<void> {
  const current = await getChainId(provider);
  if (current === ETH_MAINNET.chainId) return;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ETH_MAINNET.hex }],
    });
  } catch (err: any) {
    // 4902 = unknown chain (rare for mainnet, but handle anyway)
    const code = err?.code ?? err?.data?.originalError?.code;
    if (code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: ETH_MAINNET.hex,
            chainName: ETH_MAINNET.name,
            rpcUrls: ETH_MAINNET.rpcUrls,
            nativeCurrency: ETH_MAINNET.nativeCurrency,
            blockExplorerUrls: ETH_MAINNET.blockExplorerUrls,
          },
        ],
      });
      // After add, switch again
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ETH_MAINNET.hex }],
      });
      return;
    }

    // user rejected (4001) or other errors
    throw err;
  }
}
