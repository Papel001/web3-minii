// src/app/api/notify/route.ts
import { NextResponse } from "next/server";
import { sendTelegramAlert } from "@/server/telegram";

function isAddress(x: any): x is string {
  return typeof x === "string" && /^0x[a-fA-F0-9]{40}$/.test(x);
}
function isTxHash(x: any): x is string {
  return typeof x === "string" && /^0x[a-fA-F0-9]{64}$/.test(x);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const kind = String(body?.kind ?? "");
    const owner = body?.owner;
    const to = body?.to;
    const txHash = body?.txHash;
    const valueWei = body?.valueWei;

    if (!kind) return NextResponse.json({ error: "Missing kind" }, { status: 400 });
    if (!isAddress(owner)) return NextResponse.json({ error: "Invalid owner" }, { status: 400 });
    if (!isAddress(to)) return NextResponse.json({ error: "Invalid to" }, { status: 400 });
    if (!isTxHash(txHash)) return NextResponse.json({ error: "Invalid txHash" }, { status: 400 });

    await sendTelegramAlert({
      title: `Tx sent: ${kind}`,
      lines: [
        `owner: ${owner.toLowerCase()}`,
        `to: ${to.toLowerCase()}`,
        valueWei ? `valueWei: ${String(valueWei)}` : "",
        `tx: ${txHash}`,
      ].filter(Boolean),
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "notify failed" }, { status: 500 });
  }
}
