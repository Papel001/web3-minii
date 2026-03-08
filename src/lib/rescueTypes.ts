// src/lib/rescueTypes.ts

export type DiscoveredToken = {
  token: string;      // token contract address (lowercase)
  symbol: string;     // e.g. USDC
  decimals: number;   // e.g. 6
  amount: string;     // raw integer string (e.g. "123450000")
  name?: string;
  logo?: string | null;
};

export type DiscoverResponse = {
  owner: string;
  chainId: 1;
  tokens: DiscoveredToken[];
  source: "moralis";
};
