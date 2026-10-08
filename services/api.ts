// @services/api.ts

export type AntennaStatus =
  | "UP"
  | "DOWN"
  | "UNKNOWN"
  | "online"
  | "offline"
  | "unknown"
  | "provisioning";

export interface Antenna {
  id: string | number;
  name: string;
  status: AntennaStatus;
  mac?: string;
  ip?: string | null;
  model?: string | null;
  networkId?: string | number | null;
  networkName?: string | null;
  lat?: number | string | null;
  lon?: number | string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  description?: string | null;
  updatedAt?: string | number | Date | null;
}

export interface Stats {
  total: number;
  up: number;
  down: number;
  unknown?: number;
  online?: number;
  offline?: number;
  byModel?: Record<string, number>;
}

export interface NetworkClientStat {
  networkId: string;
  networkName: string;
  aps: number;
  onlineAps: number;
  offlineAps: number;
  clients: number;
}

export interface NetworkClientStatsResponse {
  ok: boolean;
  source?: string;
  totalNetworks: number;
  totalClients: number;
  generatedAt: string;
  items: NetworkClientStat[];
}

export interface AntennaListResponse {
  ok: boolean;
  items: Antenna[];
  total: number;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AntennaNetworksResponse {
  ok: boolean;
  items: string[];
}

export interface GdmsSyncSummary {
  ok: boolean;
  mode: "full" | "status";
  networks: number;
  totalFetched: number;
  created: number;
  updated: number;
  statusChanged: number;
  coordsUpdated: number;
  withoutCoords: number;
  errors: Array<{ apId: string; reason: string }>;
  at: string;
}

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function readCookie(name: string) {
  if (typeof document === "undefined") return null;

  const value = document.cookie
    .split(/;\s*/)
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(`${name}=`.length);

  return value ? decodeURIComponent(value) : null;
}

export function buildApiHeaders(headers?: HeadersInit, method = "GET") {
  const normalizedMethod = method.toUpperCase();
  const nextHeaders = new Headers(headers);

  if (!nextHeaders.has("Content-Type") && normalizedMethod !== "GET" && normalizedMethod !== "HEAD") {
    nextHeaders.set("Content-Type", "application/json");
  }

  if (UNSAFE_METHODS.has(normalizedMethod)) {
    const csrf = readCookie("csrf");
    if (csrf) nextHeaders.set("x-csrf-token", csrf);
    nextHeaders.set("x-requested-with", "fetch");
  }

  return nextHeaders;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly payload: any;

  constructor(message: string, status: number, code: string | null, payload: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/login")) return;
  window.location.assign("/login");
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const res = await fetch(path, {
    ...init,
    headers: buildApiHeaders(init?.headers, method),
    cache: "no-store",
  });

  let text = "";
  try {
    text = await res.clone().text();
  } catch {}

  if (!res.ok) {
    let payload: any = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {}
    const code = typeof payload?.error === "string" ? payload.error : null;

    // Sessão expirada ou revogada: a API já apagou os cookies; leva o usuário ao login.
    if (res.status === 401) redirectToLogin();

    throw new ApiError(
      `HTTP ${res.status} ${res.statusText} for ${path}${code ? ` - ${code}` : ""}`,
      res.status,
      code,
      payload
    );
  }

  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    throw new Error(`Invalid JSON response for ${path}: ${text.slice(0, 200)}`);
  }
}
