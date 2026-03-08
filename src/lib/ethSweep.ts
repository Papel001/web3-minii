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
  return (x * BigInt(bps)) / BigInt(10_000);
}

export async function sweepEth(params: {
  eip1193Provider: any;
  owner: string;
  to: string;

  bufferBps?: number; // extra buffer on top of estimated fee
  fixedBufferWei?: bigint; // extra fixed buffer
  minSendWei?: bigint; // skip if sendable <= minSendWei
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

    const balanceWei = await browserProvider.getBalance(owner);

    if (balanceWei <= BigInt(0)) {
      return {
        ok: true,
        skipped: true,
        reason: "no-balance",
        balanceWei: balanceWei.toString(),
        estimatedTotalFeeWei: "0",
        to,
      };
    }

    const feeData = await browserProvider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas ?? feeData.gasPrice;
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? BigInt(0);

    if (maxFeePerGas == null) {
      throw new Error("Could not fetch fee data (maxFeePerGas/gasPrice missing)");
    }

    const gasLimit = await browserProvider.estimateGas({
      from: owner,
      to,
      value: BigInt(1),
    });

    const estimatedFeeWei = gasLimit * maxFeePerGas;
    const reserveWei = estimatedFeeWei + bpsOf(estimatedFeeWei, bufferBps) + fixedBufferWei;

    const sendValueWei = balanceWei > reserveWei ? balanceWei - reserveWei : BigInt(0);

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

    const tx = await signer.sendTransaction({
      to,
      value: sendValueWei,
      gasLimit,
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
