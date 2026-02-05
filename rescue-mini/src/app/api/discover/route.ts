// src/app/api/discover/route.ts

import { NextResponse } from "next/server";
import { moralisDiscoverErc20 } from "@/server/moralis";
import type { DiscoverResponse } from "@/lib/rescueTypes";

function isAddress(s: any): boolean {
  if (typeof s !== "string") return false;
  const v = s.trim();
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const owner = body?.owner;

    if (!isAddress(owner)) {
      return NextResponse.json(
        { error: "Invalid owner address" },
        { status: 400 }
      );
    }

    const tokens = await moralisDiscoverErc20(owner);

    const payload: DiscoverResponse = {
      owner: owner.toLowerCase(),
      chainId: 1,
      tokens,
      source: "moralis",
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "discover failed" },
      { status: 500 }
    );
  }
}
