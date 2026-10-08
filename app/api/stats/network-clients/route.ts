export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { requireRequestAuth } from "@lib/auth";
import { createCachedLoader } from "@lib/ttlCache";
import { listConnectedClientsByNetwork, type NetworkClientStat } from "@services/gdms";

const CACHE_TTL_MS = 60_000;

type NetworkClientsLoader = () => Promise<{ value: NetworkClientStat[]; cachedAt: number }>;
type CacheGlobal = typeof globalThis & { __networkClientsLoader?: NetworkClientsLoader };

function getLoader(): NetworkClientsLoader {
  const store = globalThis as CacheGlobal;
  if (!store.__networkClientsLoader) {
    store.__networkClientsLoader = createCachedLoader(listConnectedClientsByNetwork, CACHE_TTL_MS);
  }
  return store.__networkClientsLoader;
}

export async function GET(req: Request) {
  try {
    const auth = await requireRequestAuth(req);
    if ("response" in auth) return auth.response;

    const { value: items, cachedAt } = await getLoader()();
    const totalClients = items.reduce((sum, item) => sum + item.clients, 0);

    return NextResponse.json(
      {
        ok: true,
        source: "client/list",
        totalNetworks: items.length,
        totalClients,
        items,
        generatedAt: new Date(cachedAt).toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("GET /api/stats/network-clients error:", e);
    return NextResponse.json({ ok: false, error: "GDMS_CLIENT_STATS_ERROR" }, { status: 500 });
  }
}
