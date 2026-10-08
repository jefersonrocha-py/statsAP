import "server-only";

// services/gdms.ts
import crypto from "crypto";
import { getAccessToken, refreshToken } from "@lib/gdmsToken";
import {
  normalizeApStatus,
  parseCoordinatePair,
  pickApId,
  pickRawLat,
  pickRawLng,
  type Coordinates,
} from "@lib/gdmsNormalize";

type GdmsEnv = {
  base: string;
  appId: string;
  secret: string;
  pageSize: number;
  show: "all" | "1" | "0";
};

const GDMS_TIMEOUT_MS = 20_000;
const AP_NAME_MAX_LENGTH = 80;

function parseBaseUrl(raw: string) {
  const url = new URL(raw);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("GDMS_BASE must use HTTPS in production.");
  }
  return url.toString().replace(/\/+$/, "");
}

function env(): GdmsEnv {
  const base = parseBaseUrl(process.env.GDMS_BASE ?? "https://www.gwn.cloud");
  const appId = process.env.GDMS_CLIENT_ID ?? process.env.GDMS_APP_ID ?? "";
  const secret = process.env.GDMS_CLIENT_SECRET ?? process.env.GDMS_SECRET ?? "";
  const rawPageSize = Number(process.env.GDMS_PAGE_SIZE ?? 200);
  const pageSize =
    Number.isFinite(rawPageSize) && rawPageSize >= 1 && rawPageSize <= 500
      ? Math.floor(rawPageSize)
      : 200;
  const rawShow = process.env.GDMS_SHOW;
  const show: GdmsEnv["show"] =
    rawShow === "1" || rawShow === "0" || rawShow === "all" ? rawShow : "all";
  if (!appId || !secret) throw new Error("Configure GDMS_CLIENT_ID e GDMS_CLIENT_SECRET (ou GDMS_APP_ID/GDMS_SECRET).");
  return { base, appId, secret, pageSize, show };
}

function sha256Hex(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function buildSignature(args: {
  accessToken: string; appId: string; secret: string; timestamp: string; body: string;
}) {
  const bodyHash = sha256Hex(args.body);
  const seed = `&access_token=${args.accessToken}&appID=${args.appId}&secretKey=${args.secret}&timestamp=${args.timestamp}&${bodyHash}&`;
  return sha256Hex(seed);
}

async function postJson<T>(path: string, bodyObj: unknown, retried = false): Promise<T> {
  const { base, appId, secret } = env();
  const accessToken = retried ? (await refreshToken()).accessToken : await getAccessToken();

  const body = JSON.stringify(bodyObj);
  const ts = Date.now().toString();
  const signature = buildSignature({ accessToken, appId, secret, timestamp: ts, body });

  const url = `${base}${path}?access_token=${accessToken}&appID=${appId}&timestamp=${ts}&signature=${signature}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(GDMS_TIMEOUT_MS),
  });

  // Token rejeitado pelo GWN (expirado ou revogado): renova e repete uma única vez.
  if (res.status === 401 && !retried) {
    return postJson<T>(path, bodyObj, true);
  }

  let json: any;
  try { json = await res.json(); } catch { json = {}; }

  if (!res.ok) throw new Error(`GDMS ${path} failed with status ${res.status}.`);
  if (json?.retCode && String(json.retCode) !== "0") {
    throw new Error(`GDMS ${path} rejected the request with retCode=${json.retCode}.`);
  }
  return json as T;
}

type NetworkRow = { id: string | number; networkName?: string };
type ApRow = Record<string, any>;

export type NormalizedAp = {
  networkId: string;
  networkName: string;
  apId: string;
  apName: string;
  status: "UP" | "DOWN";
  coords: Coordinates | null;
};

export type NetworkClientStat = {
  networkId: string;
  networkName: string;
  aps: number;
  onlineAps: number;
  offlineAps: number;
  clients: number;
};

function pickApName(ap: ApRow, apId: string) {
  const raw = typeof ap.name === "string" ? ap.name.trim() : "";
  return (raw || `AP-${apId}`).slice(0, AP_NAME_MAX_LENGTH);
}

function shouldContinue(pageNum: number, pageSize: number, info: { totalPage?: number; total?: number; received?: number }) {
  const { totalPage, total, received } = info;
  if (typeof totalPage === "number" && totalPage > 0) return pageNum < totalPage;
  if (typeof total === "number" && total > 0) return (pageNum * pageSize) < total;
  return (received ?? 0) === pageSize;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  if (!items.length) return [];

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex++;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, () => worker())
  );

  return results;
}

export async function listNetworks(): Promise<Array<{ id: string; networkName: string }>> {
  const { pageSize } = env();
  let pageNum = 1;
  const out: Array<{ id: string; networkName: string }> = [];

  while (true) {
    const body = { search: "", order: "id", pageNum, pageSize };
    const json = await postJson<{ data?: { result?: NetworkRow[]; totalPage?: number; total?: number } }>(
      "/oapi/v1.0.0/network/list",
      body
    );
    const arr = json.data?.result ?? [];
    for (const n of arr) out.push({ id: String(n.id), networkName: n.networkName ?? "" });

    const totalPage = Number(json.data?.totalPage ?? 0) || undefined;
    const total = Number(json.data?.total ?? 0) || undefined;
    if (!shouldContinue(pageNum, pageSize, { totalPage, total, received: arr.length })) break;
    pageNum++;
  }
  return out;
}

export async function listAPsByNetwork(nid: string, networkName: string): Promise<NormalizedAp[]> {
  const { pageSize, show } = env();
  let pageNum = 1;
  const out: NormalizedAp[] = [];

  while (true) {
    const body = {
      search: "",
      order: "id",
      pageNum,
      pageSize,
      networkId: nid,
      filter: { showType: show },
    };

    const json = await postJson<{ data?: { result?: ApRow[]; totalPage?: number; total?: number } }>(
      "/oapi/v1.0.0/ap/list",
      body
    );

    const res = json.data?.result ?? [];
    for (const ap of res) {
      const apId = pickApId(ap);
      if (!apId) continue;
      out.push({
        networkId: nid,
        networkName,
        apId,
        apName: pickApName(ap, apId),
        status: normalizeApStatus(ap.status),
        coords: parseCoordinatePair(pickRawLat(ap), pickRawLng(ap)),
      });
    }

    const totalPage = Number(json.data?.totalPage ?? 0) || undefined;
    const total = Number(json.data?.total ?? 0) || undefined;
    if (!shouldContinue(pageNum, pageSize, { totalPage, total, received: res.length })) break;
    pageNum++;
  }

  return out;
}

export async function listConnectedClientsByNetwork(): Promise<NetworkClientStat[]> {
  const networks = await listNetworks();
  const stats = await mapWithConcurrency(networks, 4, async (network) => {
    const aps = await listAPsByNetwork(network.id, network.networkName ?? "");
    const onlineAps = aps.reduce((sum, ap) => sum + (ap.status === "UP" ? 1 : 0), 0);

    return {
      networkId: network.id,
      networkName: network.networkName ?? "",
      aps: aps.length,
      onlineAps,
      offlineAps: Math.max(0, aps.length - onlineAps),
      clients: 0,
    };
  });

  return stats.sort((a, b) => {
    if (b.clients !== a.clients) return b.clients - a.clients;
    return (a.networkName || a.networkId).localeCompare(b.networkName || b.networkId, "pt-BR");
  });
}
