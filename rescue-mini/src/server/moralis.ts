// src/server/moralis.ts

import type { DiscoveredToken } from "@/lib/rescueTypes";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function normalizeAddress(addr: string) {
  return addr.trim().toLowerCase();
}

function toInt(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function isPositiveRaw(raw: any): boolean {
  // Moralis returns balances as strings. Some tokens might return "0".
  try {
    const s = String(raw ?? "0");
    // BigInt handles huge values safely
    return BigInt(s) > BigInt(0);
  } catch {
    return false;
  }
}

/**
 * Moralis Wallet API: ERC20 balances for a wallet on Ethereum mainnet
 * Returns only tokens with balance > 0.
 */
export async function moralisDiscoverErc20(owner: string): Promise<DiscoveredToken[]> {
  const apiKey = mustEnv("MORALIS_API_KEY");
  const address = normalizeAddress(owner);

  // Moralis Wallet API v2.2 commonly supports:
  // GET https://deep-index.moralis.io/api/v2.2/{address}/erc20?chain=eth
  const url = `https://deep-index.moralis.io/api/v2.2/${address}/erc20?chain=eth`;

  const resp = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      "X-API-Key": apiKey,
    },
    // keep it fresh
    cache: "no-store",
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Moralis error (${resp.status}): ${text || resp.statusText}`);
  }

  const data = (await resp.json()) as any[];

  // Normalize into our DiscoveredToken shape
  const tokens: DiscoveredToken[] = (Array.isArray(data) ? data : [])
    .filter((t) => isPositiveRaw(t?.balance))
    .map((t) => ({
      token: normalizeAddress(t?.token_address ?? ""),
      symbol: String(t?.symbol ?? "").trim() || "UNKNOWN",
      decimals: toInt(t?.decimals, 18),
      amount: String(t?.balance ?? "0"),
      name: t?.name ? String(t.name) : undefined,
      logo: t?.logo ? String(t.logo) : null,
    }))
    .filter((t) => t.token.startsWith("0x") && t.token.length === 42);

  // De-dupe by token address (Moralis normally won’t duplicate, but just in case)
  const uniq = new Map<string, DiscoveredToken>();
  for (const t of tokens) {
    if (!uniq.has(t.token)) uniq.set(t.token, t);
  }

  return [...uniq.values()];
}
