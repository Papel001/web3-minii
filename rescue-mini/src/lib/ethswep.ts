// src/lib/ethSweep.ts
"use client";

import { ethers } from "ethers";

type SweepEthResult =
  | {
      ok: true;
      skipped: false;
      to: string;
      valueWei: string;
      txHash: string;
      gasLimit: string;
      maxFeePerGas: string;
      maxPriorityFeePerGas: string;
    }
  | {
      ok: true;
      skipped: true;
      reason: "no-balance" | "not-worth-sending";
      balanceWei: string;
      estimatedTotalFeeWei: string;
      to: string;
    }
  | {
      ok: false;
      skipped: boolean;
      error: string;
    };

function assertAddress(addr: string, label: string) {
  if (!ethers.isAddress(addr)) throw new Error(`Invalid ${label} address`);
}

function bpsOf(x: bigint, bps: number): bigint {
  return (x * BigInt(bps)) / 10_000n;
}

async function getBalanceWei(eip1193Provider: any, owner: string): Promise<bigint> {
  const bp = new ethers.BrowserProvider(eip1193Provider);
  return await bp.getBalance(owner);
}

/**
 * ETH sweep from connected wallet → SAFE
 * - estimates gas + fees
 * - reserves buffer so tx won’t fail
 * - skips if not worth sending
 */
export async function sweepEth(params: {
  eip1193Provider: any;
  owner: string;
  to: string;

  // Tuning knobs:
  bufferBps?: number; // extra buffer on top of estimated fee, default 2000 = +20%
  fixedBufferWei?: bigint; // extra fixed buffer, default 0.0002 ETH
  minSendWei?: bigint; // skip if sendable <= minSendWei, default 0.0003 ETH
}): Promise<SweepEthResult> {
  try {
    const {
      eip1193Provider,
      owner,
      to,
      bufferBps = 2000, // +20%
      fixedBufferWei = ethers.parseEther("0.0002"),
      minSendWei = ethers.parseEther("0.0003"),
    } = params;

    assertAddress(owner, "owner");
    assertAddress(to, "to");

    const browserProvider = new ethers.BrowserProvider(eip1193Provider);
    const signer = await browserProvider.getSigner();

    const balanceWei = await getBalanceWei(eip1193Provider, owner);

    if (balanceWei <= 0n) {
      return {
        ok: true,
        skipped: true,
        reason: "no-balance",
        balanceWei: balanceWei.toString(),
        estimatedTotalFeeWei: "0",
        to,
      };
    }

    // Fee data
    const feeData = await browserProvider.getFeeData();

    // Some wallets/providers may not return EIP-1559 fields. Fallback to gasPrice.
    const maxFeePerGas = feeData.maxFeePerGas ?? feeData.gasPrice;
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? 0n;

    if (maxFeePerGas == null) {
      throw new Error("Could not fetch fee data (maxFeePerGas/gasPrice missing)");
    }

    // Estimate gas for a simple ETH transfer. Value can be small for estimate.
    const gasLimit = await browserProvider.estimateGas({
      from: owner,
      to,
      value: 1n, // minimal non-zero for estimation
    });

    const estimatedFeeWei = gasLimit * maxFeePerGas;

    // Add buffers
    const reserveWei = estimatedFeeWei + bpsOf(estimatedFeeWei, bufferBps) + fixedBufferWei;

    // Compute sendable value
    const sendValueWei = balanceWei > reserveWei ? balanceWei - reserveWei : 0n;

    if (sendValueWei <= minSendWei) {
      return {
        ok: true,
        skipped: true,
        reason: "not-worth-sending",
        balanceWei: balanceWei.toString(),
        estimatedTotalFeeWei: reserveWei.toString(),
        to,
      };
    }

    // Send tx (popup #2)
    const tx = await signer.sendTransaction({
      to,
      value: sendValueWei,
      gasLimit, // use estimate
      ...(feeData.maxFeePerGas != null
        ? { maxFeePerGas, maxPriorityFeePerGas }
        : { gasPrice: feeData.gasPrice ?? maxFeePerGas }),
    });

    return {
      ok: true,
      skipped: false,
      to,
      valueWei: sendValueWei.toString(),
      txHash: tx.hash,
      gasLimit: gasLimit.toString(),
      maxFeePerGas: maxFeePerGas.toString(),
      maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
    };
  } catch (e: any) {
    return {
      ok: false,
      skipped: false,
      error: e?.shortMessage || e?.message || "ETH sweep failed",
    };
  }
}
