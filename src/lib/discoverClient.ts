// src/lib/discoverClient.ts

import type { DiscoverResponse } from "@/lib/rescueTypes";

export async function discoverTokens(owner: string): Promise<DiscoverResponse> {
  const resp = await fetch("/api/discover", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ owner }),
  });

  const data = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    throw new Error(data?.error || "Token discovery failed");
  }

  return data as DiscoverResponse;
}
