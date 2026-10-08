# Revisão v1.2 (coordenadas GDMS, /clients, convites, ocorrências, mapa, PT-BR) — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatizar a posição dos APs a partir do GWN, corrigir /clients e falhas de segurança, e entregar convite por e-mail, ocorrências de AP offline com auditoria, controle de rotação do mapa e revisão PT-BR.

**Architecture:** Next.js 14 (App Router) com Route Handlers e MySQL via `mysql2` (SQL direto, sem ORM). Regras de negócio novas ficam em módulos puros em `lib/` (testados com vitest) e módulos `server-only` finos fazem a persistência. Eventos em tempo real continuam por SSE (`lib/sse.ts`), agora com uma única conexão por aba.

**Tech Stack:** Next.js 14.2, React 18, TypeScript 5.5 (strict), Tailwind 3, mysql2 3, zod 3, jose 6, nodemailer 8, maplibre-gl 5, vitest 2.

**Spec:** `docs/superpowers/specs/2026-10-08-revisao-gdms-convites-ocorrencias-design.md`

## Global Constraints

- Docker usa Node 20 + npm 10. Instale dependências localmente com `npx -y npm@10 ci --no-audit --no-fund`; **não** regenere o `package-lock.json` (o npm 11 acusa o lockfile como dessincronizado).
- Nenhuma dependência nova de runtime. Só código novo sobre as libs já instaladas.
- TypeScript strict; estilo do repositório: aspas duplas, ponto e vírgula, 2 espaços; SQL sempre com placeholders `?` do `mysql2`.
- Textos visíveis em PT-BR com acentuação. Mantidos sem tradução: "Dashboard", "AP", "GDMS", "GWN", "SSID", "UP/DOWN", `USER`/`ADMIN`/`SUPERADMIN`.
- Horários exibidos em `America/Sao_Paulo`. O banco grava UTC (pool com `timezone: "Z"`); em SQL use `UTC_TIMESTAMP()`, nunca `NOW()`.
- Mudanças de schema só aditivas (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN` protegido), aplicadas por `scripts/init-db.mjs`.
- O `.env` de produção não é alterado. Chamadas ao GWN são só server-side e só de leitura.
- Padrões: `INVITE_TOKEN_HOURS=72` (1 a 336), `INCIDENT_ALERTS_ENABLED=true`, `INCIDENT_ALERT_MIN_MINUTES=10` (1 a 1440), cache do /clients 60 s, limite de sync por usuário 4 a cada 15 min.
- Todo commit termina com o parágrafo `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Comando de teste unitário: `npx vitest run <arquivo>`; suíte completa: `npm test`.

## Review Focus

1. **Mesmo AP listado em duas redes no mesmo sync** (AP movido de rede durante a leitura) → deve ser aplicado uma única vez, sem erro de chave duplicada. Teste na Tarefa 3.
2. **Queda em massa (corte de energia com dezenas de APs)** → um único e-mail-resumo por ciclo, com no máximo 100 linhas e "e mais N". Teste na Tarefa 13.
3. **SMTP fora do ar no momento do alerta** → nada é marcado como enviado e o próximo ciclo tenta de novo. Teste na Tarefa 13.
4. **Sessão revogada com a página aberta** → a API responde 401, apaga os cookies e o navegador vai para `/login` sem entrar em laço. Testes na Tarefa 4.
5. **Link de convite reutilizado ou aceito em duas abas ao mesmo tempo** → só o primeiro cria o usuário; o segundo recebe "convite inválido". Teste unitário na Tarefa 8 e verificação ponta a ponta na Tarefa 19.

---

## Mapa de arquivos

**Novos (lib, puros e testáveis):**
- `lib/gdmsNormalize.ts` — parse de coordenadas, id, status de AP do GWN.
- `lib/gdmsSyncPlan.ts` — decide criar/atualizar/ignorar cada AP no sync.
- `lib/ttlCache.ts` — loader com cache TTL e deduplicação de chamada em andamento.
- `lib/jwt.ts` — JWT e nomes de cookie (seguro para o middleware edge).
- `lib/roles.ts` — normalização e rótulos de papel.
- `lib/dateFormat.ts` — `toDate`, `formatDateTimeBR` (fuso de São Paulo).
- `lib/emailTemplates.ts` — `escapeHtml`, layout único e e-mails (reset, convite, alertas).
- `lib/publicUrl.ts` — origem pública para links de e-mail.
- `lib/inviteToken.ts` — token, validade e estado do convite.
- `lib/incidentFormat.ts` — rótulos, `formatDuration`, `secondsBetween`.
- `lib/incidentRules.ts` — máquina de estados das ocorrências e config de alerta.
- `lib/mapRotation.ts` — matemática do controle de rotação.

**Novos (server-only, persistência):**
- `lib/statusChanges.ts` — grava transição de status (StatusHistory + ocorrências).
- `lib/gdmsSync.ts` — motor de sync.
- `lib/invites.ts` — mapeamento e envio de convite.
- `lib/incidents.ts` — persistência, listagem e ações de ocorrências; notificações.
- `lib/incidentAlerts.ts` — e-mails-resumo de queda e normalização.

**Novas rotas e telas:**
- `app/api/users/invites/route.ts`, `app/api/users/invites/[id]/route.ts`, `app/api/users/invites/[id]/resend/route.ts`
- `app/api/auth/invite/route.ts`, `app/api/auth/accept-invite/route.ts`, `app/(auth)/accept-invite/page.tsx`
- `app/api/incidents/route.ts`, `app/api/incidents/[id]/route.ts`, `app/api/incidents/[id]/actions/route.ts`
- `app/api/notifications/route.ts`, `app/api/notifications/seen/route.ts`
- `app/(app)/incidents/page.tsx`, `components/incidents/IncidentDetailPanel.tsx`, `components/NotificationBell.tsx`, `components/map/RotationControl.tsx`

**Testes:** `vitest.config.ts`, `tests/stubs/server-only.ts`, `tests/unit/*.test.ts`.

**Modificados:** `services/gdms.ts`, `services/api.ts`, `services/sseClient.ts`, `lib/auth.ts`, `lib/sse.ts`, `lib/dbErrors.ts`, `lib/dbMappers.ts`, `lib/passwordReset.ts`, `lib/validatorsAuth.ts`, `middleware.ts`, `db/schema.sql`, `scripts/init-db.mjs`, rotas `gdms/sync`, `stats/network-clients`, `antennas/[id]`, `auth/forgot-password`, `users`, `users/[id]`, páginas `settings`, `clients`, `admin`, `dashboard`, `filter-cluster`, `login`, `forgot-password`, `reset-password`, componentes `Client`, `MapClient`, `Sidebar`, `TopBar`, `AntennaStatusNotifications`, `AntennaToolbar`, `DashboardCards`, `PaginationControls`, `Footer`, `env.example`, `README.md`, `package.json`, `.gitignore`.

---

# Fase A — Urgente: sync, /clients e segurança

### Tarefa 1: Infra de testes + normalização do GWN (coordenadas em texto)

**Files:**
- Create: `vitest.config.ts`, `tests/stubs/server-only.ts`, `lib/gdmsNormalize.ts`
- Modify: `services/gdms.ts` (arquivo inteiro), `package.json` (scripts), `.gitignore`
- Test: `tests/unit/gdmsNormalize.test.ts`, `tests/unit/gdmsClient.test.ts`

**Interfaces:**
- Produces:
  - `type Coordinates = { lat: number; lng: number }`
  - `parseCoordinatePair(rawLat: unknown, rawLng: unknown): Coordinates | null`
  - `pickRawLat(ap: Record<string, any>): unknown`, `pickRawLng(ap): unknown`
  - `pickApId(ap): string | undefined`, `normalizeApStatus(raw: unknown): "UP" | "DOWN"`
  - `services/gdms.ts`: `NormalizedAp = { networkId: string; networkName: string; apId: string; apName: string; status: "UP" | "DOWN"; coords: Coordinates | null }` (o campo `clients`, `lat` e `lng` deixam de existir)

- [ ] **Step 1: Configurar o vitest**

`vitest.config.ts`:

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));
const resolveDir = (dir: string) => path.resolve(root, dir).replace(/\\/g, "/");

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@lib\/(.*)$/, replacement: `${resolveDir("lib")}/$1` },
      { find: /^@services\/(.*)$/, replacement: `${resolveDir("services")}/$1` },
      { find: /^@components\/(.*)$/, replacement: `${resolveDir("components")}/$1` },
      { find: /^@store\/(.*)$/, replacement: `${resolveDir("store")}/$1` },
      { find: /^server-only$/, replacement: `${resolveDir("tests/stubs")}/server-only.ts` },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    clearMocks: true,
    unstubGlobals: true,
  },
});
```

`tests/stubs/server-only.ts`:

```ts
// O Next.js resolve "server-only" internamente; nos testes ele vira um módulo vazio.
export {};
```

Em `package.json`, troque o bloco `scripts` `"test": "vitest",` por:

```json
    "test": "vitest run",
    "test:watch": "vitest",
```

Em `.gitignore`, adicione ao final (se ainda não existir):

```
tsconfig.tsbuildinfo
```

- [ ] **Step 2: Escrever os testes da normalização (falham)**

`tests/unit/gdmsNormalize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  normalizeApStatus,
  parseCoordinatePair,
  pickApId,
  pickRawLat,
  pickRawLng,
} from "@lib/gdmsNormalize";

describe("parseCoordinatePair", () => {
  it("aceita latitude/longitude em texto, como o ap/list do GWN devolve", () => {
    expect(parseCoordinatePair("-22.441292", "-46.972298")).toEqual({ lat: -22.441292, lng: -46.972298 });
  });

  it("aceita números", () => {
    expect(parseCoordinatePair(-22.5, -46.9)).toEqual({ lat: -22.5, lng: -46.9 });
  });

  it("aceita vírgula decimal e espaços", () => {
    expect(parseCoordinatePair(" -22,5 ", "-46,9")).toEqual({ lat: -22.5, lng: -46.9 });
  });

  it("rejeita valores vazios ou ausentes", () => {
    expect(parseCoordinatePair("", "")).toBeNull();
    expect(parseCoordinatePair(undefined, "-46.9")).toBeNull();
    expect(parseCoordinatePair(null, null)).toBeNull();
  });

  it("rejeita texto não numérico", () => {
    expect(parseCoordinatePair("abc", "-46.9")).toBeNull();
  });

  it("rejeita valores fora da faixa", () => {
    expect(parseCoordinatePair("-91", "0.5")).toBeNull();
    expect(parseCoordinatePair("10", "181")).toBeNull();
  });

  it("rejeita o par 0,0 (AP sem posição)", () => {
    expect(parseCoordinatePair("0", "0")).toBeNull();
    expect(parseCoordinatePair(0, 0)).toBeNull();
  });

  it("aceita um eixo zero quando o outro não é zero", () => {
    expect(parseCoordinatePair("0", "-46.9")).toEqual({ lat: 0, lng: -46.9 });
  });
});

describe("pickRawLat / pickRawLng", () => {
  it("prioriza latitude/longitude do ap/list", () => {
    const ap = { latitude: "-22.4", longitude: "-46.9", lat: 1, lng: 2 };
    expect(pickRawLat(ap)).toBe("-22.4");
    expect(pickRawLng(ap)).toBe("-46.9");
  });

  it("cai para formatos alternativos", () => {
    expect(pickRawLat({ gps: { lat: -1 } })).toBe(-1);
    expect(pickRawLng({ location: { longitude: -2 } })).toBe(-2);
  });
});

describe("pickApId", () => {
  it("usa o MAC quando não há id", () => {
    expect(pickApId({ mac: "00:0B:82:AA:AA:AA" })).toBe("00:0B:82:AA:AA:AA");
  });

  it("ignora identificador vazio", () => {
    expect(pickApId({ id: "  " })).toBeUndefined();
  });
});

describe("normalizeApStatus", () => {
  it("1 é UP; qualquer outro valor é DOWN", () => {
    expect(normalizeApStatus(1)).toBe("UP");
    expect(normalizeApStatus("1")).toBe("UP");
    expect(normalizeApStatus(0)).toBe("DOWN");
    expect(normalizeApStatus(undefined)).toBe("DOWN");
  });
});
```

`tests/unit/gdmsClient.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@lib/gdmsToken", () => ({
  getAccessToken: vi.fn(async () => "token-antigo"),
  refreshToken: vi.fn(async () => ({ accessToken: "token-novo", expiresAt: Date.now() + 3_600_000 })),
}));

import { refreshToken } from "@lib/gdmsToken";
import { listAPsByNetwork, listNetworks } from "@services/gdms";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("services/gdms", () => {
  beforeEach(() => {
    process.env.GDMS_BASE = "https://gdms.test";
    process.env.GDMS_CLIENT_ID = "app";
    process.env.GDMS_CLIENT_SECRET = "secret";
    process.env.GDMS_PAGE_SIZE = "500";
  });

  it("normaliza latitude/longitude em texto e nome vazio do ap/list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          retCode: 0,
          data: {
            totalPage: 1,
            result: [
              { mac: "00:0B:82:AA:AA:01", name: "AP 1", status: 1, latitude: "-22.441292", longitude: "-46.972298" },
              { mac: "00:0B:82:AA:AA:02", name: "", status: 0, latitude: "", longitude: "" },
            ],
          },
        })
      )
    );

    const aps = await listAPsByNetwork("332714", "Rede A");

    expect(aps).toEqual([
      {
        networkId: "332714",
        networkName: "Rede A",
        apId: "00:0B:82:AA:AA:01",
        apName: "AP 1",
        status: "UP",
        coords: { lat: -22.441292, lng: -46.972298 },
      },
      {
        networkId: "332714",
        networkName: "Rede A",
        apId: "00:0B:82:AA:AA:02",
        apName: "AP-00:0B:82:AA:AA:02",
        status: "DOWN",
        coords: null,
      },
    ]);
  });

  it("renova o token e repete uma vez quando o GDMS responde 401", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ retCode: 0, data: { totalPage: 1, result: [{ id: 1, networkName: "Rede A" }] } }));
    vi.stubGlobal("fetch", fetchMock);

    const networks = await listNetworks();

    expect(networks).toEqual([{ id: "1", networkName: "Rede A" }]);
    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain("access_token=token-novo");
  });

  it("não entra em laço se o 401 persistir", async () => {
    const fetchMock = vi.fn(async () => new Response("unauthorized", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listNetworks()).rejects.toThrow("status 401");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 3: Rodar os testes e ver falhar**

Run: `npx vitest run tests/unit/gdmsNormalize.test.ts tests/unit/gdmsClient.test.ts`
Expected: FAIL — `Failed to resolve import "@lib/gdmsNormalize"`.

- [ ] **Step 4: Implementar `lib/gdmsNormalize.ts`**

```ts
// Normalização dos campos que o GWN/GDMS devolve no ap/list.
// O ap/list real devolve latitude/longitude como string ("-22.441292") ou "" quando o AP não tem posição.

export type Coordinates = { lat: number; lng: number };

type RawAp = Record<string, any>;

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseCoordinatePair(rawLat: unknown, rawLng: unknown): Coordinates | null {
  const lat = toFiniteNumber(rawLat);
  const lng = toFiniteNumber(rawLng);
  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

export function pickRawLat(ap: RawAp): unknown {
  return (
    ap.latitude ?? ap.ap_latitude ?? ap.lat ?? ap.Latitude ?? ap.Lat ??
    ap.gpsLatitude ?? ap.gpsLat ?? ap.gps?.latitude ?? ap.gps?.lat ??
    ap.locationLatitude ?? ap.location?.latitude ?? ap.location?.lat ??
    ap.position?.latitude ?? ap.position?.lat
  );
}

export function pickRawLng(ap: RawAp): unknown {
  return (
    ap.longitude ?? ap.ap_longitude ?? ap.lng ?? ap.lon ?? ap.Longitude ?? ap.Lng ??
    ap.gpsLongitude ?? ap.gpsLng ?? ap.gps?.longitude ?? ap.gps?.lng ??
    ap.locationLongitude ?? ap.location?.longitude ?? ap.location?.lng ??
    ap.position?.longitude ?? ap.position?.lng
  );
}

export function pickApId(ap: RawAp): string | undefined {
  const candidate =
    ap.id ??
    ap.apId ?? ap.ap_id ?? ap.apID ??
    ap.deviceId ?? ap.device_id ??
    ap.mac ?? ap.MAC ?? ap.macAddr ?? ap.macAddress ??
    ap.serialNumber ?? ap.sn ?? ap.SN ??
    ap.uuid ?? ap.UUID;
  if (candidate === undefined || candidate === null) return undefined;
  const value = String(candidate).trim();
  return value.length ? value : undefined;
}

export function normalizeApStatus(raw: unknown): "UP" | "DOWN" {
  return Number(raw) === 1 ? "UP" : "DOWN";
}
```

- [ ] **Step 5: Reescrever `services/gdms.ts`**

Substitua o arquivo inteiro por:

```ts
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
```

(O `clients: 0` é temporário: a Tarefa 6 troca pela contagem do `client/list`. A função `listAllAps` antiga sai porque não tem uso.)

- [ ] **Step 6: Ajustar o sync atual para o novo formato (mantém o build verde até a Tarefa 3)**

Em `app/api/integrations/gdms/sync/route.ts`, troque cada uso de `ap.lat`/`ap.lng`:
- `const lat = typeof ap.lat === "number" ? ap.lat : 0;` → `const lat = ap.coords?.lat ?? 0;`
- `const lon = typeof ap.lng === "number" ? ap.lng : 0;` → `const lon = ap.coords?.lng ?? 0;`
- `(typeof ap.lat === "number" || typeof ap.lng === "number");` → `ap.coords !== null;`
- o bloco `if (Number(existing.lat) === 0 && Number(existing.lon) === 0) { ... }` passa a ser:

```ts
            if (ap.coords) {
              assignments.push("`lat` = ?", "`lon` = ?");
              values.push(ap.coords.lat, ap.coords.lng);
            }
```

Esse arquivo será reescrito na Tarefa 3; este ajuste só mantém o typecheck passando.

- [ ] **Step 7: Rodar testes e typecheck**

Run: `npx vitest run tests/unit/gdmsNormalize.test.ts tests/unit/gdmsClient.test.ts && npx tsc --noEmit`
Expected: todos os testes PASS; tsc sem erros.

- [ ] **Step 8: Commit**

```bash
git add vitest.config.ts tests/stubs/server-only.ts tests/unit/gdmsNormalize.test.ts tests/unit/gdmsClient.test.ts lib/gdmsNormalize.ts services/gdms.ts app/api/integrations/gdms/sync/route.ts package.json .gitignore
git commit -m "fix(gdms): ler latitude/longitude em texto do ap/list e renovar token em 401" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Tarefa 2: Plano de atualização por AP (`planApUpdate`)

**Files:**
- Create: `lib/gdmsSyncPlan.ts`
- Test: `tests/unit/gdmsSyncPlan.test.ts`

**Interfaces:**
- Consumes: `Coordinates` (Tarefa 1).
- Produces:
  - `type SyncMode = "full" | "status"`
  - `type LocalAntennaSnapshot = { id: number; name: string; status: string; lat: number; lon: number; networkId: string | null; networkName: string | null }`
  - `type RemoteApSnapshot = { apId: string; apName: string; networkId: string; networkName: string; status: "UP" | "DOWN"; coords: Coordinates | null }` (compatível com `NormalizedAp`)
  - `type ApSyncPlan = { kind: "skip" } | { kind: "create"; values: CreateValues } | UpdatePlan`
  - `UpdatePlan = { kind: "update"; antennaId: number; previousStatus: string; antennaName: string; networkName: string | null; statusChanged: boolean; coordsChanged: boolean; metadataChanged: boolean; set: { status: "UP" | "DOWN"; lat?: number; lon?: number; name?: string; networkId?: string; networkName?: string } }`
  - `planApUpdate(existing: LocalAntennaSnapshot | null, ap: RemoteApSnapshot, mode: SyncMode): ApSyncPlan`

- [ ] **Step 1: Escrever os testes (falham)**

`tests/unit/gdmsSyncPlan.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { planApUpdate, type LocalAntennaSnapshot, type RemoteApSnapshot } from "@lib/gdmsSyncPlan";

const local: LocalAntennaSnapshot = {
  id: 7,
  name: "AP Praça",
  status: "UP",
  lat: -22.4,
  lon: -46.9,
  networkId: "10",
  networkName: "Rede A",
};

const remote: RemoteApSnapshot = {
  apId: "00:0B:82:AA:AA:01",
  apName: "AP Praça",
  networkId: "10",
  networkName: "Rede A",
  status: "UP",
  coords: { lat: -22.4, lng: -46.9 },
};

describe("planApUpdate", () => {
  it("cria AP novo no modo full já com a posição do GWN", () => {
    expect(planApUpdate(null, { ...remote, coords: { lat: -22.5, lng: -46.8 } }, "full")).toEqual({
      kind: "create",
      values: {
        name: "AP Praça",
        lat: -22.5,
        lon: -46.8,
        status: "UP",
        gdmsApId: "00:0B:82:AA:AA:01",
        networkId: "10",
        networkName: "Rede A",
      },
    });
  });

  it("cria AP novo em 0,0 quando o GWN não tem posição", () => {
    const plan = planApUpdate(null, { ...remote, coords: null }, "full");
    expect(plan).toMatchObject({ kind: "create", values: { lat: 0, lon: 0 } });
  });

  it("ignora AP novo no modo status", () => {
    expect(planApUpdate(null, remote, "status")).toEqual({ kind: "skip" });
  });

  it("aplica a posição do GWN sobre a posição local (GWN sempre vence)", () => {
    const plan = planApUpdate(local, { ...remote, coords: { lat: -22.45, lng: -46.95 } }, "status");
    expect(plan).toMatchObject({ kind: "update", coordsChanged: true, set: { lat: -22.45, lon: -46.95 } });
  });

  it("mantém a posição local quando o GWN não tem posição", () => {
    const plan = planApUpdate(local, { ...remote, coords: null }, "full");
    expect(plan).toMatchObject({ kind: "update", coordsChanged: false });
    if (plan.kind !== "update") throw new Error("esperava update");
    expect(plan.set.lat).toBeUndefined();
    expect(plan.set.lon).toBeUndefined();
  });

  it("não considera mudança abaixo da tolerância", () => {
    const plan = planApUpdate(local, { ...remote, coords: { lat: -22.40000001, lng: -46.9 } }, "status");
    expect(plan).toMatchObject({ kind: "update", coordsChanged: false });
  });

  it("detecta mudança de status e informa o status anterior", () => {
    const plan = planApUpdate(local, { ...remote, status: "DOWN" }, "status");
    expect(plan).toMatchObject({
      kind: "update",
      antennaId: 7,
      statusChanged: true,
      previousStatus: "UP",
      set: { status: "DOWN" },
    });
  });

  it("atualiza nome e rede só no modo full", () => {
    const changed = { ...remote, apName: "AP Praça 2", networkId: "11", networkName: "Rede B" };

    expect(planApUpdate(local, changed, "full")).toMatchObject({
      metadataChanged: true,
      antennaName: "AP Praça 2",
      networkName: "Rede B",
      set: { name: "AP Praça 2", networkId: "11", networkName: "Rede B" },
    });

    const statusOnly = planApUpdate(local, changed, "status");
    expect(statusOnly).toMatchObject({ metadataChanged: false, antennaName: "AP Praça", networkName: "Rede A" });
    if (statusOnly.kind !== "update") throw new Error("esperava update");
    expect(statusOnly.set.name).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/unit/gdmsSyncPlan.test.ts`
Expected: FAIL — `Failed to resolve import "@lib/gdmsSyncPlan"`.

- [ ] **Step 3: Implementar `lib/gdmsSyncPlan.ts`**

```ts
import type { Coordinates } from "@lib/gdmsNormalize";

// Decide, para cada AP lido do GWN, se o sync cria, atualiza ou ignora o registro local.
// Regra de coordenadas: o GWN sempre vence quando informa posição; sem posição no GWN, mantém a local.

export type SyncMode = "full" | "status";

export type LocalAntennaSnapshot = {
  id: number;
  name: string;
  status: string;
  lat: number;
  lon: number;
  networkId: string | null;
  networkName: string | null;
};

export type RemoteApSnapshot = {
  apId: string;
  apName: string;
  networkId: string;
  networkName: string;
  status: "UP" | "DOWN";
  coords: Coordinates | null;
};

export type CreateValues = {
  name: string;
  lat: number;
  lon: number;
  status: "UP" | "DOWN";
  gdmsApId: string;
  networkId: string;
  networkName: string;
};

export type UpdatePlan = {
  kind: "update";
  antennaId: number;
  previousStatus: string;
  antennaName: string;
  networkName: string | null;
  statusChanged: boolean;
  coordsChanged: boolean;
  metadataChanged: boolean;
  set: {
    status: "UP" | "DOWN";
    lat?: number;
    lon?: number;
    name?: string;
    networkId?: string;
    networkName?: string;
  };
};

export type ApSyncPlan = { kind: "skip" } | { kind: "create"; values: CreateValues } | UpdatePlan;

const COORD_EPSILON = 1e-7;

function coordsDiffer(local: { lat: number; lon: number }, remote: Coordinates) {
  return (
    Math.abs(Number(local.lat) - remote.lat) > COORD_EPSILON ||
    Math.abs(Number(local.lon) - remote.lng) > COORD_EPSILON
  );
}

export function planApUpdate(
  existing: LocalAntennaSnapshot | null,
  ap: RemoteApSnapshot,
  mode: SyncMode
): ApSyncPlan {
  if (!existing) {
    if (mode === "status") return { kind: "skip" };
    return {
      kind: "create",
      values: {
        name: ap.apName,
        lat: ap.coords?.lat ?? 0,
        lon: ap.coords?.lng ?? 0,
        status: ap.status,
        gdmsApId: ap.apId,
        networkId: ap.networkId,
        networkName: ap.networkName,
      },
    };
  }

  const set: UpdatePlan["set"] = { status: ap.status };
  const coordsChanged = ap.coords !== null && coordsDiffer(existing, ap.coords);
  if (coordsChanged && ap.coords) {
    set.lat = ap.coords.lat;
    set.lon = ap.coords.lng;
  }

  let metadataChanged = false;
  if (mode === "full") {
    if (existing.name !== ap.apName) {
      set.name = ap.apName;
      metadataChanged = true;
    }
    if ((existing.networkId ?? null) !== ap.networkId || (existing.networkName ?? null) !== ap.networkName) {
      set.networkId = ap.networkId;
      set.networkName = ap.networkName;
      metadataChanged = true;
    }
  }

  return {
    kind: "update",
    antennaId: existing.id,
    previousStatus: existing.status,
    antennaName: set.name ?? existing.name,
    networkName: set.networkName ?? existing.networkName,
    statusChanged: existing.status !== ap.status,
    coordsChanged,
    metadataChanged,
    set,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/unit/gdmsSyncPlan.test.ts`
Expected: PASS (8 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/gdmsSyncPlan.ts tests/unit/gdmsSyncPlan.test.ts
git commit -m "feat(sync): regra pura de criar/atualizar AP com posição do GWN" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Tarefa 3: Motor de sync, transições de status e rota

**Files:**
- Create: `lib/statusChanges.ts`, `lib/gdmsSync.ts`
- Modify: `lib/sse.ts` (adiciona `PendingEmit`/`emitAll`), `app/api/integrations/gdms/sync/route.ts` (arquivo inteiro), `app/api/antennas/[id]/route.ts` (função `PATCH`)
- Test: `tests/unit/gdmsSync.test.ts`

**Interfaces:**
- Consumes: `planApUpdate`, `SyncMode`, `LocalAntennaSnapshot` (Tarefa 2); `listNetworks`, `listAPsByNetwork` (Tarefa 1).
- Produces:
  - `lib/sse.ts`: `type PendingEmit = { event: string; payload: Record<string, unknown> }`, `emitAll(events: PendingEmit[]): void`
  - `lib/statusChanges.ts`: `type StatusTransition = { antennaId: number; antennaName: string; networkName: string | null; previousStatus: string; status: "UP" | "DOWN"; at: Date }`, `recordStatusTransition(connection: PoolConnection, t: StatusTransition): Promise<PendingEmit[]>`
  - `lib/gdmsSync.ts`: `type GdmsSyncSummary = { ok: boolean; mode: SyncMode; networks: number; totalFetched: number; created: number; updated: number; statusChanged: number; coordsUpdated: number; withoutCoords: number; errors: Array<{ apId: string; reason: string }>; at: string }`, `class SyncInProgressError`, `runGdmsSync(mode: SyncMode): Promise<GdmsSyncSummary>`

- [ ] **Step 1: Escrever os testes do motor (falham)**

`tests/unit/gdmsSync.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  executed: [] as Array<{ sql: string; params: unknown[] }>,
  localRows: [] as Array<Record<string, unknown>>,
}));

vi.mock("@lib/mysql", () => ({
  dbQuery: vi.fn(async () => db.localRows),
  dbQueryOne: vi.fn(async () => null),
  dbExecute: vi.fn(async (sql: string, params: unknown[] = []) => {
    db.executed.push({ sql, params });
    return { insertId: 99, affectedRows: 1 };
  }),
  withTransaction: vi.fn(async (callback: (connection: unknown) => Promise<unknown>) => callback({})),
}));

vi.mock("@lib/sse", () => {
  const emit = vi.fn();
  return {
    emit,
    emitAll: (events: Array<{ event: string; payload: unknown }>) =>
      events.forEach((item) => emit(item.event, item.payload)),
  };
});

vi.mock("@services/gdms", () => ({ listNetworks: vi.fn(), listAPsByNetwork: vi.fn() }));

import { withTransaction } from "@lib/mysql";
import { emit } from "@lib/sse";
import { listAPsByNetwork, listNetworks } from "@services/gdms";
import { runGdmsSync, SyncInProgressError } from "@lib/gdmsSync";

const apExisting = {
  networkId: "10",
  networkName: "Rede A",
  apId: "AA:01",
  apName: "AP Praça",
  status: "DOWN" as const,
  coords: { lat: -22.44, lng: -46.97 },
};
const apNew = {
  networkId: "10",
  networkName: "Rede A",
  apId: "AA:02",
  apName: "AP Novo",
  status: "UP" as const,
  coords: null,
};

describe("runGdmsSync", () => {
  beforeEach(() => {
    db.executed.length = 0;
    db.localRows = [
      { id: 7, name: "AP Praça", status: "UP", lat: 0, lon: 0, networkId: "10", networkName: "Rede A", gdmsApId: "AA:01" },
    ];
    vi.mocked(listNetworks).mockResolvedValue([{ id: "10", networkName: "Rede A" }]);
    vi.mocked(listAPsByNetwork).mockResolvedValue([apExisting, apNew]);
  });

  it("modo status: aplica posição e status dos APs existentes e não cria novos", async () => {
    const summary = await runGdmsSync("status");

    expect(summary).toMatchObject({
      ok: true,
      mode: "status",
      networks: 1,
      totalFetched: 2,
      created: 0,
      updated: 1,
      statusChanged: 1,
      coordsUpdated: 1,
      withoutCoords: 1,
      errors: [],
    });
    const update = db.executed.find((query) => query.sql.startsWith("UPDATE `Antenna`"));
    expect(update?.sql).toContain("`lat` = ?");
    expect(update?.params).toEqual(expect.arrayContaining([-22.44, -46.97, "DOWN", 7]));
    expect(db.executed.some((query) => query.sql.includes("INSERT INTO `StatusHistory`"))).toBe(true);
    expect(db.executed.some((query) => query.sql.startsWith("INSERT INTO `Antenna`"))).toBe(false);
    expect(emit).toHaveBeenCalledWith(
      "status.changed",
      expect.objectContaining({ id: 7, previousStatus: "UP", status: "DOWN" })
    );
  });

  it("modo full: cria o AP novo", async () => {
    const summary = await runGdmsSync("full");

    expect(summary.created).toBe(1);
    expect(db.executed.some((query) => query.sql.startsWith("INSERT INTO `Antenna`"))).toBe(true);
    expect(emit).toHaveBeenCalledWith("antenna.created", expect.objectContaining({ name: "AP Novo" }));
  });

  it("aplica uma única vez o AP que aparece em duas redes", async () => {
    vi.mocked(listNetworks).mockResolvedValue([
      { id: "10", networkName: "Rede A" },
      { id: "11", networkName: "Rede B" },
    ]);
    vi.mocked(listAPsByNetwork)
      .mockResolvedValueOnce([apExisting])
      .mockResolvedValueOnce([{ ...apExisting, networkId: "11", networkName: "Rede B" }]);

    const summary = await runGdmsSync("status");

    expect(summary.totalFetched).toBe(2);
    expect(summary.updated).toBe(1);
    expect(db.executed.filter((query) => query.sql.startsWith("UPDATE `Antenna`"))).toHaveLength(1);
  });

  it("registra erro por AP sem interromper o sync", async () => {
    vi.mocked(withTransaction).mockRejectedValueOnce(new Error("deadlock"));

    const summary = await runGdmsSync("status");

    expect(summary.ok).toBe(false);
    expect(summary.errors).toEqual([{ apId: "AA:01", reason: "deadlock" }]);
  });

  it("recusa execução simultânea", async () => {
    let release: () => void = () => undefined;
    vi.mocked(listNetworks).mockImplementationOnce(
      () => new Promise((resolve) => { release = () => resolve([]); })
    );

    const first = runGdmsSync("status");
    await expect(runGdmsSync("status")).rejects.toBeInstanceOf(SyncInProgressError);
    release();
    await expect(first).resolves.toMatchObject({ networks: 0 });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/unit/gdmsSync.test.ts`
Expected: FAIL — `Failed to resolve import "@lib/gdmsSync"`.

- [ ] **Step 3: `lib/sse.ts` — adicionar `PendingEmit` e `emitAll`**

Ao final de `lib/sse.ts`, adicione:

```ts
export type PendingEmit = { event: string; payload: Record<string, unknown> };

// Eventos montados dentro de uma transação só são emitidos depois do commit.
export function emitAll(events: PendingEmit[]) {
  for (const item of events) emit(item.event, item.payload);
}
```

- [ ] **Step 4: Criar `lib/statusChanges.ts`**

```ts
import "server-only";

import type { PoolConnection } from "mysql2/promise";
import { dbExecute } from "@lib/mysql";
import type { PendingEmit } from "@lib/sse";

export type StatusTransition = {
  antennaId: number;
  antennaName: string;
  networkName: string | null;
  previousStatus: string;
  status: "UP" | "DOWN";
  at: Date;
};

// Ponto único para qualquer mudança de status de AP (sync ou alteração manual).
// Grava o histórico e devolve os eventos SSE a emitir após o commit.
export async function recordStatusTransition(
  connection: PoolConnection,
  transition: StatusTransition
): Promise<PendingEmit[]> {
  await dbExecute(
    "INSERT INTO `StatusHistory` (`antennaId`, `status`, `changedAt`) VALUES (?, ?, ?)",
    [transition.antennaId, transition.status, transition.at],
    connection
  );

  return [
    {
      event: "status.changed",
      payload: {
        id: transition.antennaId,
        name: transition.antennaName,
        networkName: transition.networkName,
        previousStatus: transition.previousStatus,
        status: transition.status,
        at: transition.at.toISOString(),
      },
    },
  ];
}
```

- [ ] **Step 5: Criar `lib/gdmsSync.ts`**

```ts
import "server-only";

import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  planApUpdate,
  type ApSyncPlan,
  type LocalAntennaSnapshot,
  type SyncMode,
} from "@lib/gdmsSyncPlan";
import { dbExecute, dbQuery, withTransaction } from "@lib/mysql";
import { emitAll, type PendingEmit } from "@lib/sse";
import { recordStatusTransition } from "@lib/statusChanges";
import { listAPsByNetwork, listNetworks } from "@services/gdms";

export type { SyncMode } from "@lib/gdmsSyncPlan";

export type GdmsSyncSummary = {
  ok: boolean;
  mode: SyncMode;
  networks: number;
  totalFetched: number;
  created: number;
  updated: number;
  statusChanged: number;
  coordsUpdated: number;
  withoutCoords: number;
  errors: Array<{ apId: string; reason: string }>;
  at: string;
};

export class SyncInProgressError extends Error {
  constructor() {
    super("SYNC_IN_PROGRESS");
    this.name = "SyncInProgressError";
  }
}

type SyncGlobal = typeof globalThis & { __gdmsSyncRunning?: boolean };

type LocalAntennaRow = RowDataPacket & {
  id: number;
  name: string;
  status: string;
  lat: number;
  lon: number;
  networkId: string | null;
  networkName: string | null;
  gdmsApId: string;
};

async function loadLocalAntennas(): Promise<Map<string, LocalAntennaSnapshot>> {
  const rows = await dbQuery<LocalAntennaRow>(
    "SELECT `id`, `name`, `status`, `lat`, `lon`, `networkId`, `networkName`, `gdmsApId` FROM `Antenna` WHERE `gdmsApId` IS NOT NULL"
  );

  return new Map(
    rows.map((row) => [
      row.gdmsApId,
      {
        id: Number(row.id),
        name: row.name,
        status: row.status,
        lat: Number(row.lat),
        lon: Number(row.lon),
        networkId: row.networkId,
        networkName: row.networkName,
      },
    ])
  );
}

async function applyPlan(
  connection: PoolConnection,
  plan: Exclude<ApSyncPlan, { kind: "skip" }>,
  now: Date
): Promise<PendingEmit[]> {
  if (plan.kind === "create") {
    const values = plan.values;
    const result = await dbExecute(
      "INSERT INTO `Antenna` (`name`, `description`, `lat`, `lon`, `status`, `gdmsApId`, `networkId`, `networkName`, `lastSyncAt`, `createdAt`, `updatedAt`) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [values.name, values.lat, values.lon, values.status, values.gdmsApId, values.networkId, values.networkName, now, now, now],
      connection
    );
    await dbExecute(
      "INSERT INTO `StatusHistory` (`antennaId`, `status`, `changedAt`) VALUES (?, ?, ?)",
      [result.insertId, values.status, now],
      connection
    );
    return [
      {
        event: "antenna.created",
        payload: { id: result.insertId, name: values.name, networkName: values.networkName, status: values.status },
      },
    ];
  }

  const assignments = ["`status` = ?", "`lastSyncAt` = ?", "`updatedAt` = ?"];
  const values: Array<string | number | Date> = [plan.set.status, now, now];

  if (plan.statusChanged) {
    assignments.push("`lastStatusChange` = ?");
    values.push(now);
  }
  if (plan.set.lat !== undefined && plan.set.lon !== undefined) {
    assignments.push("`lat` = ?", "`lon` = ?");
    values.push(plan.set.lat, plan.set.lon);
  }
  if (plan.set.name !== undefined) {
    assignments.push("`name` = ?");
    values.push(plan.set.name);
  }
  if (plan.set.networkId !== undefined && plan.set.networkName !== undefined) {
    assignments.push("`networkId` = ?", "`networkName` = ?");
    values.push(plan.set.networkId, plan.set.networkName);
  }

  values.push(plan.antennaId);
  await dbExecute(`UPDATE \`Antenna\` SET ${assignments.join(", ")} WHERE \`id\` = ?`, values, connection);

  if (plan.statusChanged) {
    return recordStatusTransition(connection, {
      antennaId: plan.antennaId,
      antennaName: plan.antennaName,
      networkName: plan.networkName,
      previousStatus: plan.previousStatus,
      status: plan.set.status,
      at: now,
    });
  }

  if (plan.coordsChanged || plan.metadataChanged) {
    return [
      {
        event: "antenna.updated",
        payload: { id: plan.antennaId, name: plan.antennaName, networkName: plan.networkName, kind: "sync" },
      },
    ];
  }

  return [];
}

async function executeSync(mode: SyncMode): Promise<GdmsSyncSummary> {
  const now = new Date();
  const networks = await listNetworks();
  const local = await loadLocalAntennas();
  const seen = new Set<string>();

  const summary: GdmsSyncSummary = {
    ok: true,
    mode,
    networks: networks.length,
    totalFetched: 0,
    created: 0,
    updated: 0,
    statusChanged: 0,
    coordsUpdated: 0,
    withoutCoords: 0,
    errors: [],
    at: now.toISOString(),
  };

  for (const network of networks) {
    const aps = await listAPsByNetwork(network.id, network.networkName ?? "");
    summary.totalFetched += aps.length;

    for (const ap of aps) {
      // Um AP movido de rede durante a leitura pode aparecer duas vezes; aplica só a primeira.
      if (seen.has(ap.apId)) continue;
      seen.add(ap.apId);
      if (!ap.coords) summary.withoutCoords++;

      const plan = planApUpdate(local.get(ap.apId) ?? null, ap, mode);
      if (plan.kind === "skip") continue;

      try {
        const emits = await withTransaction((connection) => applyPlan(connection, plan, now));
        emitAll(emits);

        if (plan.kind === "create") {
          summary.created++;
        } else {
          summary.updated++;
          if (plan.statusChanged) summary.statusChanged++;
          if (plan.coordsChanged) summary.coordsUpdated++;
        }
      } catch (error: any) {
        summary.errors.push({ apId: ap.apId, reason: error?.message ?? String(error) });
      }
    }
  }

  summary.ok = summary.errors.length === 0;
  return summary;
}

export async function runGdmsSync(mode: SyncMode): Promise<GdmsSyncSummary> {
  const store = globalThis as SyncGlobal;
  if (store.__gdmsSyncRunning) throw new SyncInProgressError();

  store.__gdmsSyncRunning = true;
  try {
    return await executeSync(mode);
  } finally {
    store.__gdmsSyncRunning = false;
  }
}
```

- [ ] **Step 6: Reescrever `app/api/integrations/gdms/sync/route.ts`**

```ts
import { NextResponse } from "next/server";
import { requireRequestAuthOrInternal } from "@lib/auth";
import { runGdmsSync, SyncInProgressError, type SyncMode } from "@lib/gdmsSync";
import { checkRateLimit, rateLimitResponse } from "@lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const auth = await requireRequestAuthOrInternal(req, ["ADMIN", "SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    // Chamadas internas (worker a cada 5 min) não passam pelo limite; usuários sim.
    if ("user" in auth) {
      const rateLimit = checkRateLimit(req, "gdms-sync", {
        max: 4,
        windowMs: 15 * 60_000,
        key: auth.user.sub,
      });
      if (!rateLimit.ok) return rateLimitResponse(rateLimit);
    }

    const mode: SyncMode = new URL(req.url).searchParams.get("mode") === "status" ? "status" : "full";
    const summary = await runGdmsSync(mode);

    return NextResponse.json({ ...summary, errors: summary.errors.slice(0, 50) });
  } catch (e) {
    if (e instanceof SyncInProgressError) {
      return NextResponse.json({ ok: false, error: "SYNC_IN_PROGRESS" }, { status: 409 });
    }
    console.error("POST /api/integrations/gdms/sync error:", e);
    return NextResponse.json({ ok: false, error: "GDMS_SYNC_FAILED" }, { status: 500 });
  }
}
```

- [ ] **Step 7: `app/api/antennas/[id]/route.ts` — usar `recordStatusTransition` no PATCH**

Troque o import `import { emit } from "@lib/sse";` por:

```ts
import { emit, emitAll } from "@lib/sse";
import { recordStatusTransition } from "@lib/statusChanges";
```

Troque todo o bloco `try { const item = await withTransaction(... ) ... } catch (e) { ... }` da função `PATCH` (do `try {` após `const now = new Date();` até o fim da função) por:

```ts
  try {
    const { row: item, emits } = await withTransaction(async (connection) => {
      const assignments: string[] = [];
      const values: Array<string | Date> = [];

      if (data.name !== undefined) {
        assignments.push("`name` = ?");
        values.push(data.name);
      }
      if (data.description !== undefined) {
        assignments.push("`description` = ?");
        values.push(data.description);
      }
      if (data.status !== undefined) {
        assignments.push("`status` = ?");
        values.push(data.status);
      }
      if (statusChanged) {
        assignments.push("`lastStatusChange` = ?");
        values.push(now);
      }
      assignments.push("`updatedAt` = ?");
      values.push(now);
      values.push(String(idNum));

      await dbExecute(
        `UPDATE \`Antenna\` SET ${assignments.join(", ")} WHERE \`id\` = ?`,
        values,
        connection
      );

      const row = await dbQueryOne<AntennaRow>(
        "SELECT * FROM `Antenna` WHERE `id` = ? LIMIT 1",
        [idNum],
        connection
      );
      if (!row) {
        throw new Error("UPDATED_ANTENNA_NOT_FOUND");
      }

      const emits = statusChanged
        ? await recordStatusTransition(connection, {
            antennaId: idNum,
            antennaName: row.name,
            networkName: row.networkName,
            previousStatus: before.status,
            status: data.status as "UP" | "DOWN",
            at: now,
          })
        : [];

      return { row, emits };
    });

    if (emits.length) emitAll(emits);
    else emit("antenna.updated", { id: idNum });

    return NextResponse.json({ ok: true, item: mapAntennaRow(item) });
  } catch (e) {
    const mapped = mapDbError(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
```

- [ ] **Step 8: Rodar testes e typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: todos PASS; tsc sem erros.

- [ ] **Step 9: Commit**

```bash
git add lib/sse.ts lib/statusChanges.ts lib/gdmsSync.ts app/api/integrations/gdms/sync/route.ts "app/api/antennas/[id]/route.ts" tests/unit/gdmsSync.test.ts
git commit -m "feat(sync): motor de sync com posição do GWN em todo ciclo, trava e worker fora do limite" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Tarefa 4: Sessão revalidada no banco + `ApiError` com redirecionamento em 401

**Files:**
- Create: `lib/jwt.ts`, `lib/roles.ts`
- Modify: `lib/auth.ts` (arquivo inteiro), `middleware.ts` (import), `services/api.ts` (função `api` + `ApiError`)
- Test: `tests/unit/auth.test.ts`, `tests/unit/apiClient.test.ts`

**Interfaces:**
- Produces:
  - `lib/jwt.ts`: `AUTH_COOKIE_NAME`, `CSRF_COOKIE_NAME`, `type UserRole`, `type JwtPayload = { sub: string; email: string; name: string; role: UserRole }`, `getJwtExpiresDays()`, `signAuthToken(payload)`, `verifyAuthToken(token)`
  - `lib/roles.ts`: `normalizeRole(raw: unknown): UserRole`
  - `lib/auth.ts`: mesmas exportações de antes + `loadSessionUser(userId: string): Promise<JwtPayload | null>`; `requireRequestAuth` agora devolve o usuário vindo do banco e `401 SESSION_REVOKED` (com cookies apagados)
  - `services/api.ts`: `class ApiError extends Error { status: number; code: string | null; payload: any }`; `api()` lança `ApiError` e redireciona para `/login` em 401

- [ ] **Step 1: Escrever os testes (falham)**

`tests/unit/auth.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@lib/mysql", () => ({ dbQueryOne: vi.fn() }));

import { dbQueryOne } from "@lib/mysql";
import { requireRequestAuth } from "@lib/auth";
import { signAuthToken, type JwtPayload } from "@lib/jwt";

const tokenUser: JwtPayload = { sub: "5", email: "ana@exemplo.com", name: "Ana", role: "USER" };
const activeRow = {
  id: 5,
  name: "Ana Souza",
  email: "ana@exemplo.com",
  role: "ADMIN",
  isBlocked: 0,
  suspendedUntil: null,
};

async function requestWithToken(payload: JwtPayload = tokenUser) {
  const token = await signAuthToken(payload);
  return new Request("https://stats.test/api/me", { headers: { authorization: `Bearer ${token}` } });
}

describe("requireRequestAuth", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "x".repeat(40);
  });

  it("usa nome e papel atuais do banco, não os do token", async () => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce(activeRow as never);

    const result = await requireRequestAuth(await requestWithToken(), ["ADMIN"]);

    expect(result).toEqual({ user: { sub: "5", email: "ana@exemplo.com", name: "Ana Souza", role: "ADMIN" } });
  });

  it.each([
    ["excluído", null],
    ["bloqueado", { ...activeRow, isBlocked: 1 }],
    ["suspenso", { ...activeRow, suspendedUntil: new Date(Date.now() + 3_600_000) }],
  ])("recusa usuário %s com SESSION_REVOKED e apaga os cookies", async (_label, row) => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce(row as never);

    const result = await requireRequestAuth(await requestWithToken());

    if (!("response" in result)) throw new Error("esperava resposta de erro");
    expect(result.response.status).toBe(401);
    expect(await result.response.json()).toEqual({ ok: false, error: "SESSION_REVOKED" });
    const setCookie = result.response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("auth=");
    expect(setCookie).toContain("Max-Age=0");
  });

  it("devolve 403 quando o papel no banco não tem permissão", async () => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce({ ...activeRow, role: "USER" } as never);

    const result = await requireRequestAuth(
      await requestWithToken({ ...tokenUser, role: "SUPERADMIN" }),
      ["SUPERADMIN"]
    );

    if (!("response" in result)) throw new Error("esperava resposta de erro");
    expect(result.response.status).toBe(403);
  });

  it("recusa token inválido sem consultar o banco", async () => {
    const req = new Request("https://stats.test/api/me", { headers: { authorization: "Bearer invalido" } });

    const result = await requireRequestAuth(req);

    if (!("response" in result)) throw new Error("esperava resposta de erro");
    expect(result.response.status).toBe(401);
    expect(dbQueryOne).not.toHaveBeenCalled();
  });
});
```

`tests/unit/apiClient.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { api, ApiError } from "@services/api";

describe("api()", () => {
  it("lança ApiError com status e código da resposta", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: false, error: "SYNC_IN_PROGRESS" }), { status: 409 }))
    );

    const error = await api("/api/integrations/gdms/sync", { method: "POST" }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: "SYNC_IN_PROGRESS" });
  });

  it("redireciona para /login quando a API responde 401", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { pathname: "/dashboard", assign } });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: false, error: "SESSION_REVOKED" }), { status: 401 }))
    );

    await expect(api("/api/stats")).rejects.toMatchObject({ status: 401, code: "SESSION_REVOKED" });
    expect(assign).toHaveBeenCalledWith("/login");
  });

  it("não redireciona quando já está no /login", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { pathname: "/login", assign } });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));

    await expect(api("/api/me")).rejects.toBeInstanceOf(ApiError);
    expect(assign).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/unit/auth.test.ts tests/unit/apiClient.test.ts`
Expected: FAIL — `Failed to resolve import "@lib/jwt"` e `ApiError` não exportado.

- [ ] **Step 3: Criar `lib/jwt.ts`**

```ts
import { SignJWT, jwtVerify } from "jose";

// Seguro para o middleware (edge): só JWT e nomes de cookie, sem banco.

const issuer = "etherium";
const audience = "etherium-users";

export const AUTH_COOKIE_NAME = "auth";
export const CSRF_COOKIE_NAME = "csrf";

export type UserRole = "SUPERADMIN" | "ADMIN" | "USER";

export type JwtPayload = {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
};

function getSecret() {
  const value = process.env.JWT_SECRET?.trim();
  if (!value) throw new Error("Missing required environment variable: JWT_SECRET");
  if (value.length < 32) {
    throw new Error("Environment variable JWT_SECRET must be at least 32 characters long.");
  }
  return new TextEncoder().encode(value);
}

export function getJwtExpiresDays() {
  const raw = Number(process.env.JWT_EXPIRES_DAYS ?? 7);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 7;
}

export async function signAuthToken(payload: JwtPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(audience)
    .setExpirationTime(`${getJwtExpiresDays()}d`)
    .sign(getSecret());
}

export async function verifyAuthToken(token: string) {
  const { payload } = await jwtVerify(token, getSecret(), { issuer, audience });
  return payload as unknown as JwtPayload;
}
```

- [ ] **Step 4: Criar `lib/roles.ts`**

```ts
import type { UserRole } from "@lib/jwt";

export function normalizeRole(raw: unknown): UserRole {
  return raw === "SUPERADMIN" || raw === "ADMIN" ? raw : "USER";
}
```

- [ ] **Step 5: Reescrever `lib/auth.ts`**

```ts
import "server-only";

import type { RowDataPacket } from "mysql2/promise";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  getJwtExpiresDays,
  verifyAuthToken,
  type JwtPayload,
  type UserRole,
} from "@lib/jwt";
import { dbQueryOne } from "@lib/mysql";
import {
  getCookieValue,
  isUnsafeMethod,
  requireCsrfToken,
  requireTrustedOrigin as requestRequiresTrustedOrigin,
} from "@lib/requestSecurity";
import { normalizeRole } from "@lib/roles";
import { getUserAccountStatus } from "@lib/userStatus";

export {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  getJwtExpiresDays,
  signAuthToken,
  verifyAuthToken,
} from "@lib/jwt";
export type { JwtPayload, UserRole } from "@lib/jwt";

type CookieStoreLike = {
  set: (options: {
    name: string;
    value: string;
    httpOnly?: boolean;
    sameSite?: "strict" | "lax" | "none";
    secure?: boolean;
    path?: string;
    maxAge?: number;
    priority?: "low" | "medium" | "high";
  }) => unknown;
};

type SessionUserRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  role: string;
  isBlocked: number | boolean;
  suspendedUntil: Date | string | null;
};

export function shouldUseSecureCookies() {
  if (process.env.NODE_ENV === "production") return true;
  if (process.env.COOKIE_SECURE) return process.env.COOKIE_SECURE === "true";
  return false;
}

export function isAdminRole(role: UserRole | null | undefined) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

function buildBaseCookieOptions(maxAge: number) {
  return {
    sameSite: "strict" as const,
    secure: shouldUseSecureCookies(),
    path: "/",
    maxAge,
    priority: "high" as const,
  };
}

function createCsrfToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function setAuthCookies(cookieStore: CookieStoreLike, authToken: string) {
  const maxAge = 60 * 60 * 24 * getJwtExpiresDays();
  const baseOptions = buildBaseCookieOptions(maxAge);

  cookieStore.set({
    name: AUTH_COOKIE_NAME,
    value: authToken,
    httpOnly: true,
    ...baseOptions,
  });

  cookieStore.set({
    name: CSRF_COOKIE_NAME,
    value: createCsrfToken(),
    httpOnly: false,
    ...baseOptions,
  });
}

export function clearAuthCookies(cookieStore: CookieStoreLike) {
  const baseOptions = buildBaseCookieOptions(0);

  cookieStore.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    ...baseOptions,
  });

  cookieStore.set({
    name: CSRF_COOKIE_NAME,
    value: "",
    httpOnly: false,
    ...baseOptions,
  });
}

function getAuthTokenRecordFromRequest(req: Request) {
  const bearer = req.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) {
    return { token: bearer.slice("Bearer ".length).trim(), source: "bearer" as const };
  }

  const authCookie = getCookieValue(req, AUTH_COOKIE_NAME);
  if (authCookie) {
    return { token: authCookie, source: "cookie" as const };
  }

  return { token: null, source: null };
}

export function getAuthTokenFromRequest(req: Request) {
  return getAuthTokenRecordFromRequest(req).token;
}

export function requireTrustedOrigin(req: Request) {
  return requestRequiresTrustedOrigin(req);
}

export function requireCookieMutationProtection(req: Request) {
  if (!isUnsafeMethod(req.method)) return null;
  return requireCsrfToken(req, CSRF_COOKIE_NAME);
}

function deny(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

// Sessão revogada (usuário excluído, bloqueado ou suspenso): apaga os cookies para o
// middleware não devolver o usuário de /login para / em laço.
function revokedSessionResponse() {
  const response = deny(401, "SESSION_REVOKED");
  clearAuthCookies(response.cookies);
  return response;
}

function constantTimeEqual(a: string, b: string) {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);

  if (left.length !== right.length) return false;

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index];
  }

  return diff === 0;
}

export async function loadSessionUser(userId: string): Promise<JwtPayload | null> {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) return null;

  const row = await dbQueryOne<SessionUserRow>(
    "SELECT `id`, `name`, `email`, `role`, `isBlocked`, `suspendedUntil` FROM `User` WHERE `id` = ? LIMIT 1",
    [id]
  );
  if (!row) return null;
  if (getUserAccountStatus(row).status !== "ACTIVE") return null;

  return {
    sub: String(row.id),
    email: row.email,
    name: row.name ?? "",
    role: normalizeRole(row.role),
  };
}

export async function requireRequestAuth(req: Request, roles?: UserRole[]) {
  const { token, source } = getAuthTokenRecordFromRequest(req);
  if (!token) return { response: deny(401, "UNAUTHORIZED") };

  if (source === "cookie" && isUnsafeMethod(req.method)) {
    const csrfError = requireCookieMutationProtection(req);
    if (csrfError) return { response: csrfError };
  }

  let tokenUser: JwtPayload;
  try {
    tokenUser = await verifyAuthToken(token);
  } catch {
    return { response: deny(401, "UNAUTHORIZED") };
  }

  const user = await loadSessionUser(tokenUser.sub);
  if (!user) return { response: revokedSessionResponse() };

  if (roles?.length && !roles.includes(user.role)) {
    return { response: deny(403, "FORBIDDEN") };
  }
  return { user };
}

export function hasInternalApiKey(req: Request) {
  const expected = process.env.INTERNAL_API_KEY?.trim();
  if (!expected) return false;
  if (expected.length < 24) return false;

  const received = req.headers.get("x-internal-api-key")?.trim();
  if (!received) return false;
  return constantTimeEqual(received, expected);
}

export async function requireRequestAuthOrInternal(req: Request, roles?: UserRole[]) {
  if (hasInternalApiKey(req)) return { internal: true as const };
  return requireRequestAuth(req, roles);
}
```

- [ ] **Step 6: `middleware.ts` — importar do módulo edge-safe**

Troque `import { AUTH_COOKIE_NAME, verifyAuthToken } from "@lib/auth";` por:

```ts
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@lib/jwt";
```

- [ ] **Step 7: `services/api.ts` — `ApiError` e redirecionamento**

Substitua a função `api` (do `export async function api<T>` até o fim do arquivo) por:

```ts
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
```

- [ ] **Step 8: Rodar testes, typecheck e build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: testes PASS; tsc limpo; build conclui e lista `ƒ Middleware` (o middleware não pode importar `mysql2`).

- [ ] **Step 9: Commit**

```bash
git add lib/jwt.ts lib/roles.ts lib/auth.ts middleware.ts services/api.ts tests/unit/auth.test.ts tests/unit/apiClient.test.ts
git commit -m "fix(auth): revalidar sessão no banco a cada requisição e redirecionar 401 ao login" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Tarefa 5: Tela Configurações (resumo do sync, fila só com APs sem posição no GWN)

**Files:**
- Create: `lib/dateFormat.ts`
- Modify: `services/api.ts` (tipo `GdmsSyncSummary`), `app/(app)/settings/page.tsx` (arquivo inteiro)
- Test: `tests/unit/dateFormat.test.ts`

**Interfaces:**
- Consumes: `ApiError`, `api` (Tarefa 4); resposta da rota de sync (Tarefa 3).
- Produces:
  - `lib/dateFormat.ts`: `APP_TIME_ZONE = "America/Sao_Paulo"`, `toDate(value: Date | string | number): Date`, `formatDateTimeBR(value: Date | string | number | null | undefined): string` (`"-"` quando vazio ou inválido)
  - `services/api.ts`: `interface GdmsSyncSummary` (mesmos campos de `lib/gdmsSync.ts`)

- [ ] **Step 1: Teste de formatação de data (falha)**

`tests/unit/dateFormat.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatDateTimeBR, toDate } from "@lib/dateFormat";

describe("formatDateTimeBR", () => {
  it("formata no fuso de São Paulo mesmo com o servidor em UTC", () => {
    expect(formatDateTimeBR("2026-10-08T15:30:00Z")).toMatch(/^08\/10\/2026,? 12:30$/);
  });

  it("devolve '-' para vazio ou inválido", () => {
    expect(formatDateTimeBR(null)).toBe("-");
    expect(formatDateTimeBR("")).toBe("-");
    expect(formatDateTimeBR("não é data")).toBe("-");
  });
});

describe("toDate", () => {
  it("aceita Date e string ISO", () => {
    const date = new Date("2026-10-08T10:00:00Z");
    expect(toDate(date)).toBe(date);
    expect(toDate("2026-10-08T10:00:00Z").getTime()).toBe(date.getTime());
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/unit/dateFormat.test.ts`
Expected: FAIL — `Failed to resolve import "@lib/dateFormat"`.

- [ ] **Step 3: Criar `lib/dateFormat.ts`**

```ts
// Datas são gravadas em UTC; toda exibição usa o fuso da operação.
export const APP_TIME_ZONE = "America/Sao_Paulo";

export function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDateTimeBR(value: Date | string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/unit/dateFormat.test.ts`
Expected: PASS.

- [ ] **Step 5: `services/api.ts` — tipo do resumo do sync**

Logo após a interface `AntennaNetworksResponse`, adicione:

```ts
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
```

- [ ] **Step 6: Reescrever `app/(app)/settings/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import AntennaToolbar from "@components/AntennaToolbar";
import PaginationControls from "@components/PaginationControls";
import { formatDateTimeBR } from "@lib/dateFormat";
import {
  api,
  ApiError,
  type Antenna,
  type AntennaListResponse,
  type AntennaNetworksResponse,
  type GdmsSyncSummary,
} from "@services/api";
import { connectSSE } from "@services/sseClient";

type DraftRow = {
  lat: string;
  lon: string;
  description: string;
};

type Feedback = { kind: "error" | "success"; message: string } | null;

const SUMMARY_FIELDS: Array<{ key: keyof GdmsSyncSummary; label: string }> = [
  { key: "networks", label: "Redes" },
  { key: "totalFetched", label: "APs lidos no GWN" },
  { key: "created", label: "APs novos" },
  { key: "coordsUpdated", label: "Posições aplicadas" },
  { key: "statusChanged", label: "Mudanças de status" },
  { key: "withoutCoords", label: "Sem posição no GWN" },
];

function buildPath({
  page,
  pageSize,
  query,
  network,
}: {
  page: number;
  pageSize: number;
  query: string;
  network: string;
}) {
  const params = new URLSearchParams();
  params.set("unsaved", "1");
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (query.trim()) params.set("q", query.trim());
  if (network) params.set("network", network);
  return `/api/antennas?${params.toString()}`;
}

function antennaId(value: string | number) {
  return Number(value);
}

function describeSyncError(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "SYNC_IN_PROGRESS":
        return "Já existe uma sincronização em andamento. Aguarde alguns instantes e tente de novo.";
      case "RATE_LIMITED": {
        const seconds = Number(error.payload?.retryAfterSec ?? 0);
        const minutes = Math.max(1, Math.ceil(seconds / 60));
        return `Limite de sincronizações atingido. Tente novamente em ${minutes} min.`;
      }
      case "GDMS_SYNC_FAILED":
        return "Não foi possível consultar o GDMS agora. Tente novamente em instantes.";
      default:
        break;
    }
  }
  return "Falha ao sincronizar com o GDMS.";
}

function describeSaveError(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "INVALID_LAT":
        return "Latitude inválida. Use um valor entre -90 e 90.";
      case "INVALID_LON":
        return "Longitude inválida. Use um valor entre -180 e 180.";
      case "INVALID_DESCRIPTION":
        return "As observações podem ter no máximo 500 caracteres.";
      case "NOTHING_TO_UPDATE":
        return "Não há alterações para salvar.";
      case "NOT_FOUND":
        return "Este AP não existe mais.";
      default:
        break;
    }
  }
  return "Não foi possível salvar a posição.";
}

export default function SettingsPage() {
  const [items, setItems] = useState<Antenna[]>([]);
  const [networks, setNetworks] = useState<string[]>([]);
  const [draft, setDraft] = useState<Record<number, DraftRow>>({});
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [query, setQuery] = useState("");
  const [network, setNetwork] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [syncSummary, setSyncSummary] = useState<GdmsSyncSummary | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      try {
        const response = await api<AntennaListResponse>(
          buildPath({ page, pageSize, query, network })
        );
        if (!alive) return;

        setItems(response.items ?? []);
        setTotalCount(response.totalCount ?? 0);
        setTotalPages(response.totalPages ?? 1);
        if (response.page && response.page !== page) setPage(response.page);

        setDraft((prev) => {
          const next = { ...prev };
          for (const antenna of response.items ?? []) {
            const id = antennaId(antenna.id);
            next[id] = {
              lat: prev[id]?.lat ?? String(antenna.lat ?? 0),
              lon: prev[id]?.lon ?? String(antenna.lon ?? 0),
              description: prev[id]?.description ?? String(antenna.description ?? ""),
            };
          }
          return next;
        });
      } catch {
        if (alive) {
          setItems([]);
          setTotalCount(0);
          setTotalPages(1);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [page, pageSize, query, network, refreshKey]);

  useEffect(() => {
    let alive = true;

    async function loadNetworks() {
      try {
        const response = await api<AntennaNetworksResponse>("/api/antennas/networks");
        if (alive) setNetworks(response.items ?? []);
      } catch {
        if (alive) setNetworks([]);
      }
    }

    loadNetworks();
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    const disconnect = connectSSE((event) => {
      try {
        const payload = JSON.parse(event.data);
        if (
          ["antenna.created", "antenna.updated", "antenna.deleted", "status.changed"].includes(
            payload.event
          )
        ) {
          setRefreshKey((value) => value + 1);
        }
      } catch {}
    });

    return disconnect;
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ q?: string }>;
      setQuery(custom.detail?.q || "");
      setPage(1);
    };

    window.addEventListener("search-antennas", handler as EventListener);
    return () => window.removeEventListener("search-antennas", handler as EventListener);
  }, []);

  function updateDraft(id: number, field: keyof DraftRow, value: string) {
    setDraft((prev) => ({
      ...prev,
      [id]: {
        lat: prev[id]?.lat ?? "",
        lon: prev[id]?.lon ?? "",
        description: prev[id]?.description ?? "",
        [field]: value,
      },
    }));
  }

  async function doSync() {
    setSyncing(true);
    setFeedback(null);
    try {
      const summary = await api<GdmsSyncSummary>("/api/integrations/gdms/sync", { method: "POST" });
      setSyncSummary(summary);
      setFeedback(
        summary.errors.length
          ? {
              kind: "error",
              message: `Sincronização concluída com ${summary.errors.length} erro(s). Veja os detalhes abaixo.`,
            }
          : { kind: "success", message: "Sincronização concluída." }
      );
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setFeedback({ kind: "error", message: describeSyncError(error) });
    } finally {
      setSyncing(false);
    }
  }

  async function saveRow(antenna: Antenna) {
    const id = antennaId(antenna.id);
    const row = draft[id] ?? { lat: "", lon: "", description: "" };
    setFeedback(null);

    try {
      await api(`/api/antennas/${id}/coords`, {
        method: "PATCH",
        body: JSON.stringify({ lat: row.lat, lon: row.lon, description: row.description }),
      });
      setFeedback({ kind: "success", message: `Posição de ${antenna.name} salva.` });
      if (items.length === 1 && page > 1) setPage(page - 1);
      else setRefreshKey((value) => value + 1);
    } catch (error) {
      setFeedback({ kind: "error", message: describeSaveError(error) });
    }
  }

  function onKeySave(event: React.KeyboardEvent, antenna: Antenna) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    saveRow(antenna);
  }

  return (
    <div className="space-y-4">
      <AntennaToolbar
        title="Configurações"
        description="APs sem posição no GWN. Configure a localização no GWN para o próximo sync aplicar automaticamente; os campos abaixo são só uma alternativa."
        query={query}
        network={network}
        networks={networks}
        pageSize={pageSize}
        totalCount={totalCount}
        queryPlaceholder="Buscar por AP ou rede..."
        onQueryChange={(value) => {
          setQuery(value);
          setPage(1);
        }}
        onNetworkChange={(value) => {
          setNetwork(value);
          setPage(1);
        }}
        onPageSizeChange={(value) => {
          setPageSize(value);
          setPage(1);
        }}
        extraAction={
          <button
            type="button"
            onClick={doSync}
            disabled={syncing}
            className="rounded-2xl bg-brand1 px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {syncing ? "Sincronizando..." : "Sincronizar GDMS"}
          </button>
        }
      />

      {feedback && (
        <div
          role="status"
          className={`rounded-2xl border px-4 py-3 text-sm ${
            feedback.kind === "error"
              ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {syncSummary && (
        <section className="glass space-y-3 rounded-3xl p-5" aria-label="Resumo da última sincronização">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">Última sincronização</h2>
            <span className="text-xs opacity-70">{formatDateTimeBR(syncSummary.at)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {SUMMARY_FIELDS.map((field) => (
              <div key={field.key} className="surface-soft rounded-2xl px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.16em] opacity-60">{field.label}</div>
                <div className="mt-1 text-lg font-semibold">{String(syncSummary[field.key])}</div>
              </div>
            ))}
          </div>
          {syncSummary.errors.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-rose-600 dark:text-rose-300">
                {syncSummary.errors.length} AP(s) com erro
              </summary>
              <ul className="mt-2 space-y-1 text-xs opacity-80">
                {syncSummary.errors.slice(0, 10).map((item) => (
                  <li key={item.apId}>
                    <strong>{item.apId}</strong>: {item.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      <section className="glass rounded-3xl p-5">
        <div className="mb-4 space-y-1 text-sm opacity-75">
          <p>
            Esta fila mostra só os APs para os quais o GWN ainda não informa posição. Ao configurar a
            localização no GWN, o próximo sync (automático a cada 5 minutos) posiciona o AP e ele sai daqui.
          </p>
          <p>Uma posição digitada aqui será substituída assim que o GWN passar a informar a localização.</p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-black/5 dark:bg-white/10">
              <tr>
                <th className="p-3 text-left">Nome do AP</th>
                <th className="p-3 text-left">Rede</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Latitude</th>
                <th className="p-3 text-left">Longitude</th>
                <th className="p-3 text-left">Observações</th>
                <th className="p-3 text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="p-4 text-center opacity-60">
                    Carregando...
                  </td>
                </tr>
              )}

              {!loading &&
                items.map((antenna) => {
                  const id = antennaId(antenna.id);
                  const row = draft[id] ?? { lat: "", lon: "", description: "" };
                  const isUp = antenna.status === "UP";

                  return (
                    <tr key={id} className="border-t border-black/10 dark:border-white/10">
                      <td className="p-3">{antenna.name}</td>
                      <td className="p-3">{antenna.networkName ?? "-"}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            isUp
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                              : "bg-rose-500/15 text-rose-600 dark:text-rose-300"
                          }`}
                        >
                          {isUp ? "UP" : "DOWN"}
                        </span>
                      </td>
                      <td className="p-3">
                        <input
                          value={row.lat}
                          onChange={(event) => updateDraft(id, "lat", event.target.value)}
                          onKeyDown={(event) => onKeySave(event, antenna)}
                          placeholder="-23.50000"
                          inputMode="decimal"
                          aria-label={`Latitude de ${antenna.name}`}
                          className="surface-field w-32 rounded-xl px-3 py-2"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          value={row.lon}
                          onChange={(event) => updateDraft(id, "lon", event.target.value)}
                          onKeyDown={(event) => onKeySave(event, antenna)}
                          placeholder="-46.60000"
                          inputMode="decimal"
                          aria-label={`Longitude de ${antenna.name}`}
                          className="surface-field w-32 rounded-xl px-3 py-2"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          value={row.description}
                          onChange={(event) => updateDraft(id, "description", event.target.value)}
                          onKeyDown={(event) => onKeySave(event, antenna)}
                          placeholder="Ponto de referência / observações"
                          aria-label={`Observações de ${antenna.name}`}
                          className="surface-field w-full min-w-64 rounded-xl px-3 py-2"
                        />
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => saveRow(antenna)}
                          className="rounded-xl bg-brand1 px-4 py-2 text-white transition hover:opacity-90"
                        >
                          Salvar
                        </button>
                      </td>
                    </tr>
                  );
                })}

              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center opacity-60">
                    Nenhum AP pendente: todos já têm posição.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginationControls
          page={page}
          totalPages={totalPages}
          totalItems={totalCount}
          pageSize={pageSize}
          onPageChange={setPage}
          itemLabel="APs pendentes"
        />
      </section>
    </div>
  );
}
```

- [ ] **Step 7: Typecheck e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 8: Commit**

```bash
git add lib/dateFormat.ts tests/unit/dateFormat.test.ts services/api.ts "app/(app)/settings/page.tsx"
git commit -m "feat(settings): resumo do sync e fila só com APs sem posição no GWN" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Tarefa 6: /clients — contagem pela lista de clientes ativos, com cache de 60 s

**Files:**
- Create: `lib/ttlCache.ts`
- Modify: `services/gdms.ts` (`countActiveClients` + `listConnectedClientsByNetwork`), `app/api/stats/network-clients/route.ts` (arquivo inteiro), `services/api.ts` (`source` na resposta), `components/Client/index.tsx` (arquivo inteiro), `app/(app)/clients/page.tsx` (mensagem de erro), `components/DashboardCards.tsx` (rótulos)
- Test: `tests/unit/ttlCache.test.ts`, `tests/unit/gdmsClient.test.ts` (novo caso)

**Interfaces:**
- Produces:
  - `createCachedLoader<T>(loader: () => Promise<T>, ttlMs: number, now?: () => number): () => Promise<{ value: T; cachedAt: number }>`
  - `countActiveClients(networkId: string): Promise<number>`
  - resposta de `GET /api/stats/network-clients`: `{ ok, source: "client/list", totalNetworks, totalClients, items, generatedAt }`

- [ ] **Step 1: Testes (falham)**

`tests/unit/ttlCache.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createCachedLoader } from "@lib/ttlCache";

describe("createCachedLoader", () => {
  it("reaproveita o valor dentro do TTL", async () => {
    let clock = 1_000;
    const loader = vi.fn(async () => "valor");
    const load = createCachedLoader(loader, 60_000, () => clock);

    await load();
    clock += 59_000;
    await expect(load()).resolves.toEqual({ value: "valor", cachedAt: 1_000 });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("recarrega depois do TTL", async () => {
    let clock = 1_000;
    const loader = vi.fn(async () => clock);
    const load = createCachedLoader(loader, 60_000, () => clock);

    await load();
    clock += 60_000;
    await expect(load()).resolves.toEqual({ value: 61_000, cachedAt: 61_000 });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("compartilha a chamada em andamento entre requisições simultâneas", async () => {
    const loader = vi.fn(async () => "valor");
    const load = createCachedLoader(loader, 60_000);

    await Promise.all([load(), load(), load()]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("não guarda erro no cache", async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error("GDMS fora")).mockResolvedValueOnce("ok");
    const load = createCachedLoader(loader, 60_000);

    await expect(load()).rejects.toThrow("GDMS fora");
    await expect(load()).resolves.toMatchObject({ value: "ok" });
  });
});
```

Em `tests/unit/gdmsClient.test.ts`, troque a linha de import `import { listAPsByNetwork, listNetworks } from "@services/gdms";` por:

```ts
import { countActiveClients, listAPsByNetwork, listNetworks } from "@services/gdms";
```

e adicione dentro do `describe("services/gdms", ...)`:

```ts
  it("conta clientes ativos pelo total do client/list", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ retCode: 0, data: { total: 30, totalPage: 30, result: [{}] } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(countActiveClients("332714")).resolves.toBe(30);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/oapi/v1.0.0/client/list");
    expect(JSON.parse(String(init.body))).toMatchObject({
      pageNum: 1,
      pageSize: 1,
      networkId: 332714,
      filter: { ssidId: "all_ssid" },
    });
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/unit/ttlCache.test.ts tests/unit/gdmsClient.test.ts`
Expected: FAIL — `@lib/ttlCache` inexistente e `countActiveClients` não exportado.

- [ ] **Step 3: Criar `lib/ttlCache.ts`**

```ts
// Cache em memória com TTL e deduplicação da chamada em andamento.
// Usado para não repetir dezenas de consultas ao GWN a cada aba aberta.
export function createCachedLoader<T>(
  loader: () => Promise<T>,
  ttlMs: number,
  now: () => number = Date.now
) {
  let cached: { value: T; at: number } | null = null;
  let inflight: Promise<{ value: T; at: number }> | null = null;

  return async function load(): Promise<{ value: T; cachedAt: number }> {
    if (cached && now() - cached.at < ttlMs) {
      return { value: cached.value, cachedAt: cached.at };
    }

    if (!inflight) {
      inflight = loader()
        .then((value) => {
          cached = { value, at: now() };
          return cached;
        })
        .finally(() => {
          inflight = null;
        });
    }

    const fresh = await inflight;
    return { value: fresh.value, cachedAt: fresh.at };
  };
}
```

- [ ] **Step 4: `services/gdms.ts` — contagem pelo `client/list`**

Acima de `export async function listConnectedClientsByNetwork`, adicione:

```ts
// Clientes conectados agora, segundo o GWN: total da lista de clientes ativos da rede.
// (A soma de ap.clients do ap/list não bate com o portal; ver spec 1.1.)
export async function countActiveClients(networkId: string): Promise<number> {
  const json = await postJson<{ data?: { total?: number | string } }>("/oapi/v1.0.0/client/list", {
    search: "",
    order: "",
    pageNum: 1,
    pageSize: 1,
    networkId: Number(networkId),
    filter: { ssidId: "all_ssid" },
  });
  const total = Number(json.data?.total ?? 0);
  return Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
}
```

Em `listConnectedClientsByNetwork`, troque:

```ts
    const aps = await listAPsByNetwork(network.id, network.networkName ?? "");
```

por:

```ts
    const [aps, clients] = await Promise.all([
      listAPsByNetwork(network.id, network.networkName ?? ""),
      countActiveClients(network.id),
    ]);
```

e troque `clients: 0,` por `clients,`.

- [ ] **Step 5: Reescrever `app/api/stats/network-clients/route.ts`**

```ts
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
```

- [ ] **Step 6: `services/api.ts` — campo `source`**

Em `interface NetworkClientStatsResponse`, adicione a linha `source?: string;` logo após `ok: boolean;`.

- [ ] **Step 7: Reescrever `components/Client/index.tsx`**

```tsx
import { formatDateTimeBR } from "@lib/dateFormat";
import type { NetworkClientStat } from "@services/api";

type Props = {
  items: NetworkClientStat[];
  totalClients: number;
  totalNetworks: number;
  generatedAt?: string | null;
  isLoading?: boolean;
  error?: string | null;
};

function fmtInt(value: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.max(0, Math.floor(value || 0)));
}

function SkeletonCard() {
  return (
    <div className="surface-soft rounded-2xl p-4">
      <div className="h-3 w-24 animate-pulse rounded bg-black/10 dark:bg-white/10" />
      <div className="mt-3 h-8 w-20 animate-pulse rounded bg-black/10 dark:bg-white/10" />
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="h-14 animate-pulse rounded-2xl bg-black/10 dark:bg-white/10" />
        <div className="h-14 animate-pulse rounded-2xl bg-black/10 dark:bg-white/10" />
        <div className="h-14 animate-pulse rounded-2xl bg-black/10 dark:bg-white/10" />
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-field rounded-2xl px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.18em] opacity-60">{label}</div>
      <div className="mt-1 text-lg font-semibold">{fmtInt(value)}</div>
    </div>
  );
}

export default function Client({
  items,
  totalClients,
  totalNetworks,
  generatedAt,
  isLoading = false,
  error,
}: Props) {
  const lastUpdatedLabel = generatedAt ? formatDateTimeBR(generatedAt) : null;

  return (
    <section className="glass space-y-4 rounded-3xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Clientes conectados por rede</h2>
          <p className="text-sm opacity-70">
            Clientes ativos agora, segundo a lista de clientes conectados do GWN.
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
            Total de clientes
          </div>
          <div className="mt-1 text-3xl font-semibold text-emerald-700 dark:text-emerald-200">
            {fmtInt(totalClients)}
          </div>
          <div className="mt-1 text-xs opacity-70">
            {fmtInt(totalNetworks)} {totalNetworks === 1 ? "rede" : "redes"}
            {lastUpdatedLabel ? ` · Atualizado em ${lastUpdatedLabel}` : ""}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : items.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.networkId}
              className="surface-soft rounded-2xl p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.18em] opacity-60">Rede</div>
                  <h3 className="mt-1 break-words text-base font-semibold">
                    {item.networkName || `Rede ${item.networkId}`}
                  </h3>
                </div>

                <div className="shrink-0 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-right">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                    Clientes
                  </div>
                  <div className="text-2xl font-semibold text-emerald-700 dark:text-emerald-200">
                    {fmtInt(item.clients)}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <StatChip label="APs" value={item.aps} />
                <StatChip label="Online" value={item.onlineAps} />
                <StatChip label="Offline" value={item.offlineAps} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-black/15 px-4 py-6 text-sm opacity-70 dark:border-white/15">
          Nenhuma rede retornou clientes conectados no GWN.
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 8: Textos na página /clients e no Dashboard**

Em `app/(app)/clients/page.tsx`, troque `"Nao foi possivel carregar os clientes por network no GDMS agora."` por `"Não foi possível carregar os clientes por rede no GWN agora."`.

Em `components/DashboardCards.tsx`:
- `` `${fmtInt(clientNetworks)} network${clientNetworks === 1 ? "" : "s"}` `` → `` `${fmtInt(clientNetworks)} ${clientNetworks === 1 ? "rede" : "redes"}` ``
- `"Visao geral do GDMS"` → `"Visão geral do GDMS"`
- `"Clientes conectados em atualizacao"` → `"Clientes conectados em atualização"`

- [ ] **Step 9: Testes, typecheck e lint**

Run: `npx vitest run && npx tsc --noEmit && npm run lint`
Expected: tudo PASS / sem erros.

- [ ] **Step 10: Commit**

```bash
git add lib/ttlCache.ts tests/unit/ttlCache.test.ts tests/unit/gdmsClient.test.ts services/gdms.ts services/api.ts app/api/stats/network-clients/route.ts components/Client/index.tsx "app/(app)/clients/page.tsx" components/DashboardCards.tsx
git commit -m "fix(clients): contar clientes pela lista de ativos do GWN com cache de 60 s" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Tarefa 7: Endurecimento — erros de banco, e-mail com escape, URL pública, SSE único

**Files:**
- Create: `lib/emailTemplates.ts`, `lib/publicUrl.ts`
- Modify: `lib/dbErrors.ts` (arquivo inteiro), `lib/passwordReset.ts` (arquivo inteiro), `app/api/auth/forgot-password/route.ts` (bloco do e-mail), `lib/sse.ts` (registro em `globalThis`), `services/sseClient.ts` (arquivo inteiro), `env.example`, `README.md`
- Test: `tests/unit/dbErrors.test.ts`, `tests/unit/emailTemplates.test.ts`, `tests/unit/publicUrl.test.ts`, `tests/unit/sseClient.test.ts`

**Interfaces:**
- Produces:
  - `lib/emailTemplates.ts`: `escapeHtml(value: string): string`, `type EmailContent = { subject: string; html: string; text: string }`, `type EmailLayout = { subject; heading; paragraphs: string[]; action?: { label: string; url: string }; table?: { columns: string[]; rows: string[][] }; footnote?: string }`, `renderEmail(layout): EmailContent`, `buildPasswordResetEmail({ name, resetUrl, ttlMinutes }): EmailContent`
  - `lib/publicUrl.ts`: `getConfiguredPublicOrigin(override?: string): string | null`, `getRequestOrigin(req: Request): string`, `buildPublicUrl(req: Request, pathname: string, params: Record<string, string>, override?: string): string`
  - `services/sseClient.ts`: `connectSSE(onEvent)` com a mesma assinatura, mas compartilhando uma única `EventSource`; eventos nomeados incluem `incident.opened` e `incident.updated`

- [ ] **Step 1: Testes (falham)**

`tests/unit/dbErrors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mapDbError } from "@lib/dbErrors";

describe("mapDbError", () => {
  it("mapeia duplicidade sem expor a mensagem do banco", () => {
    const mapped = mapDbError({
      code: "ER_DUP_ENTRY",
      sqlMessage: "Duplicate entry 'ana@x.com' for key 'User_email_key'",
    });
    expect(mapped).toEqual({ status: 409, body: { ok: false, error: "UNIQUE_CONSTRAINT", field: "email" } });
  });

  it("erro desconhecido vira DB_ERROR genérico", () => {
    const mapped = mapDbError(new Error("connect ECONNREFUSED 10.0.0.5:3306"));
    expect(mapped).toEqual({ status: 500, body: { ok: false, error: "DB_ERROR" } });
    expect(JSON.stringify(mapped)).not.toContain("10.0.0.5");
  });
});
```

`tests/unit/emailTemplates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildPasswordResetEmail, escapeHtml, renderEmail } from "@lib/emailTemplates";

describe("escapeHtml", () => {
  it("escapa os caracteres especiais de HTML", () => {
    expect(escapeHtml(`<b>"Tom" & 'Ana'</b>`)).toBe("&lt;b&gt;&quot;Tom&quot; &amp; &#39;Ana&#39;&lt;/b&gt;");
  });
});

describe("renderEmail", () => {
  it("escapa textos, tabela e link", () => {
    const email = renderEmail({
      subject: "Assunto",
      heading: "<h1>",
      paragraphs: ["a < b"],
      table: { columns: ["AP"], rows: [["<script>"]] },
      action: { label: "Abrir", url: "https://x.test/?a=1&b=2" },
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain('href="https://x.test/?a=1&amp;b=2"');
    expect(email.text).toContain("https://x.test/?a=1&b=2");
    expect(email.text).toContain("- <script>");
  });
});

describe("buildPasswordResetEmail", () => {
  it("monta o e-mail de redefinição em PT-BR sem injetar o nome", () => {
    const email = buildPasswordResetEmail({
      name: "<img src=x>",
      resetUrl: "https://stats.test/reset-password?token=abc",
      ttlMinutes: 60,
    });
    expect(email.subject).toBe("Redefinição de senha");
    expect(email.html).not.toContain("<img");
    expect(email.text).toContain("Este link expira em 60 minutos.");
    expect(email.text).toContain("https://stats.test/reset-password?token=abc");
  });
});
```

`tests/unit/publicUrl.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { buildPublicUrl } from "@lib/publicUrl";

function request(headers: Record<string, string> = {}) {
  return new Request("http://0.0.0.0:3000/api/x", { headers });
}

describe("buildPublicUrl", () => {
  beforeEach(() => {
    delete process.env.APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.TRUST_PROXY_HEADERS;
  });

  it("usa o override quando informado", () => {
    process.env.APP_URL = "https://stats.exemplo.com";
    expect(buildPublicUrl(request(), "/reset-password", { token: "abc" }, "https://auth.exemplo.com/")).toBe(
      "https://auth.exemplo.com/reset-password?token=abc"
    );
  });

  it("usa APP_URL", () => {
    process.env.APP_URL = "https://stats.exemplo.com";
    expect(buildPublicUrl(request(), "/accept-invite", { token: "t" })).toBe(
      "https://stats.exemplo.com/accept-invite?token=t"
    );
  });

  it("ignora X-Forwarded-* sem TRUST_PROXY_HEADERS", () => {
    const req = request({ "x-forwarded-proto": "https", "x-forwarded-host": "evil.test", host: "stats.local:3200" });
    expect(buildPublicUrl(req, "/x", {})).toBe("http://stats.local:3200/x");
  });

  it("usa X-Forwarded-* com TRUST_PROXY_HEADERS=true", () => {
    process.env.TRUST_PROXY_HEADERS = "true";
    const req = request({ "x-forwarded-proto": "https", "x-forwarded-host": "stats.exemplo.com", host: "web:3000" });
    expect(buildPublicUrl(req, "/x", {})).toBe("https://stats.exemplo.com/x");
  });

  it("troca 0.0.0.0 por localhost", () => {
    expect(buildPublicUrl(request(), "/x", {})).toBe("http://localhost:3000/x");
  });
});
```

`tests/unit/sseClient.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  listeners = new Map<string, Array<(event: MessageEvent) => void>>();
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  dispatch(type: string, data: unknown) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(new MessageEvent(type, { data: JSON.stringify(data) }));
    }
  }

  close() {
    this.closed = true;
  }
}

describe("connectSSE", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("window", globalThis);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("compartilha uma única conexão entre componentes e fecha quando todos saem", async () => {
    const { connectSSE } = await import("@services/sseClient");
    const first = vi.fn();
    const second = vi.fn();

    const disconnectFirst = connectSSE(first);
    const disconnectSecond = connectSSE(second);
    expect(FakeEventSource.instances).toHaveLength(1);

    FakeEventSource.instances[0].dispatch("incident.opened", { id: 3 });
    expect(JSON.parse(first.mock.calls[0][0].data)).toEqual({ event: "incident.opened", id: 3 });
    expect(second).toHaveBeenCalledTimes(1);

    disconnectFirst();
    disconnectSecond();
    expect(FakeEventSource.instances[0].closed).toBe(false);
    vi.advanceTimersByTime(1_000);
    expect(FakeEventSource.instances[0].closed).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/unit/dbErrors.test.ts tests/unit/emailTemplates.test.ts tests/unit/publicUrl.test.ts tests/unit/sseClient.test.ts`
Expected: FAIL — módulos novos inexistentes, `dbErrors` ainda devolve `details`, `sseClient` cria uma conexão por chamada.

- [ ] **Step 3: Reescrever `lib/dbErrors.ts`**

```ts
type Mapped = { status: number; body: Record<string, any> };

function inferDuplicateField(message: string) {
  if (/email/i.test(message)) return "email";
  if (/gdmsApId/i.test(message)) return "gdmsApId";
  return "unique_field";
}

// A mensagem original do banco fica só no log do servidor; o cliente recebe um código.
export function mapDbError(error: unknown): Mapped {
  const err = error as { code?: string; message?: string; sqlMessage?: string };
  const message = String(err?.sqlMessage || err?.message || error);

  switch (err?.code) {
    case "ER_DUP_ENTRY":
      return {
        status: 409,
        body: { ok: false, error: "UNIQUE_CONSTRAINT", field: inferDuplicateField(message) },
      };
    case "ER_NO_REFERENCED_ROW_2":
    case "ER_ROW_IS_REFERENCED_2":
      return { status: 409, body: { ok: false, error: "FOREIGN_KEY_CONSTRAINT" } };
    case "ER_BAD_NULL_ERROR":
    case "ER_DATA_TOO_LONG":
    case "ER_TRUNCATED_WRONG_VALUE":
      return { status: 400, body: { ok: false, error: "DB_VALIDATION_ERROR" } };
    default:
      return { status: 500, body: { ok: false, error: "DB_ERROR" } };
  }
}
```

- [ ] **Step 4: Criar `lib/emailTemplates.ts`**

```ts
// Layout único dos e-mails. Todo texto recebido é tratado como texto puro e escapado no HTML.

const BRAND = "Stats A.P · Etheriumtech";

export type EmailContent = { subject: string; html: string; text: string };

export type EmailLayout = {
  subject: string;
  heading: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  table?: { columns: string[]; rows: string[][] };
  footnote?: string;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderEmail(layout: EmailLayout): EmailContent {
  const html: string[] = [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#0f172a;max-width:640px">',
    `<h2 style="margin:0 0 12px;font-size:18px">${escapeHtml(layout.heading)}</h2>`,
    ...layout.paragraphs.map((paragraph) => `<p style="margin:0 0 12px">${escapeHtml(paragraph)}</p>`),
  ];
  const text: string[] = [layout.heading, "", ...layout.paragraphs];

  if (layout.table && layout.table.rows.length) {
    const header = layout.table.columns
      .map((column) => `<th align="left" style="border-bottom:1px solid #cbd5e1">${escapeHtml(column)}</th>`)
      .join("");
    const rows = layout.table.rows
      .map(
        (row) =>
          `<tr>${row.map((cell) => `<td style="border-bottom:1px solid #e2e8f0">${escapeHtml(cell)}</td>`).join("")}</tr>`
      )
      .join("");
    html.push(
      `<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;margin:0 0 12px;width:100%"><tr>${header}</tr>${rows}</table>`
    );
    text.push("", ...layout.table.rows.map((row) => `- ${row.join(" | ")}`));
  }

  if (layout.action) {
    const url = escapeHtml(layout.action.url);
    html.push(
      `<p style="margin:16px 0"><a href="${url}" style="background:#047857;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">${escapeHtml(layout.action.label)}</a></p>`,
      `<p style="margin:0 0 12px;font-size:12px;color:#475569">Se o botão não funcionar, copie e cole este endereço no navegador: ${url}</p>`
    );
    text.push("", `${layout.action.label}: ${layout.action.url}`);
  }

  if (layout.footnote) {
    html.push(`<p style="margin:12px 0 0;font-size:12px;color:#475569">${escapeHtml(layout.footnote)}</p>`);
    text.push("", layout.footnote);
  }

  html.push(`<p style="margin:16px 0 0;font-size:12px;color:#94a3b8">${escapeHtml(BRAND)}</p>`, "</div>");
  text.push("", BRAND);

  return { subject: layout.subject, html: html.join(""), text: text.join("\n") };
}

export function buildPasswordResetEmail(input: { name: string; resetUrl: string; ttlMinutes: number }): EmailContent {
  return renderEmail({
    subject: "Redefinição de senha",
    heading: `Olá, ${input.name || "usuário"}`,
    paragraphs: ["Recebemos uma solicitação para redefinir a sua senha no Stats A.P."],
    action: { label: "Criar uma nova senha", url: input.resetUrl },
    footnote: `Este link expira em ${input.ttlMinutes} minutos. Se você não solicitou a alteração, ignore este e-mail.`,
  });
}
```

- [ ] **Step 5: Criar `lib/publicUrl.ts`**

```ts
// Origem pública usada nos links de e-mail. Nunca use APP_BASE_URL (é interna do Docker).

function normalizeOrigin(value?: string | null) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function toPublicOrigin(origin: string) {
  const url = new URL(origin);
  if (url.hostname === "0.0.0.0" || url.hostname === "::" || url.hostname === "[::]") {
    url.hostname = "localhost";
  }
  return url.origin;
}

export function getConfiguredPublicOrigin(override?: string): string | null {
  for (const candidate of [override, process.env.APP_URL, process.env.NEXT_PUBLIC_APP_URL]) {
    const normalized = normalizeOrigin(candidate?.trim());
    if (normalized) return toPublicOrigin(normalized);
  }
  return null;
}

export function getRequestOrigin(req: Request): string {
  const originHeader = normalizeOrigin(req.headers.get("origin"));
  if (originHeader) return toPublicOrigin(originHeader);

  const refererHeader = normalizeOrigin(req.headers.get("referer"));
  if (refererHeader) return toPublicOrigin(refererHeader);

  if (process.env.TRUST_PROXY_HEADERS === "true") {
    const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    if (forwardedProto && forwardedHost) {
      return toPublicOrigin(`${forwardedProto}://${forwardedHost}`);
    }
  }

  const requestUrl = new URL(req.url);
  const host = req.headers.get("host")?.trim();
  if (host) return toPublicOrigin(`${requestUrl.protocol}//${host}`);
  return toPublicOrigin(requestUrl.origin);
}

export function buildPublicUrl(
  req: Request,
  pathname: string,
  params: Record<string, string>,
  override?: string
): string {
  const base = getConfiguredPublicOrigin(override) ?? getRequestOrigin(req);
  const url = new URL(pathname, base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}
```

- [ ] **Step 6: Reescrever `lib/passwordReset.ts`**

```ts
import "server-only";

import crypto from "node:crypto";
import { buildPublicUrl } from "@lib/publicUrl";

export function getPasswordResetTokenTtlMinutes() {
  const raw = Number(process.env.PASSWORD_RESET_TOKEN_MINUTES ?? 60);
  return Number.isFinite(raw) && raw >= 15 && raw <= 24 * 60 ? Math.floor(raw) : 60;
}

export function hashPasswordResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createPasswordResetToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return {
    expiresAt: new Date(Date.now() + getPasswordResetTokenTtlMinutes() * 60_000),
    token,
    tokenHash: hashPasswordResetToken(token),
  };
}

export function buildPasswordResetUrl(req: Request, token: string) {
  return buildPublicUrl(req, "/reset-password", { token }, process.env.PASSWORD_RESET_BASE_URL);
}
```

- [ ] **Step 7: `app/api/auth/forgot-password/route.ts` — usar o template**

Adicione o import:

```ts
import { buildPasswordResetEmail } from "@lib/emailTemplates";
```

Troque o bloco `try { const ttlMinutes = ...; await sendMail({ ... }); } catch (emailError) {` por:

```ts
      try {
        await sendMail({
          to: user.email,
          ...buildPasswordResetEmail({
            name: user.name,
            resetUrl,
            ttlMinutes: getPasswordResetTokenTtlMinutes(),
          }),
        });
      } catch (emailError) {
```

- [ ] **Step 8: `lib/sse.ts` — registro de clientes em `globalThis`**

Troque as linhas:

```ts
let clientId = 0;
const clients = new Map<number, Client>();
const encoder = new TextEncoder();
```

por:

```ts
// Registro global: todas as rotas do processo (sync, PATCH, /api/events) enxergam os mesmos clientes.
type SseGlobal = typeof globalThis & { __sseClients?: Map<number, Client>; __sseClientSeq?: number };
const sseGlobal = globalThis as SseGlobal;
const clients = (sseGlobal.__sseClients ??= new Map<number, Client>());
const encoder = new TextEncoder();
```

e, em `addClient`, troque `const id = ++clientId;` por:

```ts
  const id = (sseGlobal.__sseClientSeq = (sseGlobal.__sseClientSeq ?? 0) + 1);
```

- [ ] **Step 9: Reescrever `services/sseClient.ts`**

```ts
// Uma única EventSource por aba, compartilhada por todos os componentes.
const NAMED_EVENTS = [
  "connected",
  "ping",
  "antenna.created",
  "antenna.updated",
  "antenna.deleted",
  "status.changed",
  "incident.opened",
  "incident.updated",
] as const;

const CLOSE_DELAY_MS = 1_000;

type Listener = (event: MessageEvent) => void;

const listeners = new Set<Listener>();
let source: EventSource | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;

function wrapEvent(event: MessageEvent, type: string) {
  let payload: unknown = event.data;

  try {
    payload = JSON.parse(event.data);
  } catch {}

  const data =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? { event: type, ...(payload as Record<string, unknown>) }
      : { event: type, data: payload };

  return new MessageEvent("message", {
    data: JSON.stringify(data),
  });
}

function broadcast(event: MessageEvent) {
  for (const listener of Array.from(listeners)) {
    try {
      listener(event);
    } catch {}
  }
}

function ensureSource() {
  if (source) return;
  source = new EventSource("/api/events");
  for (const type of NAMED_EVENTS) {
    source.addEventListener(type, (event) => broadcast(wrapEvent(event as MessageEvent, type)));
  }
  source.onmessage = (event) => broadcast(event);
  source.onerror = () => {};
}

export function connectSSE(onEvent: Listener) {
  if (typeof window === "undefined") return () => {};

  listeners.add(onEvent);
  if (closeTimer !== null) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  ensureSource();

  return () => {
    listeners.delete(onEvent);
    if (listeners.size > 0 || closeTimer !== null) return;

    // Espera um instante antes de fechar: trocar de página desmonta e remonta os componentes.
    closeTimer = setTimeout(() => {
      closeTimer = null;
      if (listeners.size === 0 && source) {
        source.close();
        source = null;
      }
    }, CLOSE_DELAY_MS);
  };
}
```

- [ ] **Step 10: `env.example` e README — recomendações de produção**

Em `env.example`, troque:

```
SEED_SUPERADMIN_ON_STARTUP="true"
SUPERADMIN_PROMOTE_IF_EXISTS="true"
SUPERADMIN_SYNC_PASSWORD_IF_EXISTS="false"
```

por:

```
# Em produção, deixe o seed desligado após o primeiro bootstrap.
# Com SUPERADMIN_SYNC_PASSWORD_IF_EXISTS=true a senha do superadmin volta à deste arquivo a cada restart.
SEED_SUPERADMIN_ON_STARTUP="false"
SUPERADMIN_PROMOTE_IF_EXISTS="false"
SUPERADMIN_SYNC_PASSWORD_IF_EXISTS="false"
```

No `README.md`, na tabela da seção `### Bootstrap administrativo`, acrescente a linha:

```
| `SUPERADMIN_SYNC_PASSWORD_IF_EXISTS` | Não | `false` | Com `true`, a senha do superadmin é sobrescrita pela do `.env` a cada restart (desfaz redefinições). Mantenha `false` em produção |
```

e, na seção `### Proxy e origem confiavel` (o título no README está sem acento), acrescente ao final da lista:

```
- Sem `TRUST_PROXY_HEADERS=true`, todos os acessos que chegam pelo proxy compartilham o mesmo IP ("unknown") nos limites por IP (login, recuperação de senha, convite). Atrás de um proxy confiável, habilite a variável.
```

- [ ] **Step 11: Testes, typecheck e lint**

Run: `npx vitest run && npx tsc --noEmit && npm run lint`
Expected: tudo PASS / sem erros.

- [ ] **Step 12: Commit**

```bash
git add lib/dbErrors.ts lib/emailTemplates.ts lib/publicUrl.ts lib/passwordReset.ts app/api/auth/forgot-password/route.ts lib/sse.ts services/sseClient.ts env.example README.md tests/unit/dbErrors.test.ts tests/unit/emailTemplates.test.ts tests/unit/publicUrl.test.ts tests/unit/sseClient.test.ts
git commit -m "fix(seguranca): ocultar SQL nos erros, escapar e-mails, URL pública confiável e SSE único por aba" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

# Fase B — Convite de usuário por e-mail

### Tarefa 8: Token de convite, papéis, e-mail de convite e tabela `UserInvite`

**Files:**
- Create: `lib/inviteToken.ts`
- Modify: `lib/roles.ts` (rótulos), `lib/emailTemplates.ts` (`buildInviteEmail`), `lib/dbMappers.ts` (exportar `toIso`), `db/schema.sql` (tabela nova)
- Test: `tests/unit/inviteToken.test.ts`, `tests/unit/emailTemplates.test.ts` (novo caso)

**Interfaces:**
- Consumes: `formatDateTimeBR` (Tarefa 5), `renderEmail` (Tarefa 7), `UserRole` (Tarefa 4).
- Produces:
  - `lib/inviteToken.ts`: `getInviteTtlHours(raw?: string): number`, `hashInviteToken(token: string): string`, `createInviteToken(now?: Date, ttlHours?: number): { token: string; tokenHash: string; expiresAt: Date }`, `type InviteState = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED"`, `getInviteState(invite: { acceptedAt: Date | string | null; revokedAt: Date | string | null; expiresAt: Date | string }, now?: Date): InviteState`
  - `lib/roles.ts`: `ROLE_OPTIONS: Array<{ value: UserRole; label: string; description: string }>`, `roleLabel(role: string): string`
  - `lib/emailTemplates.ts`: `buildInviteEmail({ acceptUrl, role, expiresAt, inviterName }): EmailContent`
  - `lib/dbMappers.ts`: `export function toIso(value: unknown): string | null`

- [ ] **Step 1: Testes (falham)**

`tests/unit/inviteToken.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createInviteToken, getInviteState, getInviteTtlHours, hashInviteToken } from "@lib/inviteToken";

describe("createInviteToken", () => {
  it("gera token de 64 hex, guarda só o hash e calcula a validade", () => {
    const now = new Date("2026-10-08T12:00:00Z");
    const invite = createInviteToken(now, 72);

    expect(invite.token).toMatch(/^[0-9a-f]{64}$/);
    expect(invite.tokenHash).toBe(hashInviteToken(invite.token));
    expect(invite.tokenHash).not.toBe(invite.token);
    expect(invite.expiresAt.toISOString()).toBe("2026-10-11T12:00:00.000Z");
  });

  it("gera tokens diferentes a cada chamada", () => {
    expect(createInviteToken().token).not.toBe(createInviteToken().token);
  });
});

describe("getInviteTtlHours", () => {
  it("usa 72 h como padrão e respeita a faixa de 1 a 336 h", () => {
    expect(getInviteTtlHours(undefined)).toBe(72);
    expect(getInviteTtlHours("24")).toBe(24);
    expect(getInviteTtlHours("0")).toBe(72);
    expect(getInviteTtlHours("400")).toBe(72);
    expect(getInviteTtlHours("abc")).toBe(72);
  });
});

describe("getInviteState", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  const future = "2026-10-09T12:00:00Z";
  const past = "2026-10-07T12:00:00Z";

  it("pendente quando não aceito, não revogado e dentro da validade", () => {
    expect(getInviteState({ acceptedAt: null, revokedAt: null, expiresAt: future }, now)).toBe("PENDING");
  });

  it("aceito tem prioridade sobre os outros estados (link reutilizado)", () => {
    expect(getInviteState({ acceptedAt: past, revokedAt: past, expiresAt: past }, now)).toBe("ACCEPTED");
  });

  it("revogado e expirado", () => {
    expect(getInviteState({ acceptedAt: null, revokedAt: past, expiresAt: future }, now)).toBe("REVOKED");
    expect(getInviteState({ acceptedAt: null, revokedAt: null, expiresAt: past }, now)).toBe("EXPIRED");
  });
});
```

Em `tests/unit/emailTemplates.test.ts`, troque o import por:

```ts
import { buildInviteEmail, buildPasswordResetEmail, escapeHtml, renderEmail } from "@lib/emailTemplates";
```

e adicione ao final do arquivo:

```ts
describe("buildInviteEmail", () => {
  it("informa quem convidou, o papel, a validade em horário de Brasília e o link", () => {
    const email = buildInviteEmail({
      acceptUrl: "https://stats.test/accept-invite?token=abc",
      role: "ADMIN",
      expiresAt: new Date("2026-10-11T15:00:00Z"),
      inviterName: "Jeferson",
    });

    expect(email.subject).toBe("Convite para acessar o Stats A.P");
    expect(email.text).toContain("Jeferson convidou você");
    expect(email.text).toContain("Perfil de acesso: Administrador.");
    expect(email.text).toMatch(/vale até 11\/10\/2026,? 12:00/);
    expect(email.text).toContain("https://stats.test/accept-invite?token=abc");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/unit/inviteToken.test.ts tests/unit/emailTemplates.test.ts`
Expected: FAIL — `@lib/inviteToken` inexistente; `buildInviteEmail` não exportado.

- [ ] **Step 3: Criar `lib/inviteToken.ts`**

```ts
import crypto from "node:crypto";

export type InviteState = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";

const DEFAULT_TTL_HOURS = 72;

export function getInviteTtlHours(raw = process.env.INVITE_TOKEN_HOURS): number {
  const value = Number(raw ?? DEFAULT_TTL_HOURS);
  return Number.isFinite(value) && value >= 1 && value <= 336 ? Math.floor(value) : DEFAULT_TTL_HOURS;
}

export function hashInviteToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createInviteToken(now = new Date(), ttlHours = getInviteTtlHours()) {
  const token = crypto.randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: hashInviteToken(token),
    expiresAt: new Date(now.getTime() + ttlHours * 3_600_000),
  };
}

function isSet(value: Date | string | null) {
  return value !== null && value !== "";
}

export function getInviteState(
  invite: { acceptedAt: Date | string | null; revokedAt: Date | string | null; expiresAt: Date | string },
  now = new Date()
): InviteState {
  if (isSet(invite.acceptedAt)) return "ACCEPTED";
  if (isSet(invite.revokedAt)) return "REVOKED";
  const expiresAt = invite.expiresAt instanceof Date ? invite.expiresAt : new Date(invite.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) return "EXPIRED";
  return "PENDING";
}
```

- [ ] **Step 4: `lib/roles.ts` — rótulos de papel**

Substitua o arquivo por:

```ts
import type { UserRole } from "@lib/jwt";

export const ROLE_OPTIONS: Array<{ value: UserRole; label: string; description: string }> = [
  { value: "USER", label: "Usuário", description: "Somente visualização" },
  { value: "ADMIN", label: "Administrador", description: "Gerencia APs, sincronização e ocorrências" },
  { value: "SUPERADMIN", label: "Superadministrador", description: "Acesso total, inclusive usuários" },
];

export function normalizeRole(raw: unknown): UserRole {
  return raw === "SUPERADMIN" || raw === "ADMIN" ? raw : "USER";
}

export function roleLabel(role: string): string {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}
```

- [ ] **Step 5: `lib/emailTemplates.ts` — e-mail de convite**

No topo do arquivo, adicione os imports:

```ts
import { formatDateTimeBR } from "@lib/dateFormat";
import { roleLabel } from "@lib/roles";
```

Ao final do arquivo, adicione:

```ts
export function buildInviteEmail(input: {
  acceptUrl: string;
  role: string;
  expiresAt: Date;
  inviterName: string;
}): EmailContent {
  return renderEmail({
    subject: "Convite para acessar o Stats A.P",
    heading: "Você foi convidado",
    paragraphs: [
      `${input.inviterName || "Um administrador"} convidou você para acessar o Stats A.P, a plataforma de monitoramento dos APs da Etheriumtech.`,
      `Perfil de acesso: ${roleLabel(input.role)}.`,
      `O link é pessoal, pode ser usado uma única vez e vale até ${formatDateTimeBR(input.expiresAt)} (horário de Brasília).`,
    ],
    action: { label: "Criar meu acesso", url: input.acceptUrl },
    footnote: "Se você não esperava este convite, ignore este e-mail.",
  });
}
```

- [ ] **Step 6: `lib/dbMappers.ts` — exportar `toIso`**

Troque `function toIso(value: unknown) {` por `export function toIso(value: unknown): string | null {`.

- [ ] **Step 7: `db/schema.sql` — tabela `UserInvite`**

Ao final do arquivo, adicione:

```sql

CREATE TABLE IF NOT EXISTS `UserInvite` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(200) NOT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'USER',
  `tokenHash` CHAR(64) NOT NULL,
  `invitedById` INT NULL,
  `expiresAt` DATETIME NOT NULL,
  `acceptedAt` DATETIME NULL,
  `revokedAt` DATETIME NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UserInvite_tokenHash_key` (`tokenHash`),
  KEY `UserInvite_email_idx` (`email`),
  CONSTRAINT `UserInvite_invitedById_fkey`
    FOREIGN KEY (`invitedById`) REFERENCES `User` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 8: Rodar testes e typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: tudo PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/inviteToken.ts lib/roles.ts lib/emailTemplates.ts lib/dbMappers.ts db/schema.sql tests/unit/inviteToken.test.ts tests/unit/emailTemplates.test.ts
git commit -m "feat(convite): token de convite, rótulos de papel, e-mail e tabela UserInvite" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Tarefa 9: API de convites (admin) e aceite público

**Files:**
- Create: `lib/invites.ts`, `app/api/users/invites/route.ts`, `app/api/users/invites/[id]/route.ts`, `app/api/users/invites/[id]/resend/route.ts`, `app/api/auth/invite/route.ts`, `app/api/auth/accept-invite/route.ts`
- Modify: `app/api/users/route.ts` (remove `POST`), `env.example`
- Test: `tests/unit/invites.test.ts`

**Interfaces:**
- Consumes: `createInviteToken`, `hashInviteToken`, `getInviteState` (Tarefa 8), `buildInviteEmail` (Tarefa 8), `buildPublicUrl` (Tarefa 7), `requireRequestAuth`, `setAuthCookies`, `signAuthToken`, `requireTrustedOrigin` (Tarefa 4), `normalizeRole` (Tarefa 4).
- Produces:
  - `lib/invites.ts`: `type InviteRow`, `type InviteItem = { id: number; email: string; role: string; invitedByName: string | null; expiresAt: string | null; createdAt: string | null; state: InviteState }`, `mapInviteRow(row, now?): InviteItem`, `sendInviteEmail(req, { email, role, token, expiresAt, inviterName }): Promise<void>`
  - Rotas (contrato da UI na Tarefa 10):
    - `GET /api/users/invites` → `{ ok: true, items: InviteItem[] }`
    - `POST /api/users/invites` `{ email, role }` → `201 { ok: true, item }` | `409 EMAIL_TAKEN` | `502 { ok: false, error: "INVITE_EMAIL_FAILED", item }`
    - `POST /api/users/invites/[id]/resend` → `{ ok: true, item }` | `404 INVITE_NOT_FOUND` | `409 INVITE_NOT_PENDING` | `409 EMAIL_TAKEN` | `502 INVITE_EMAIL_FAILED`
    - `DELETE /api/users/invites/[id]` → `{ ok: true }` | `404 INVITE_NOT_FOUND` | `409 INVITE_NOT_PENDING`
    - `GET /api/auth/invite?token=` → `{ ok: true, email, role, expiresAt }` | `400 INVALID_INVITE`
    - `POST /api/auth/accept-invite` `{ token, name, password }` → `{ ok: true, user }` + cookies | `400 INVALID_INVITE` | `409 EMAIL_TAKEN` | `400 VALIDATION_FAILED`

- [ ] **Step 1: Teste do mapeamento (falha)**

`tests/unit/invites.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@lib/email", () => ({ sendMail: vi.fn(async () => undefined) }));

import { sendMail } from "@lib/email";
import { mapInviteRow, sendInviteEmail } from "@lib/invites";

describe("mapInviteRow", () => {
  it("converte a linha do banco no item da API com o estado calculado", () => {
    const item = mapInviteRow(
      {
        id: 4,
        email: "novo@exemplo.com",
        role: "USER",
        tokenHash: "x".repeat(64),
        invitedById: 1,
        invitedByName: "Root",
        expiresAt: new Date("2026-10-11T12:00:00Z"),
        acceptedAt: null,
        revokedAt: null,
        createdAt: new Date("2026-10-08T12:00:00Z"),
      } as never,
      new Date("2026-10-08T13:00:00Z")
    );

    expect(item).toEqual({
      id: 4,
      email: "novo@exemplo.com",
      role: "USER",
      invitedByName: "Root",
      expiresAt: "2026-10-11T12:00:00.000Z",
      createdAt: "2026-10-08T12:00:00.000Z",
      state: "PENDING",
    });
    expect(item).not.toHaveProperty("tokenHash");
  });
});

describe("sendInviteEmail", () => {
  it("envia o link público /accept-invite com o token", async () => {
    process.env.APP_URL = "https://stats.exemplo.com";

    await sendInviteEmail(new Request("http://web:3000/api/users/invites"), {
      email: "novo@exemplo.com",
      role: "ADMIN",
      token: "abc123",
      expiresAt: new Date("2026-10-11T12:00:00Z"),
      inviterName: "Root",
    });

    const payload = vi.mocked(sendMail).mock.calls[0][0];
    expect(payload.to).toBe("novo@exemplo.com");
    expect(payload.text).toContain("https://stats.exemplo.com/accept-invite?token=abc123");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/unit/invites.test.ts`
Expected: FAIL — `@lib/invites` inexistente.

- [ ] **Step 3: Criar `lib/invites.ts`**

```ts
import "server-only";

import type { RowDataPacket } from "mysql2/promise";
import { toIso } from "@lib/dbMappers";
import { sendMail } from "@lib/email";
import { buildInviteEmail } from "@lib/emailTemplates";
import { getInviteState, type InviteState } from "@lib/inviteToken";
import { buildPublicUrl } from "@lib/publicUrl";

export type InviteRow = RowDataPacket & {
  id: number;
  email: string;
  role: string;
  tokenHash: string;
  invitedById: number | null;
  invitedByName?: string | null;
  expiresAt: Date | string;
  acceptedAt: Date | string | null;
  revokedAt: Date | string | null;
  createdAt: Date | string;
};

export type InviteItem = {
  id: number;
  email: string;
  role: string;
  invitedByName: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  state: InviteState;
};

export const INVITE_SELECT =
  "SELECT i.`id`, i.`email`, i.`role`, i.`tokenHash`, i.`invitedById`, u.`name` AS `invitedByName`, i.`expiresAt`, i.`acceptedAt`, i.`revokedAt`, i.`createdAt` FROM `UserInvite` i LEFT JOIN `User` u ON u.`id` = i.`invitedById`";

export function mapInviteRow(row: InviteRow, now = new Date()): InviteItem {
  return {
    id: Number(row.id),
    email: row.email,
    role: row.role,
    invitedByName: row.invitedByName ?? null,
    expiresAt: toIso(row.expiresAt),
    createdAt: toIso(row.createdAt),
    state: getInviteState(row, now),
  };
}

export async function sendInviteEmail(
  req: Request,
  input: { email: string; role: string; token: string; expiresAt: Date; inviterName: string }
) {
  const acceptUrl = buildPublicUrl(req, "/accept-invite", { token: input.token });
  await sendMail({
    to: input.email,
    ...buildInviteEmail({
      acceptUrl,
      role: input.role,
      expiresAt: input.expiresAt,
      inviterName: input.inviterName,
    }),
  });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/unit/invites.test.ts`
Expected: PASS.

- [ ] **Step 5: `app/api/users/invites/route.ts`**

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { RowDataPacket } from "mysql2/promise";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRequestAuth } from "@lib/auth";
import { createInviteToken } from "@lib/inviteToken";
import { INVITE_SELECT, mapInviteRow, sendInviteEmail, type InviteRow } from "@lib/invites";
import { dbExecute, dbQuery, dbQueryOne, withTransaction } from "@lib/mysql";
import { checkRateLimit, rateLimitResponse } from "@lib/rateLimit";

const createInviteSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Informe um e-mail válido.")
    .max(200, "O e-mail pode ter no máximo 200 caracteres.")
    .transform((value) => value.toLowerCase()),
  role: z.enum(["USER", "ADMIN", "SUPERADMIN"]).default("USER"),
});

type IdRow = RowDataPacket & { id: number };

export async function GET(req: Request) {
  try {
    const auth = await requireRequestAuth(req, ["SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    const now = new Date();
    const rows = await dbQuery<InviteRow>(
      `${INVITE_SELECT} WHERE i.\`acceptedAt\` IS NULL AND i.\`revokedAt\` IS NULL AND i.\`expiresAt\` > ? ORDER BY i.\`createdAt\` DESC`,
      [now]
    );

    return NextResponse.json({ ok: true, items: rows.map((row) => mapInviteRow(row, now)) });
  } catch (e) {
    console.error("GET /api/users/invites error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireRequestAuth(req, ["SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    const rateLimit = checkRateLimit(req, "admin-invite-user", {
      max: 20,
      windowMs: 60 * 60_000,
      key: auth.user.sub,
    });
    if (!rateLimit.ok) return rateLimitResponse(rateLimit);

    const parsed = createInviteSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_FAILED", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { email, role } = parsed.data;
    const existingUser = await dbQueryOne<IdRow>("SELECT `id` FROM `User` WHERE `email` = ? LIMIT 1", [email]);
    if (existingUser) {
      return NextResponse.json({ ok: false, error: "EMAIL_TAKEN" }, { status: 409 });
    }

    const now = new Date();
    const { token, tokenHash, expiresAt } = createInviteToken(now);

    // Um convite pendente por e-mail: o novo substitui o anterior.
    const inviteId = await withTransaction(async (connection) => {
      await dbExecute(
        "UPDATE `UserInvite` SET `revokedAt` = ? WHERE `email` = ? AND `acceptedAt` IS NULL AND `revokedAt` IS NULL",
        [now, email],
        connection
      );
      const result = await dbExecute(
        "INSERT INTO `UserInvite` (`email`, `role`, `tokenHash`, `invitedById`, `expiresAt`, `createdAt`) VALUES (?, ?, ?, ?, ?, ?)",
        [email, role, tokenHash, Number(auth.user.sub), expiresAt, now],
        connection
      );
      return result.insertId;
    });

    const row = await dbQueryOne<InviteRow>(`${INVITE_SELECT} WHERE i.\`id\` = ? LIMIT 1`, [inviteId]);
    const item = row ? mapInviteRow(row, now) : null;

    try {
      await sendInviteEmail(req, { email, role, token, expiresAt, inviterName: auth.user.name });
    } catch (emailError) {
      console.error("POST /api/users/invites sendMail error:", emailError);
      return NextResponse.json({ ok: false, error: "INVITE_EMAIL_FAILED", item }, { status: 502 });
    }

    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (e) {
    console.error("POST /api/users/invites error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
```

- [ ] **Step 6: `app/api/users/invites/[id]/route.ts` (revogar)**

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRequestAuth } from "@lib/auth";
import { getInviteState } from "@lib/inviteToken";
import { INVITE_SELECT, type InviteRow } from "@lib/invites";
import { dbExecute, dbQueryOne } from "@lib/mysql";

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRequestAuth(req, ["SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    const parsed = paramsSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "INVITE_NOT_FOUND" }, { status: 404 });
    }

    const row = await dbQueryOne<InviteRow>(`${INVITE_SELECT} WHERE i.\`id\` = ? LIMIT 1`, [parsed.data.id]);
    if (!row) return NextResponse.json({ ok: false, error: "INVITE_NOT_FOUND" }, { status: 404 });
    if (getInviteState(row) !== "PENDING") {
      return NextResponse.json({ ok: false, error: "INVITE_NOT_PENDING" }, { status: 409 });
    }

    await dbExecute("UPDATE `UserInvite` SET `revokedAt` = ? WHERE `id` = ?", [new Date(), parsed.data.id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/users/invites/[id] error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
```

- [ ] **Step 7: `app/api/users/invites/[id]/resend/route.ts`**

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { RowDataPacket } from "mysql2/promise";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRequestAuth } from "@lib/auth";
import { createInviteToken, getInviteState } from "@lib/inviteToken";
import { INVITE_SELECT, mapInviteRow, sendInviteEmail, type InviteRow } from "@lib/invites";
import { dbExecute, dbQueryOne } from "@lib/mysql";
import { checkRateLimit, rateLimitResponse } from "@lib/rateLimit";

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

type IdRow = RowDataPacket & { id: number };

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRequestAuth(req, ["SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    const rateLimit = checkRateLimit(req, "admin-invite-user", {
      max: 20,
      windowMs: 60 * 60_000,
      key: auth.user.sub,
    });
    if (!rateLimit.ok) return rateLimitResponse(rateLimit);

    const parsed = paramsSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "INVITE_NOT_FOUND" }, { status: 404 });
    }

    const row = await dbQueryOne<InviteRow>(`${INVITE_SELECT} WHERE i.\`id\` = ? LIMIT 1`, [parsed.data.id]);
    if (!row) return NextResponse.json({ ok: false, error: "INVITE_NOT_FOUND" }, { status: 404 });

    // Convite expirado pode ser reenviado (ganha nova validade); aceito ou revogado, não.
    const state = getInviteState(row);
    if (state === "ACCEPTED" || state === "REVOKED") {
      return NextResponse.json({ ok: false, error: "INVITE_NOT_PENDING" }, { status: 409 });
    }

    const existingUser = await dbQueryOne<IdRow>("SELECT `id` FROM `User` WHERE `email` = ? LIMIT 1", [row.email]);
    if (existingUser) {
      return NextResponse.json({ ok: false, error: "EMAIL_TAKEN" }, { status: 409 });
    }

    const now = new Date();
    const { token, tokenHash, expiresAt } = createInviteToken(now);
    await dbExecute("UPDATE `UserInvite` SET `tokenHash` = ?, `expiresAt` = ? WHERE `id` = ?", [
      tokenHash,
      expiresAt,
      row.id,
    ]);

    const item = mapInviteRow({ ...row, tokenHash, expiresAt } as InviteRow, now);

    try {
      await sendInviteEmail(req, { email: row.email, role: row.role, token, expiresAt, inviterName: auth.user.name });
    } catch (emailError) {
      console.error("POST /api/users/invites/[id]/resend sendMail error:", emailError);
      return NextResponse.json({ ok: false, error: "INVITE_EMAIL_FAILED", item }, { status: 502 });
    }

    return NextResponse.json({ ok: true, item });
  } catch (e) {
    console.error("POST /api/users/invites/[id]/resend error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
```

- [ ] **Step 8: `app/api/auth/invite/route.ts` (validação pública)**

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { toIso } from "@lib/dbMappers";
import { getInviteState, hashInviteToken } from "@lib/inviteToken";
import type { InviteRow } from "@lib/invites";
import { dbQueryOne } from "@lib/mysql";
import { checkRateLimit, rateLimitResponse } from "@lib/rateLimit";

function invalidInvite() {
  return NextResponse.json({ ok: false, error: "INVALID_INVITE" }, { status: 400 });
}

export async function GET(req: Request) {
  try {
    const rateLimit = checkRateLimit(req, "auth-invite-check", { max: 30, windowMs: 10 * 60_000 });
    if (!rateLimit.ok) return rateLimitResponse(rateLimit);

    const token = new URL(req.url).searchParams.get("token")?.trim() ?? "";
    if (token.length < 32 || token.length > 256) return invalidInvite();

    const row = await dbQueryOne<InviteRow>(
      "SELECT `id`, `email`, `role`, `expiresAt`, `acceptedAt`, `revokedAt` FROM `UserInvite` WHERE `tokenHash` = ? LIMIT 1",
      [hashInviteToken(token)]
    );
    if (!row || getInviteState(row) !== "PENDING") return invalidInvite();

    return NextResponse.json({ ok: true, email: row.email, role: row.role, expiresAt: toIso(row.expiresAt) });
  } catch (e) {
    console.error("GET /api/auth/invite error:", e);
    return NextResponse.json({ ok: false, error: "UNEXPECTED_ERROR" }, { status: 500 });
  }
}
```

- [ ] **Step 9: `app/api/auth/accept-invite/route.ts`**

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import bcrypt from "bcryptjs";
import type { RowDataPacket } from "mysql2/promise";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTrustedOrigin, setAuthCookies, signAuthToken } from "@lib/auth";
import { getInviteState, hashInviteToken } from "@lib/inviteToken";
import type { InviteRow } from "@lib/invites";
import { dbExecute, dbQueryOne, withTransaction } from "@lib/mysql";
import { checkRateLimit, rateLimitResponse } from "@lib/rateLimit";
import { normalizeRole } from "@lib/roles";
import { strongPasswordSchema } from "@lib/validatorsAuth";

const acceptInviteSchema = z.object({
  token: z.string().trim().min(32).max(256),
  name: z
    .string()
    .trim()
    .min(2, "Informe seu nome (mínimo de 2 caracteres).")
    .max(100, "O nome pode ter no máximo 100 caracteres."),
  password: strongPasswordSchema,
});

type IdRow = RowDataPacket & { id: number };

export async function POST(req: Request) {
  try {
    const originError = requireTrustedOrigin(req);
    if (originError) return originError;

    const rateLimit = checkRateLimit(req, "auth-accept-invite-ip", { max: 20, windowMs: 60 * 60_000 });
    if (!rateLimit.ok) return rateLimitResponse(rateLimit);

    const parsed = acceptInviteSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_FAILED", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { token, name, password } = parsed.data;
    const tokenHash = hashInviteToken(token);
    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();

    // FOR UPDATE: dois aceites simultâneos do mesmo link não criam dois usuários.
    const outcome = await withTransaction(async (connection) => {
      const invite = await dbQueryOne<InviteRow>(
        "SELECT `id`, `email`, `role`, `expiresAt`, `acceptedAt`, `revokedAt` FROM `UserInvite` WHERE `tokenHash` = ? LIMIT 1 FOR UPDATE",
        [tokenHash],
        connection
      );
      if (!invite || getInviteState(invite, now) !== "PENDING") return { error: "INVALID_INVITE" as const };

      const taken = await dbQueryOne<IdRow>(
        "SELECT `id` FROM `User` WHERE `email` = ? LIMIT 1",
        [invite.email],
        connection
      );
      if (taken) return { error: "EMAIL_TAKEN" as const };

      const role = normalizeRole(invite.role);
      const result = await dbExecute(
        "INSERT INTO `User` (`name`, `email`, `passwordHash`, `role`, `isBlocked`, `suspendedUntil`, `createdAt`) VALUES (?, ?, ?, ?, 0, NULL, ?)",
        [name, invite.email, passwordHash, role, now],
        connection
      );
      await dbExecute("UPDATE `UserInvite` SET `acceptedAt` = ? WHERE `id` = ?", [now, invite.id], connection);

      return { user: { id: result.insertId, name, email: invite.email, role } };
    });

    if ("error" in outcome) {
      const status = outcome.error === "EMAIL_TAKEN" ? 409 : 400;
      return NextResponse.json({ ok: false, error: outcome.error }, { status });
    }

    const authToken = await signAuthToken({
      sub: String(outcome.user.id),
      email: outcome.user.email,
      name: outcome.user.name,
      role: outcome.user.role,
    });
    setAuthCookies(cookies(), authToken);

    return NextResponse.json({ ok: true, user: outcome.user });
  } catch (e) {
    console.error("POST /api/auth/accept-invite error:", e);
    return NextResponse.json({ ok: false, error: "UNEXPECTED_ERROR" }, { status: 500 });
  }
}
```

- [ ] **Step 10: `app/api/users/route.ts` — remover a criação com senha**

Substitua o arquivo inteiro por (mantém só a listagem):

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { RowDataPacket } from "mysql2/promise";
import { NextResponse } from "next/server";
import { requireRequestAuth } from "@lib/auth";
import { mapUserRow } from "@lib/dbMappers";
import { dbQuery } from "@lib/mysql";

type UserRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: Date | string;
  isBlocked: number | boolean;
  suspendedUntil: Date | string | null;
};

// A criação de usuários passou a ser só por convite (POST /api/users/invites).
export async function GET(req: Request) {
  try {
    const auth = await requireRequestAuth(req, ["SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    const raw = await dbQuery<UserRow>(
      "SELECT `id`, `name`, `email`, `role`, `createdAt`, `isBlocked`, `suspendedUntil` FROM `User` ORDER BY `id` ASC"
    );

    return NextResponse.json({ ok: true, total: raw.length, items: raw.map(mapUserRow) });
  } catch (e) {
    console.error("GET /api/users error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
```

- [ ] **Step 11: `env.example` — validade do convite**

Logo após a linha `PASSWORD_RESET_TOKEN_MINUTES="60"`, adicione:

```
INVITE_TOKEN_HOURS="72"
```

- [ ] **Step 12: Testes, typecheck, lint e build**

Run: `npx vitest run && npx tsc --noEmit && npm run lint && npm run build`
Expected: tudo PASS; o build lista `/api/users/invites`, `/api/auth/invite` e `/api/auth/accept-invite`.

- [ ] **Step 13: Commit**

```bash
git add lib/invites.ts tests/unit/invites.test.ts app/api/users/invites app/api/auth/invite app/api/auth/accept-invite app/api/users/route.ts env.example
git commit -m "feat(convite): API de convites (criar, reenviar, revogar) e aceite público" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Tarefa 10: Página de aceite e Painel Administrador com convites

**Files:**
- Create: `app/(auth)/accept-invite/page.tsx`
- Modify: `middleware.ts` (rota pública), `app/(app)/admin/page.tsx` (arquivo inteiro)

**Interfaces:**
- Consumes: rotas da Tarefa 9; `ROLE_OPTIONS`, `roleLabel` (Tarefa 8); `api`, `ApiError` (Tarefa 4); `formatDateTimeBR` (Tarefa 5); `PASSWORD_POLICY_HINT` (`lib/validatorsAuth.ts`).

- [ ] **Step 1: `middleware.ts` — liberar `/accept-invite`**

Troque:

```ts
const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"];
```

por:

```ts
const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/accept-invite"];
// Páginas públicas que redirecionam quem já está logado para o início.
const GUEST_ONLY_PATHS = ["/login", "/forgot-password", "/reset-password"];
```

e troque `if (PUBLIC_PATHS.includes(pathname) && token) {` por:

```ts
    if (GUEST_ONLY_PATHS.includes(pathname) && token) {
```

(Assim o convidado consegue abrir o link mesmo se o navegador tiver outra sessão.)

- [ ] **Step 2: Criar `app/(auth)/accept-invite/page.tsx`**

```tsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { faKey, faTowerBroadcast, faUser } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import AuthInput from "@components/AuthInput";
import AuthParticles from "@components/AuthParticles";
import PasswordInput from "@components/PasswordInput";
import { formatDateTimeBR } from "@lib/dateFormat";
import { roleLabel } from "@lib/roles";
import { PASSWORD_POLICY_HINT } from "@lib/validatorsAuth";
import { buildApiHeaders } from "@services/api";

type InviteInfo = { email: string; role: string; expiresAt: string | null };
type Feedback = { kind: "error" | "success"; message: string } | null;

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() || "", [searchParams]);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    let alive = true;
    if (!token) {
      setInvalid(true);
      return;
    }

    (async () => {
      try {
        const response = await fetch(`/api/auth/invite?token=${encodeURIComponent(token)}`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!alive) return;
        if (response.ok && payload?.ok) {
          setInvite({ email: payload.email, role: payload.role, expiresAt: payload.expiresAt ?? null });
        } else {
          setInvalid(true);
        }
      } catch {
        if (alive) setInvalid(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, [token]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !invite) return;

    if (password !== confirmPassword) {
      setFeedback({ kind: "error", message: "As senhas informadas não coincidem." });
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/auth/accept-invite", {
        body: JSON.stringify({ token, name, password }),
        headers: buildApiHeaders(undefined, "POST"),
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const detail = payload?.details?.[0]?.message;
        setFeedback({
          kind: "error",
          message:
            (typeof detail === "string" && detail) ||
            (payload?.error === "INVALID_INVITE"
              ? "Este convite é inválido, já foi usado ou expirou. Peça um novo convite ao administrador."
              : payload?.error === "EMAIL_TAKEN"
                ? "Já existe uma conta com este e-mail. Use “Esqueceu a senha?” na tela de login."
                : "Não foi possível criar o acesso agora."),
        });
        if (payload?.error === "INVALID_INVITE") setInvalid(true);
        return;
      }

      setFeedback({ kind: "success", message: "Acesso criado. Entrando..." });
      router.replace("/");
    } catch {
      setFeedback({ kind: "error", message: "Não foi possível criar o acesso agora." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass rounded-b-3xl px-6 py-8 sm:px-10">
      {invalid ? (
        <div className="space-y-4 text-center text-sm">
          <p>Este convite é inválido, já foi usado ou expirou.</p>
          <p className="text-muted">Peça um novo convite ao administrador do Stats A.P.</p>
          <Link href="/login" className="inline-block underline underline-offset-4">
            Ir para o login
          </Link>
        </div>
      ) : !invite ? (
        <p className="text-center text-sm text-muted">Validando convite...</p>
      ) : (
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="surface-soft rounded-xl px-3 py-2 text-xs text-muted">
            <div>
              E-mail: <strong>{invite.email}</strong>
            </div>
            <div>Perfil de acesso: {roleLabel(invite.role)}</div>
            {invite.expiresAt ? <div>Convite válido até {formatDateTimeBR(invite.expiresAt)}</div> : null}
          </div>

          <AuthInput icon={faUser} placeholder="Seu nome" value={name} onChange={setName} autoComplete="name" />

          <div className="surface-soft rounded-xl px-3 py-2 text-xs text-muted">
            <div className="mb-1 flex items-center gap-2 font-medium">
              <FontAwesomeIcon icon={faKey} className="h-3.5 w-3.5" />
              Política de senha
            </div>
            <div>{PASSWORD_POLICY_HINT}</div>
          </div>

          <PasswordInput autoComplete="new-password" placeholder="Senha" value={password} onChange={setPassword} />
          <PasswordInput
            autoComplete="new-password"
            placeholder="Confirmar senha"
            value={confirmPassword}
            onChange={setConfirmPassword}
          />

          {feedback && (
            <div
              role="status"
              className={`rounded-xl border p-3 text-xs ${
                feedback.kind === "error"
                  ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {feedback.message}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn-shine h-11 w-full rounded-xl bg-slate-950 text-white shadow-soft transition hover:bg-slate-800 active:scale-[.995] disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
          >
            {busy ? "Criando acesso..." : "Criar meu acesso"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="relative isolate flex min-h-[100dvh] items-center justify-center px-4 py-8">
      <div className="absolute inset-0 -z-10">
        <AuthParticles />
      </div>

      <motion.div
        className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl shadow-[0_10px_45px_-18px_rgba(16,185,129,0.5)] ring-1 ring-white/10"
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 160, damping: 18 }}
      >
        <div className="relative bg-gradient-to-b from-emerald-300/90 via-emerald-400/80 to-emerald-500/60 px-6 py-7 backdrop-blur sm:px-10">
          <div className="flex flex-col items-center gap-4 text-center text-muted">
            <div className="surface-soft inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium">
              <FontAwesomeIcon icon={faTowerBroadcast} className="h-4 w-4" />
              Convite de acesso
            </div>
            <p className="text-sm">Crie sua senha para começar a usar o Stats A.P.</p>
          </div>
        </div>

        <Suspense fallback={<div className="glass rounded-b-3xl px-6 py-8 text-center text-sm">Carregando...</div>}>
          <AcceptInviteForm />
        </Suspense>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 3: Reescrever `app/(app)/admin/page.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDateTimeBR } from "@lib/dateFormat";
import { ROLE_OPTIONS, roleLabel } from "@lib/roles";
import { api, ApiError } from "@services/api";

type UserRole = "SUPERADMIN" | "ADMIN" | "USER";
type UserStatus = "ACTIVE" | "BLOCKED" | "SUSPENDED";

type User = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  isBlocked: boolean;
  suspendedUntil: string | null;
  createdAt: string;
};

type Invite = {
  id: number;
  email: string;
  role: UserRole;
  invitedByName: string | null;
  expiresAt: string | null;
  createdAt: string | null;
};

type Feedback = { kind: "error" | "success"; message: string } | null;

const EMPTY_INVITE = { email: "", role: "USER" as UserRole };

function describeError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const detail = error.payload?.details?.[0]?.message;
    if (typeof detail === "string" && detail.trim()) return detail;

    switch (error.code) {
      case "EMAIL_TAKEN":
        return "Já existe um usuário com este e-mail.";
      case "INVITE_EMAIL_FAILED":
        return "O convite foi criado, mas o e-mail não pôde ser enviado. Use “Reenviar” em instantes.";
      case "INVITE_NOT_FOUND":
        return "Convite não encontrado.";
      case "INVITE_NOT_PENDING":
        return "Este convite não está mais pendente.";
      case "CANNOT_MUTATE_SELF":
        return "Não é permitido bloquear ou suspender o próprio usuário.";
      case "CANNOT_DELETE_SELF":
        return "Não é permitido excluir o próprio usuário.";
      case "LAST_ACTIVE_SUPERADMIN":
        return "É preciso manter ao menos um superadministrador ativo.";
      case "USER_NOT_FOUND":
        return "Usuário não encontrado.";
      case "FORBIDDEN":
        return "Apenas superadministradores podem administrar usuários.";
      case "RATE_LIMITED":
        return "Muitas solicitações em sequência. Aguarde alguns minutos.";
      default:
        break;
    }
  }
  return fallback;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDateTimeLocalValue(date: Date) {
  return (
    [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join("-") +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function getDefaultSuspensionValue() {
  return toDateTimeLocalValue(new Date(Date.now() + 24 * 60 * 60_000));
}

function getStatusBadge(user: User) {
  if (user.status === "BLOCKED") {
    return { className: "bg-rose-500/15 text-rose-700 dark:text-rose-300", label: "Bloqueado" };
  }
  if (user.status === "SUSPENDED") {
    return { className: "bg-amber-500/15 text-amber-700 dark:text-amber-300", label: "Suspenso" };
  }
  return { className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", label: "Ativo" };
}

const STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: "ativo",
  BLOCKED: "bloqueado",
  SUSPENDED: "suspenso",
};

export default function AdminPage() {
  const [items, setItems] = useState<User[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [suspendDrafts, setSuspendDrafts] = useState<Record<number, string>>({});
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE);

  const load = useCallback(async () => {
    try {
      const [users, pending] = await Promise.all([
        api<{ items: User[] }>("/api/users"),
        api<{ items: Invite[] }>("/api/users/invites"),
      ]);
      setItems(users.items ?? []);
      setInvites(pending.items ?? []);
    } catch (error) {
      setFeedback({ kind: "error", message: describeError(error, "Não foi possível carregar os usuários.") });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return items.filter((user) =>
      [user.name, user.email, user.role, roleLabel(user.role), STATUS_LABELS[user.status]]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [items, q]);

  async function sendInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setFeedback(null);
    try {
      await api("/api/users/invites", { method: "POST", body: JSON.stringify(inviteForm) });
      setFeedback({ kind: "success", message: `Convite enviado para ${inviteForm.email}.` });
      setInviteForm(EMPTY_INVITE);
    } catch (error) {
      setFeedback({ kind: "error", message: describeError(error, "Não foi possível enviar o convite.") });
    } finally {
      setBusy(false);
      await load();
    }
  }

  async function runRowAction(key: string, action: () => Promise<unknown>, success: string, fallback: string) {
    setRowBusyId(key);
    setFeedback(null);
    try {
      await action();
      setFeedback({ kind: "success", message: success });
    } catch (error) {
      setFeedback({ kind: "error", message: describeError(error, fallback) });
    } finally {
      setRowBusyId(null);
      await load();
    }
  }

  function resendInvite(invite: Invite) {
    return runRowAction(
      `invite-${invite.id}`,
      () => api(`/api/users/invites/${invite.id}/resend`, { method: "POST" }),
      `Convite reenviado para ${invite.email}.`,
      "Não foi possível reenviar o convite."
    );
  }

  function revokeInvite(invite: Invite) {
    if (!window.confirm(`Revogar o convite de ${invite.email}? O link enviado deixará de funcionar.`)) return;
    return runRowAction(
      `invite-${invite.id}`,
      () => api(`/api/users/invites/${invite.id}`, { method: "DELETE" }),
      "Convite revogado.",
      "Não foi possível revogar o convite."
    );
  }

  function patchUser(user: User, body: Record<string, unknown>, success: string, fallback: string) {
    return runRowAction(
      `user-${user.id}`,
      () => api(`/api/users/${user.id}`, { method: "PATCH", body: JSON.stringify(body) }),
      success,
      fallback
    );
  }

  function handleActivate(user: User) {
    return patchUser(user, { action: "ACTIVATE" }, "Usuário reativado.", "Não foi possível reativar o usuário.");
  }

  function handleBlock(user: User) {
    if (!window.confirm(`Bloquear o acesso de ${user.email}?`)) return;
    return patchUser(user, { action: "BLOCK" }, "Usuário bloqueado.", "Não foi possível bloquear o usuário.");
  }

  function handleSuspend(user: User) {
    const draft = suspendDrafts[user.id] ?? getDefaultSuspensionValue();
    const suspensionDate = new Date(draft);
    if (Number.isNaN(suspensionDate.getTime())) {
      setFeedback({ kind: "error", message: "Informe uma data de suspensão válida." });
      return;
    }
    return patchUser(
      user,
      { action: "SUSPEND", suspendedUntil: suspensionDate.toISOString() },
      "Usuário suspenso.",
      "Não foi possível suspender o usuário."
    );
  }

  function handleDelete(user: User) {
    if (!window.confirm(`Excluir permanentemente o usuário ${user.email}?`)) return;
    return runRowAction(
      `user-${user.id}`,
      () => api(`/api/users/${user.id}`, { method: "DELETE" }),
      "Usuário excluído.",
      "Não foi possível excluir o usuário."
    );
  }

  const selectedRole = ROLE_OPTIONS.find((option) => option.value === inviteForm.role);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Painel do administrador</h1>
        <p className="text-sm opacity-75">
          Convide usuários por e-mail e gerencie bloqueio, suspensão temporária e exclusão de contas.
        </p>
      </div>

      {feedback && (
        <div
          role="status"
          className={`rounded-2xl border px-4 py-3 text-sm ${
            feedback.kind === "error"
              ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <section className="glass space-y-3 rounded-2xl p-4">
        <h2 className="text-base font-semibold">Convidar usuário</h2>
        <form onSubmit={sendInvite} className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <input
            className="surface-field rounded-xl px-3 py-2"
            placeholder="E-mail do convidado"
            type="email"
            aria-label="E-mail do convidado"
            value={inviteForm.email}
            onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })}
            required
          />
          <select
            className="surface-field rounded-xl px-3 py-2"
            aria-label="Perfil de acesso"
            value={inviteForm.role}
            onChange={(event) => setInviteForm({ ...inviteForm, role: event.target.value as UserRole })}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            className="rounded-xl bg-brand1 px-4 py-2 text-white hover:opacity-90 disabled:opacity-60"
            disabled={busy}
            type="submit"
          >
            {busy ? "Enviando..." : "Enviar convite"}
          </button>
        </form>
        <p className="text-xs opacity-70">
          {selectedRole?.description}. O convidado recebe um link por e-mail, válido por tempo limitado e de uso único,
          para definir nome e senha.
        </p>
      </section>

      <section className="glass space-y-3 rounded-2xl p-4">
        <h2 className="text-base font-semibold">Convites pendentes</h2>
        <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-black/5 dark:bg-white/10">
              <tr>
                <th className="p-2 text-left">E-mail</th>
                <th className="p-2 text-left">Perfil</th>
                <th className="p-2 text-left">Convidado por</th>
                <th className="p-2 text-left">Expira em</th>
                <th className="p-2 text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => {
                const rowBusy = rowBusyId === `invite-${invite.id}`;
                return (
                  <tr key={invite.id} className="border-t border-black/10 dark:border-white/10">
                    <td className="p-2">{invite.email}</td>
                    <td className="p-2">{roleLabel(invite.role)}</td>
                    <td className="p-2">{invite.invitedByName ?? "-"}</td>
                    <td className="p-2 text-xs opacity-80">{formatDateTimeBR(invite.expiresAt)}</td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-700 disabled:opacity-50 dark:text-emerald-300"
                          disabled={rowBusy}
                          onClick={() => void resendInvite(invite)}
                        >
                          Reenviar
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs text-rose-700 disabled:opacity-50 dark:text-rose-300"
                          disabled={rowBusy}
                          onClick={() => void revokeInvite(invite)}
                        >
                          Revogar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {invites.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center opacity-60">
                    Nenhum convite pendente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass space-y-3 rounded-2xl p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <input
            placeholder="Buscar por nome, e-mail, perfil ou situação..."
            aria-label="Buscar usuários"
            className="surface-field w-full rounded-xl px-3 py-2 md:w-96"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
          <div className="text-xs opacity-70">
            {filtered.length} {filtered.length === 1 ? "usuário" : "usuários"}
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-black/5 dark:bg-white/10">
              <tr>
                <th className="p-2 text-left">Nome</th>
                <th className="p-2 text-left">E-mail</th>
                <th className="p-2 text-left">Perfil</th>
                <th className="p-2 text-left">Situação</th>
                <th className="p-2 text-left">Suspenso até</th>
                <th className="p-2 text-left">Criado em</th>
                <th className="p-2 text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => {
                const badge = getStatusBadge(user);
                const busyRow = rowBusyId === `user-${user.id}`;
                const suspensionValue = suspendDrafts[user.id] ?? getDefaultSuspensionValue();

                return (
                  <tr key={user.id} className="border-t border-black/10 align-top dark:border-white/10">
                    <td className="p-2 font-medium">{user.name}</td>
                    <td className="p-2">{user.email}</td>
                    <td className="p-2">{roleLabel(user.role)}</td>
                    <td className="p-2">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="p-2 text-xs opacity-80">{formatDateTimeBR(user.suspendedUntil)}</td>
                    <td className="p-2 text-xs opacity-70">{formatDateTimeBR(user.createdAt)}</td>
                    <td className="p-2">
                      <div className="flex min-w-[360px] flex-col gap-2">
                        <div className="flex flex-wrap gap-2">
                          {user.status === "ACTIVE" ? (
                            <>
                              <button
                                type="button"
                                className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs text-rose-700 disabled:opacity-50 dark:text-rose-300"
                                disabled={busyRow}
                                onClick={() => void handleBlock(user)}
                              >
                                Bloquear
                              </button>
                              <button
                                type="button"
                                className="rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs text-amber-700 disabled:opacity-50 dark:text-amber-300"
                                disabled={busyRow}
                                onClick={() => void handleSuspend(user)}
                              >
                                Suspender
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="rounded-lg border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-700 disabled:opacity-50 dark:text-emerald-300"
                              disabled={busyRow}
                              onClick={() => void handleActivate(user)}
                            >
                              Reativar
                            </button>
                          )}

                          <button
                            type="button"
                            className="rounded-lg border border-black/15 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-white/15"
                            disabled={busyRow}
                            onClick={() => void handleDelete(user)}
                          >
                            Excluir
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            className="surface-field rounded-lg px-3 py-1.5 text-xs"
                            type="datetime-local"
                            aria-label={`Fim da suspensão de ${user.email}`}
                            value={suspensionValue}
                            onChange={(event) =>
                              setSuspendDrafts((current) => ({
                                ...current,
                                [user.id]: event.target.value,
                              }))
                            }
                          />
                          <span className="text-xs opacity-60">Defina quando a suspensão temporária termina.</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center opacity-60">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck, lint e build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: sem erros; o build lista `○ /accept-invite`.

- [ ] **Step 5: Commit**

```bash
git add middleware.ts "app/(auth)/accept-invite/page.tsx" "app/(app)/admin/page.tsx"
git commit -m "feat(convite): página de aceite e painel do administrador com convites pendentes" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

# Fase C — Ocorrências de AP offline

### Tarefa 11: Regras puras das ocorrências e formatação

**Files:**
- Create: `lib/incidentFormat.ts`, `lib/incidentRules.ts`
- Test: `tests/unit/incidentFormat.test.ts`, `tests/unit/incidentRules.test.ts`

**Interfaces:**
- Produces:
  - `lib/incidentFormat.ts`: `type IncidentStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED"`, `INCIDENT_STATUS_LABELS`, `INCIDENT_STATUS_STYLES`, `INCIDENT_EVENT_LABELS`, `RESOLUTION_LABELS`, `secondsBetween(from: Date, to: Date): number`, `formatDuration(totalSeconds: number): string`
  - `lib/incidentRules.ts`:
    - `type IncidentEventType = "OPENED" | "WENT_DOWN_AGAIN" | "RECOVERED" | "STATUS_CHANGED" | "COMMENT" | "RESOLVED" | "AUTO_RESOLVED" | "ALERT_SENT" | "RECOVERY_ALERT_SENT"`
    - `type IncidentAction = "START" | "COMMENT" | "RESOLVE"`
    - `type PlannedEvent = { type: IncidentEventType; message: string; fromStatus?: IncidentStatus; toStatus?: IncidentStatus }`
    - `type OpenIncidentSnapshot = { id: number; status: "OPEN" | "IN_PROGRESS"; lastDownAt: Date; recoveredAt: Date | null; downCount: number }`
    - `planIncidentTransition({ previousStatus, status, at, openIncident }): IncidentTransitionPlan` com `kind: "none" | "open" | "wentDownAgain" | "recovered"`
    - `planIncidentAction(current: IncidentStatus, action: IncidentAction, message?: string | null): { ok: true; toStatus; event: PlannedEvent } | { ok: false; error: "INVALID_TRANSITION" | "MESSAGE_REQUIRED" | "MESSAGE_TOO_LONG" }`
    - `INCIDENT_MESSAGE_MAX = 2000`
    - `getIncidentAlertConfig(env: Record<string, string | undefined>): { enabled: boolean; minMinutes: number }`

- [ ] **Step 1: Testes (falham)**

`tests/unit/incidentFormat.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatDuration, secondsBetween } from "@lib/incidentFormat";

describe("formatDuration", () => {
  it.each([
    [-5, "0 s"],
    [45, "45 s"],
    [600, "10 min"],
    [3_900, "1 h 05 min"],
    [7_200, "2 h"],
    [90_000, "1 d 1 h"],
    [172_800, "2 d"],
  ])("%i segundos → %s", (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});

describe("secondsBetween", () => {
  it("nunca devolve negativo", () => {
    const later = new Date("2026-10-08T12:00:00Z");
    const earlier = new Date("2026-10-08T11:59:00Z");
    expect(secondsBetween(earlier, later)).toBe(60);
    expect(secondsBetween(later, earlier)).toBe(0);
  });
});
```

`tests/unit/incidentRules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  getIncidentAlertConfig,
  planIncidentAction,
  planIncidentTransition,
  type OpenIncidentSnapshot,
} from "@lib/incidentRules";

const at = new Date("2026-10-08T12:00:00Z");
const openIncident: OpenIncidentSnapshot = {
  id: 12,
  status: "OPEN",
  lastDownAt: new Date("2026-10-08T11:30:00Z"),
  recoveredAt: null,
  downCount: 1,
};

describe("planIncidentTransition", () => {
  it("UP → DOWN sem ocorrência pendente abre uma nova", () => {
    expect(planIncidentTransition({ previousStatus: "UP", status: "DOWN", at, openIncident: null })).toEqual({
      kind: "open",
      events: [{ type: "OPENED", message: "O AP ficou offline.", toStatus: "OPEN" }],
    });
  });

  it("UP → DOWN com ocorrência em tratativa soma a queda na mesma ocorrência", () => {
    const plan = planIncidentTransition({
      previousStatus: "UP",
      status: "DOWN",
      at,
      openIncident: { ...openIncident, status: "IN_PROGRESS", recoveredAt: at, downCount: 2 },
    });
    expect(plan).toEqual({
      kind: "wentDownAgain",
      incidentId: 12,
      downCount: 3,
      events: [{ type: "WENT_DOWN_AGAIN", message: "O AP caiu novamente (3ª queda nesta ocorrência)." }],
    });
  });

  it("DOWN → UP com ocorrência aberta (sem tratativa) normaliza automaticamente", () => {
    const plan = planIncidentTransition({ previousStatus: "DOWN", status: "UP", at, openIncident });
    expect(plan).toMatchObject({ kind: "recovered", incidentId: 12, offlineSeconds: 1_800, autoResolve: true });
    if (plan.kind !== "recovered") throw new Error("esperava recovered");
    expect(plan.events.map((event) => event.type)).toEqual(["RECOVERED", "AUTO_RESOLVED"]);
    expect(plan.events[0].message).toBe("O AP voltou a ficar online após 30 min offline.");
  });

  it("DOWN → UP com ocorrência em tratativa só registra a volta", () => {
    const plan = planIncidentTransition({
      previousStatus: "DOWN",
      status: "UP",
      at,
      openIncident: { ...openIncident, status: "IN_PROGRESS" },
    });
    expect(plan).toMatchObject({ kind: "recovered", autoResolve: false });
    if (plan.kind !== "recovered") throw new Error("esperava recovered");
    expect(plan.events.map((event) => event.type)).toEqual(["RECOVERED"]);
  });

  it("DOWN → UP sem ocorrência, ou já recuperada, não faz nada", () => {
    expect(planIncidentTransition({ previousStatus: "DOWN", status: "UP", at, openIncident: null })).toEqual({ kind: "none" });
    expect(
      planIncidentTransition({ previousStatus: "DOWN", status: "UP", at, openIncident: { ...openIncident, recoveredAt: at } })
    ).toEqual({ kind: "none" });
  });

  it("status igual não é transição", () => {
    expect(planIncidentTransition({ previousStatus: "DOWN", status: "DOWN", at, openIncident })).toEqual({ kind: "none" });
  });
});

describe("planIncidentAction", () => {
  it("assumir tratativa só a partir de Aberta", () => {
    expect(planIncidentAction("OPEN", "START")).toMatchObject({
      ok: true,
      toStatus: "IN_PROGRESS",
      event: { type: "STATUS_CHANGED", message: "Tratativa iniciada.", fromStatus: "OPEN", toStatus: "IN_PROGRESS" },
    });
    expect(planIncidentAction("IN_PROGRESS", "START")).toEqual({ ok: false, error: "INVALID_TRANSITION" });
  });

  it("comentário exige pelo menos 3 caracteres e não muda o status", () => {
    expect(planIncidentAction("RESOLVED", "COMMENT", "  ok ")).toEqual({ ok: false, error: "MESSAGE_REQUIRED" });
    expect(planIncidentAction("RESOLVED", "COMMENT", "Trocado o PoE")).toMatchObject({
      ok: true,
      toStatus: "RESOLVED",
      event: { type: "COMMENT", message: "Trocado o PoE" },
    });
  });

  it("resolver exige descrever o que foi feito e não vale para ocorrência já resolvida", () => {
    expect(planIncidentAction("IN_PROGRESS", "RESOLVE", "ok")).toEqual({ ok: false, error: "MESSAGE_REQUIRED" });
    expect(planIncidentAction("IN_PROGRESS", "RESOLVE", "Cabo rompido substituído")).toMatchObject({
      ok: true,
      toStatus: "RESOLVED",
      event: { type: "RESOLVED", fromStatus: "IN_PROGRESS", toStatus: "RESOLVED" },
    });
    expect(planIncidentAction("RESOLVED", "RESOLVE", "Cabo rompido substituído")).toEqual({
      ok: false,
      error: "INVALID_TRANSITION",
    });
  });

  it("recusa texto acima de 2000 caracteres", () => {
    expect(planIncidentAction("OPEN", "COMMENT", "a".repeat(2_001))).toEqual({ ok: false, error: "MESSAGE_TOO_LONG" });
  });
});

describe("getIncidentAlertConfig", () => {
  it("padrão: ligado, 10 minutos", () => {
    expect(getIncidentAlertConfig({})).toEqual({ enabled: true, minMinutes: 10 });
  });

  it("respeita desligamento e faixa de 1 a 1440 minutos", () => {
    expect(getIncidentAlertConfig({ INCIDENT_ALERTS_ENABLED: "false" }).enabled).toBe(false);
    expect(getIncidentAlertConfig({ INCIDENT_ALERT_MIN_MINUTES: "3" }).minMinutes).toBe(3);
    expect(getIncidentAlertConfig({ INCIDENT_ALERT_MIN_MINUTES: "0" }).minMinutes).toBe(10);
    expect(getIncidentAlertConfig({ INCIDENT_ALERT_MIN_MINUTES: "5000" }).minMinutes).toBe(10);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/unit/incidentFormat.test.ts tests/unit/incidentRules.test.ts`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 3: Criar `lib/incidentFormat.ts`**

```ts
export type IncidentStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  OPEN: "Aberta",
  IN_PROGRESS: "Em tratativa",
  RESOLVED: "Resolvida",
};

export const INCIDENT_STATUS_STYLES: Record<IncidentStatus, string> = {
  OPEN: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  IN_PROGRESS: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  RESOLVED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

export const INCIDENT_EVENT_LABELS: Record<string, string> = {
  OPENED: "Ocorrência aberta",
  WENT_DOWN_AGAIN: "Caiu novamente",
  RECOVERED: "AP voltou a ficar online",
  STATUS_CHANGED: "Tratativa iniciada",
  COMMENT: "Comentário",
  RESOLVED: "Resolvida",
  AUTO_RESOLVED: "Normalizada automaticamente",
  ALERT_SENT: "Alerta de queda enviado",
  RECOVERY_ALERT_SENT: "Aviso de normalização enviado",
};

export const RESOLUTION_LABELS: Record<string, string> = {
  MANUAL: "Resolvida por operador",
  AUTO_RECOVERED: "Normalizada automaticamente",
};

export function secondsBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000));
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds < 60) return `${seconds} s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours < 24) return restMinutes ? `${hours} h ${String(restMinutes).padStart(2, "0")} min` : `${hours} h`;

  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days} d ${restHours} h` : `${days} d`;
}
```

- [ ] **Step 4: Criar `lib/incidentRules.ts`**

```ts
import { formatDuration, secondsBetween, type IncidentStatus } from "@lib/incidentFormat";

// Máquina de estados das ocorrências de AP offline (ver spec, seção 7.2).

export type { IncidentStatus } from "@lib/incidentFormat";

export type IncidentEventType =
  | "OPENED"
  | "WENT_DOWN_AGAIN"
  | "RECOVERED"
  | "STATUS_CHANGED"
  | "COMMENT"
  | "RESOLVED"
  | "AUTO_RESOLVED"
  | "ALERT_SENT"
  | "RECOVERY_ALERT_SENT";

export type IncidentAction = "START" | "COMMENT" | "RESOLVE";

export type PlannedEvent = {
  type: IncidentEventType;
  message: string;
  fromStatus?: IncidentStatus;
  toStatus?: IncidentStatus;
};

export type OpenIncidentSnapshot = {
  id: number;
  status: "OPEN" | "IN_PROGRESS";
  lastDownAt: Date;
  recoveredAt: Date | null;
  downCount: number;
};

export type IncidentTransitionPlan =
  | { kind: "none" }
  | { kind: "open"; events: PlannedEvent[] }
  | { kind: "wentDownAgain"; incidentId: number; downCount: number; events: PlannedEvent[] }
  | { kind: "recovered"; incidentId: number; offlineSeconds: number; autoResolve: boolean; events: PlannedEvent[] };

export const INCIDENT_MESSAGE_MAX = 2000;

export function planIncidentTransition(input: {
  previousStatus: string;
  status: "UP" | "DOWN";
  at: Date;
  openIncident: OpenIncidentSnapshot | null;
}): IncidentTransitionPlan {
  if (input.previousStatus === input.status) return { kind: "none" };
  const open = input.openIncident;

  if (input.status === "DOWN") {
    if (open) {
      const downCount = open.downCount + 1;
      return {
        kind: "wentDownAgain",
        incidentId: open.id,
        downCount,
        events: [{ type: "WENT_DOWN_AGAIN", message: `O AP caiu novamente (${downCount}ª queda nesta ocorrência).` }],
      };
    }
    return { kind: "open", events: [{ type: "OPENED", message: "O AP ficou offline.", toStatus: "OPEN" }] };
  }

  if (!open || open.recoveredAt) return { kind: "none" };

  const offlineSeconds = secondsBetween(open.lastDownAt, input.at);
  const autoResolve = open.status === "OPEN";
  const events: PlannedEvent[] = [
    { type: "RECOVERED", message: `O AP voltou a ficar online após ${formatDuration(offlineSeconds)} offline.` },
  ];
  if (autoResolve) {
    events.push({
      type: "AUTO_RESOLVED",
      message: "Ocorrência normalizada automaticamente: o AP voltou antes de alguém registrar tratativa.",
      fromStatus: "OPEN",
      toStatus: "RESOLVED",
    });
  }

  return { kind: "recovered", incidentId: open.id, offlineSeconds, autoResolve, events };
}

export type ActionPlan =
  | { ok: true; toStatus: IncidentStatus; event: PlannedEvent }
  | { ok: false; error: "INVALID_TRANSITION" | "MESSAGE_REQUIRED" | "MESSAGE_TOO_LONG" };

export function planIncidentAction(
  current: IncidentStatus,
  action: IncidentAction,
  rawMessage?: string | null
): ActionPlan {
  const message = (rawMessage ?? "").trim();
  if (message.length > INCIDENT_MESSAGE_MAX) return { ok: false, error: "MESSAGE_TOO_LONG" };

  switch (action) {
    case "START":
      if (current !== "OPEN") return { ok: false, error: "INVALID_TRANSITION" };
      return {
        ok: true,
        toStatus: "IN_PROGRESS",
        event: {
          type: "STATUS_CHANGED",
          message: message || "Tratativa iniciada.",
          fromStatus: "OPEN",
          toStatus: "IN_PROGRESS",
        },
      };
    case "COMMENT":
      if (message.length < 3) return { ok: false, error: "MESSAGE_REQUIRED" };
      return { ok: true, toStatus: current, event: { type: "COMMENT", message } };
    case "RESOLVE":
      if (current === "RESOLVED") return { ok: false, error: "INVALID_TRANSITION" };
      if (message.length < 5) return { ok: false, error: "MESSAGE_REQUIRED" };
      return {
        ok: true,
        toStatus: "RESOLVED",
        event: { type: "RESOLVED", message, fromStatus: current, toStatus: "RESOLVED" },
      };
    default:
      return { ok: false, error: "INVALID_TRANSITION" };
  }
}

export function getIncidentAlertConfig(env: Record<string, string | undefined>) {
  const enabled = env.INCIDENT_ALERTS_ENABLED?.trim().toLowerCase() !== "false";
  const raw = Number(env.INCIDENT_ALERT_MIN_MINUTES ?? 10);
  const minMinutes = Number.isFinite(raw) && raw >= 1 && raw <= 1440 ? Math.floor(raw) : 10;
  return { enabled, minMinutes };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/unit/incidentFormat.test.ts tests/unit/incidentRules.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/incidentFormat.ts lib/incidentRules.ts tests/unit/incidentFormat.test.ts tests/unit/incidentRules.test.ts
git commit -m "feat(ocorrencias): regras de abertura, normalização e tratativa" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Tarefa 12: Tabelas, migração e gancho nas transições de status

**Files:**
- Create: `lib/incidents.ts`
- Modify: `db/schema.sql` (tabelas novas), `scripts/init-db.mjs` (arquivo inteiro), `lib/statusChanges.ts` (gancho)
- Test: `tests/unit/incidents.test.ts`

**Interfaces:**
- Consumes: `planIncidentTransition`, `PlannedEvent` (Tarefa 11); `StatusTransition` (Tarefa 3); `toDate` (Tarefa 5); `PendingEmit` (Tarefa 3).
- Produces:
  - `lib/incidents.ts`: `applyIncidentTransition(connection: PoolConnection, transition: StatusTransition): Promise<PendingEmit[]>`, `insertIncidentEvents(connection, items: Array<{ incidentId: number; event: PlannedEvent; at: Date; actor?: { id: number; name: string } | null }>): Promise<void>`
  - SSE: `incident.opened` `{ id, antennaId, name, networkName, at }` e `incident.updated` `{ id }`

- [ ] **Step 1: Testes da persistência (falham)**

`tests/unit/incidents.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@lib/mysql", () => ({
  dbQuery: vi.fn(),
  dbQueryOne: vi.fn(),
  dbExecute: vi.fn(async () => ({ insertId: 41, affectedRows: 1 })),
  withTransaction: vi.fn(async (callback: (connection: unknown) => Promise<unknown>) => callback({})),
}));

import { dbExecute, dbQueryOne } from "@lib/mysql";
import { applyIncidentTransition } from "@lib/incidents";

const connection = {} as never;
const at = new Date("2026-10-08T12:00:00Z");
const base = { antennaId: 7, antennaName: "AP Praça", networkName: "Rede A", at };

function executedTypes() {
  return vi
    .mocked(dbExecute)
    .mock.calls.filter(([sql]) => String(sql).startsWith("INSERT INTO `IncidentEvent`"))
    .map(([, params]) => (params as unknown[])[1]);
}

describe("applyIncidentTransition", () => {
  it("abre ocorrência quando o AP cai sem ocorrência pendente", async () => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce(null);

    const emits = await applyIncidentTransition(connection, { ...base, previousStatus: "UP", status: "DOWN" });

    const [insertSql, insertParams] = vi.mocked(dbExecute).mock.calls[0];
    expect(insertSql).toContain("INSERT INTO `Incident`");
    expect(insertParams).toEqual([7, "AP Praça", "Rede A", at, at, at, at]);
    expect(vi.mocked(dbExecute).mock.calls[1][1]).toEqual([41, "OPENED", "O AP ficou offline.", null, "OPEN", null, null, at]);
    expect(emits).toEqual([
      {
        event: "incident.opened",
        payload: { id: 41, antennaId: 7, name: "AP Praça", networkName: "Rede A", at: at.toISOString() },
      },
    ]);
  });

  it("normaliza automaticamente a ocorrência aberta quando o AP volta", async () => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce({
      id: 12,
      status: "OPEN",
      lastDownAt: new Date("2026-10-08T11:30:00Z"),
      recoveredAt: null,
      downCount: 1,
    } as never);

    const emits = await applyIncidentTransition(connection, { ...base, previousStatus: "DOWN", status: "UP" });

    expect(vi.mocked(dbExecute).mock.calls[0][0]).toContain("`status` = 'RESOLVED'");
    expect(executedTypes()).toEqual(["RECOVERED", "AUTO_RESOLVED"]);
    expect(emits).toEqual([{ event: "incident.updated", payload: { id: 12 } }]);
  });

  it("mantém em tratativa quando o AP volta e alguém já assumiu", async () => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce({
      id: 12,
      status: "IN_PROGRESS",
      lastDownAt: new Date("2026-10-08T11:30:00Z"),
      recoveredAt: null,
      downCount: 1,
    } as never);

    await applyIncidentTransition(connection, { ...base, previousStatus: "DOWN", status: "UP" });

    expect(vi.mocked(dbExecute).mock.calls[0][0]).not.toContain("RESOLVED");
    expect(executedTypes()).toEqual(["RECOVERED"]);
  });

  it("nova queda numa ocorrência em tratativa renova lastDownAt e zera os alertas", async () => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce({
      id: 12,
      status: "IN_PROGRESS",
      lastDownAt: new Date("2026-10-08T10:00:00Z"),
      recoveredAt: new Date("2026-10-08T11:00:00Z"),
      downCount: 1,
    } as never);

    await applyIncidentTransition(connection, { ...base, previousStatus: "UP", status: "DOWN" });

    const [sql, params] = vi.mocked(dbExecute).mock.calls[0];
    expect(sql).toContain("`alertSentAt` = NULL");
    expect(params).toEqual([2, at, at, 12]);
    expect(executedTypes()).toEqual(["WENT_DOWN_AGAIN"]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/unit/incidents.test.ts`
Expected: FAIL — `@lib/incidents` inexistente.

- [ ] **Step 3: `db/schema.sql` — tabelas novas**

Ao final do arquivo, adicione:

```sql

CREATE TABLE IF NOT EXISTS `SchemaMigration` (
  `name` VARCHAR(100) NOT NULL,
  `appliedAt` DATETIME NOT NULL,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Incident` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `antennaId` INT NULL,
  `antennaName` VARCHAR(80) NOT NULL,
  `networkName` VARCHAR(255) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  `resolution` VARCHAR(20) NULL,
  `wentDownAt` DATETIME NOT NULL,
  `lastDownAt` DATETIME NOT NULL,
  `recoveredAt` DATETIME NULL,
  `downCount` INT NOT NULL DEFAULT 1,
  `alertSentAt` DATETIME NULL,
  `recoveryAlertSentAt` DATETIME NULL,
  `resolvedAt` DATETIME NULL,
  `resolvedById` INT NULL,
  `resolvedByName` VARCHAR(100) NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `Incident_status_lastDownAt_idx` (`status`, `lastDownAt`),
  KEY `Incident_antennaId_status_idx` (`antennaId`, `status`),
  KEY `Incident_createdAt_idx` (`createdAt`),
  CONSTRAINT `Incident_antennaId_fkey`
    FOREIGN KEY (`antennaId`) REFERENCES `Antenna` (`id`) ON DELETE SET NULL,
  CONSTRAINT `Incident_resolvedById_fkey`
    FOREIGN KEY (`resolvedById`) REFERENCES `User` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `IncidentEvent` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `incidentId` BIGINT NOT NULL,
  `type` VARCHAR(30) NOT NULL,
  `message` TEXT NULL,
  `fromStatus` VARCHAR(20) NULL,
  `toStatus` VARCHAR(20) NULL,
  `actorUserId` INT NULL,
  `actorName` VARCHAR(100) NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `IncidentEvent_incidentId_createdAt_idx` (`incidentId`, `createdAt`),
  CONSTRAINT `IncidentEvent_incidentId_fkey`
    FOREIGN KEY (`incidentId`) REFERENCES `Incident` (`id`) ON DELETE CASCADE,
  CONSTRAINT `IncidentEvent_actorUserId_fkey`
    FOREIGN KEY (`actorUserId`) REFERENCES `User` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 4: Reescrever `scripts/init-db.mjs`**

```js
import fs from "node:fs/promises";
import path from "node:path";
import { createMysqlConnection } from "./mysql-utils.mjs";

const schemaPath = path.resolve(process.cwd(), "db", "schema.sql");

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.execute(
    `
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName]
  );

  return Array.isArray(rows) && rows.length > 0;
}

async function ensureColumn(connection, tableName, columnName, ddl) {
  if (await columnExists(connection, tableName, columnName)) return;
  await connection.query(ddl);
  console.log(`Added ${tableName}.${columnName} column.`);
}

// Migrações de dados executadas uma única vez (registradas em SchemaMigration).
// Cada comando também é idempotente, para o caso de o processo cair no meio.
async function runOnce(connection, name, statements) {
  const [rows] = await connection.execute("SELECT 1 FROM `SchemaMigration` WHERE `name` = ? LIMIT 1", [name]);
  if (Array.isArray(rows) && rows.length > 0) return;

  for (const statement of statements) {
    await connection.query(statement);
  }
  await connection.execute("INSERT INTO `SchemaMigration` (`name`, `appliedAt`) VALUES (?, UTC_TIMESTAMP())", [name]);
  console.log(`Migration applied: ${name}`);
}

// APs que já estavam offline na implantação ganham ocorrência, sem disparar e-mail.
const INCIDENT_BACKFILL_V1 = [
  `INSERT INTO \`Incident\` (\`antennaId\`, \`antennaName\`, \`networkName\`, \`status\`, \`wentDownAt\`, \`lastDownAt\`, \`alertSentAt\`, \`createdAt\`, \`updatedAt\`)
   SELECT a.\`id\`, LEFT(a.\`name\`, 80), a.\`networkName\`, 'OPEN',
          COALESCE(a.\`lastStatusChange\`, UTC_TIMESTAMP()), COALESCE(a.\`lastStatusChange\`, UTC_TIMESTAMP()),
          UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP()
   FROM \`Antenna\` a
   WHERE a.\`gdmsApId\` IS NOT NULL
     AND a.\`status\` = 'DOWN'
     AND NOT EXISTS (
       SELECT 1 FROM \`Incident\` i WHERE i.\`antennaId\` = a.\`id\` AND i.\`status\` <> 'RESOLVED'
     )`,
  `INSERT INTO \`IncidentEvent\` (\`incidentId\`, \`type\`, \`message\`, \`toStatus\`, \`createdAt\`)
   SELECT i.\`id\`, 'OPENED', 'Ocorrência criada na implantação (o AP já estava offline).', 'OPEN', UTC_TIMESTAMP()
   FROM \`Incident\` i
   WHERE NOT EXISTS (SELECT 1 FROM \`IncidentEvent\` e WHERE e.\`incidentId\` = i.\`id\`)`,
];

(async () => {
  const connection = await createMysqlConnection({ multipleStatements: true });
  try {
    const sql = await fs.readFile(schemaPath, "utf8");
    await connection.query(sql);
    await ensureColumn(
      connection,
      "User",
      "suspendedUntil",
      "ALTER TABLE `User` ADD COLUMN `suspendedUntil` DATETIME NULL AFTER `isBlocked`"
    );
    await ensureColumn(
      connection,
      "User",
      "notificationsSeenAt",
      "ALTER TABLE `User` ADD COLUMN `notificationsSeenAt` DATETIME NULL"
    );
    await runOnce(connection, "incident_backfill_v1", INCIDENT_BACKFILL_V1);
    console.log("Database schema is ready.");
  } catch (error) {
    console.error("Database initialization failed:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
})();
```

- [ ] **Step 5: Criar `lib/incidents.ts` (persistência das transições)**

```ts
import "server-only";

import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { toDate } from "@lib/dateFormat";
import { planIncidentTransition, type PlannedEvent } from "@lib/incidentRules";
import { dbExecute, dbQueryOne } from "@lib/mysql";
import type { PendingEmit } from "@lib/sse";
import type { StatusTransition } from "@lib/statusChanges";

type OpenIncidentRow = RowDataPacket & {
  id: number;
  status: "OPEN" | "IN_PROGRESS";
  lastDownAt: Date | string;
  recoveredAt: Date | string | null;
  downCount: number;
};

type EventInsert = {
  incidentId: number;
  event: PlannedEvent;
  at: Date;
  actor?: { id: number; name: string } | null;
};

// IncidentEvent é a trilha de auditoria: a aplicação só insere, nunca altera nem apaga.
export async function insertIncidentEvents(connection: PoolConnection, items: EventInsert[]) {
  for (const item of items) {
    await dbExecute(
      "INSERT INTO `IncidentEvent` (`incidentId`, `type`, `message`, `fromStatus`, `toStatus`, `actorUserId`, `actorName`, `createdAt`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        item.incidentId,
        item.event.type,
        item.event.message,
        item.event.fromStatus ?? null,
        item.event.toStatus ?? null,
        item.actor?.id ?? null,
        item.actor?.name ?? null,
        item.at,
      ],
      connection
    );
  }
}

export async function applyIncidentTransition(
  connection: PoolConnection,
  transition: StatusTransition
): Promise<PendingEmit[]> {
  const row = await dbQueryOne<OpenIncidentRow>(
    "SELECT `id`, `status`, `lastDownAt`, `recoveredAt`, `downCount` FROM `Incident` WHERE `antennaId` = ? AND `status` <> 'RESOLVED' ORDER BY `id` DESC LIMIT 1 FOR UPDATE",
    [transition.antennaId],
    connection
  );

  const plan = planIncidentTransition({
    previousStatus: transition.previousStatus,
    status: transition.status,
    at: transition.at,
    openIncident: row
      ? {
          id: Number(row.id),
          status: row.status,
          lastDownAt: toDate(row.lastDownAt),
          recoveredAt: row.recoveredAt ? toDate(row.recoveredAt) : null,
          downCount: Number(row.downCount),
        }
      : null,
  });

  const at = transition.at;

  switch (plan.kind) {
    case "none":
      return [];

    case "open": {
      const result = await dbExecute(
        "INSERT INTO `Incident` (`antennaId`, `antennaName`, `networkName`, `status`, `wentDownAt`, `lastDownAt`, `createdAt`, `updatedAt`) VALUES (?, ?, ?, 'OPEN', ?, ?, ?, ?)",
        [transition.antennaId, transition.antennaName.slice(0, 80), transition.networkName, at, at, at, at],
        connection
      );
      await insertIncidentEvents(
        connection,
        plan.events.map((event) => ({ incidentId: result.insertId, event, at }))
      );
      return [
        {
          event: "incident.opened",
          payload: {
            id: result.insertId,
            antennaId: transition.antennaId,
            name: transition.antennaName,
            networkName: transition.networkName,
            at: at.toISOString(),
          },
        },
      ];
    }

    case "wentDownAgain": {
      await dbExecute(
        "UPDATE `Incident` SET `downCount` = ?, `lastDownAt` = ?, `recoveredAt` = NULL, `alertSentAt` = NULL, `recoveryAlertSentAt` = NULL, `updatedAt` = ? WHERE `id` = ?",
        [plan.downCount, at, at, plan.incidentId],
        connection
      );
      await insertIncidentEvents(
        connection,
        plan.events.map((event) => ({ incidentId: plan.incidentId, event, at }))
      );
      return [{ event: "incident.updated", payload: { id: plan.incidentId } }];
    }

    case "recovered": {
      if (plan.autoResolve) {
        await dbExecute(
          "UPDATE `Incident` SET `recoveredAt` = ?, `status` = 'RESOLVED', `resolution` = 'AUTO_RECOVERED', `resolvedAt` = ?, `updatedAt` = ? WHERE `id` = ?",
          [at, at, at, plan.incidentId],
          connection
        );
      } else {
        await dbExecute(
          "UPDATE `Incident` SET `recoveredAt` = ?, `updatedAt` = ? WHERE `id` = ?",
          [at, at, plan.incidentId],
          connection
        );
      }
      await insertIncidentEvents(
        connection,
        plan.events.map((event) => ({ incidentId: plan.incidentId, event, at }))
      );
      return [{ event: "incident.updated", payload: { id: plan.incidentId } }];
    }
  }
}
```

- [ ] **Step 6: `lib/statusChanges.ts` — chamar as ocorrências**

Adicione o import:

```ts
import { applyIncidentTransition } from "@lib/incidents";
```

e troque o `return [ { event: "status.changed", ... } ];` da função por:

```ts
  const incidentEmits = await applyIncidentTransition(connection, transition);

  return [
    {
      event: "status.changed",
      payload: {
        id: transition.antennaId,
        name: transition.antennaName,
        networkName: transition.networkName,
        previousStatus: transition.previousStatus,
        status: transition.status,
        at: transition.at.toISOString(),
      },
    },
    ...incidentEmits,
  ];
```

- [ ] **Step 7: Rodar testes e typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: tudo PASS (o teste do sync continua passando: o mock de `dbQueryOne` devolve `null`, então a queda abre ocorrência sem afetar as asserções).

- [ ] **Step 8: Commit**

```bash
git add db/schema.sql scripts/init-db.mjs lib/incidents.ts lib/statusChanges.ts tests/unit/incidents.test.ts
git commit -m "feat(ocorrencias): tabelas, carga inicial e abertura automática nas mudanças de status" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Tarefa 13: Alertas por e-mail (resumo único por ciclo)

**Files:**
- Create: `lib/incidentAlerts.ts`
- Modify: `lib/emailTemplates.ts` (resumos), `lib/gdmsSync.ts` (chamada no fim do sync + campo `alerts`), `services/api.ts` (`alerts?` em `GdmsSyncSummary`), `env.example`, `README.md`, `tests/unit/gdmsSync.test.ts` (mock + caso novo)
- Test: `tests/unit/incidentAlerts.test.ts`, `tests/unit/emailTemplates.test.ts` (novos casos)

**Interfaces:**
- Consumes: `getIncidentAlertConfig` (Tarefa 11), `formatDuration`, `secondsBetween` (Tarefa 11), `getConfiguredPublicOrigin` (Tarefa 7), `sendMail` (`lib/email.ts`).
- Produces:
  - `lib/emailTemplates.ts`: `type IncidentDigestItem = { antennaName: string; networkName: string | null; since: Date; until?: Date }`, `buildIncidentDownDigest(items, { now, appUrl, minMinutes, maxItems? }): EmailContent`, `buildIncidentRecoveryDigest(items, { appUrl, maxItems? }): EmailContent`
  - `lib/incidentAlerts.ts`: `processIncidentAlerts(now?: Date): Promise<{ downSent: number; recoverySent: number }>`
  - `GdmsSyncSummary.alerts: { downSent: number; recoverySent: number }`

- [ ] **Step 1: Testes (falham)**

Em `tests/unit/emailTemplates.test.ts`, troque o import por:

```ts
import {
  buildIncidentDownDigest,
  buildIncidentRecoveryDigest,
  buildInviteEmail,
  buildPasswordResetEmail,
  escapeHtml,
  renderEmail,
} from "@lib/emailTemplates";
```

e adicione ao final:

```ts
describe("resumos de ocorrência", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  const item = (index: number) => ({
    antennaName: `AP ${index}`,
    networkName: "Rede A",
    since: new Date("2026-10-08T11:30:00Z"),
  });

  it("queda em massa vira um único e-mail com no máximo 100 linhas e 'e mais N'", () => {
    const items = Array.from({ length: 130 }, (_, index) => item(index + 1));

    const email = buildIncidentDownDigest(items, { now, appUrl: "https://stats.test", minMinutes: 10 });

    expect(email.subject).toBe("[Stats A.P] 130 AP(s) offline");
    expect(email.text.split("\n").filter((line) => line.startsWith("- AP "))).toHaveLength(100);
    expect(email.text).toContain("e mais 30 AP(s) offline");
    expect(email.text).toContain("AP 1 | Rede A");
    expect(email.text).toContain("30 min");
    expect(email.text).toContain("https://stats.test/incidents");
  });

  it("resumo de normalização mostra quanto tempo cada AP ficou offline", () => {
    const email = buildIncidentRecoveryDigest(
      [{ ...item(1), until: new Date("2026-10-08T13:35:00Z") }],
      { appUrl: null }
    );

    expect(email.subject).toBe("[Stats A.P] 1 AP(s) normalizado(s)");
    expect(email.text).toContain("AP 1 | Rede A | 2 h 05 min");
    expect(email.html).not.toContain("href=");
  });
});
```

`tests/unit/incidentAlerts.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@lib/mysql", () => ({
  dbQuery: vi.fn(),
  dbExecute: vi.fn(async () => ({ affectedRows: 1 })),
}));
vi.mock("@lib/email", () => ({ sendMail: vi.fn() }));

import { sendMail } from "@lib/email";
import { dbExecute, dbQuery } from "@lib/mysql";
import { processIncidentAlerts } from "@lib/incidentAlerts";

const now = new Date("2026-10-08T12:00:00Z");
const recipients = [{ email: "a@exemplo.com" }, { email: "b@exemplo.com" }];
const downRows = [
  { id: 1, antennaName: "AP 1", networkName: "Rede A", lastDownAt: new Date("2026-10-08T11:00:00Z") },
  { id: 2, antennaName: "AP 2", networkName: "Rede A", lastDownAt: new Date("2026-10-08T11:30:00Z") },
];

describe("processIncidentAlerts", () => {
  beforeEach(() => {
    process.env.INCIDENT_ALERTS_ENABLED = "true";
    process.env.INCIDENT_ALERT_MIN_MINUTES = "10";
    process.env.APP_URL = "https://stats.test";
  });

  it("envia um único e-mail com todas as quedas e marca como enviadas", async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce(recipients as never)
      .mockResolvedValueOnce(downRows as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(sendMail).mockResolvedValue(undefined);

    const result = await processIncidentAlerts(now);

    expect(result).toEqual({ downSent: 2, recoverySent: 0 });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendMail).mock.calls[0][0]).toMatchObject({
      to: "a@exemplo.com, b@exemplo.com",
      subject: "[Stats A.P] 2 AP(s) offline",
    });
    const threshold = vi.mocked(dbQuery).mock.calls[1][1] as unknown[];
    expect(threshold).toEqual([new Date("2026-10-08T11:50:00Z")]);
    const update = vi.mocked(dbExecute).mock.calls.find(([sql]) => String(sql).includes("SET `alertSentAt`"));
    expect(update?.[1]).toEqual([now, now, 1, 2]);
    const events = vi.mocked(dbExecute).mock.calls.find(([sql]) => String(sql).startsWith("INSERT INTO `IncidentEvent`"));
    expect(events?.[1]).toEqual(expect.arrayContaining([1, "ALERT_SENT", 2, "ALERT_SENT"]));
  });

  it("não marca nada quando o SMTP falha (tenta de novo no próximo ciclo)", async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce(recipients as never)
      .mockResolvedValueOnce(downRows as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(sendMail).mockRejectedValue(new Error("SMTP indisponível"));

    const result = await processIncidentAlerts(now);

    expect(result).toEqual({ downSent: 0, recoverySent: 0 });
    expect(dbExecute).not.toHaveBeenCalled();
  });

  it("não consulta nada com os alertas desligados", async () => {
    process.env.INCIDENT_ALERTS_ENABLED = "false";

    await expect(processIncidentAlerts(now)).resolves.toEqual({ downSent: 0, recoverySent: 0 });
    expect(dbQuery).not.toHaveBeenCalled();
  });

  it("envia o resumo de normalização das ocorrências que tiveram alerta de queda", async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce(recipients as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ ...downRows[0], recoveredAt: new Date("2026-10-08T11:40:00Z") }] as never);
    vi.mocked(sendMail).mockResolvedValue(undefined);

    const result = await processIncidentAlerts(now);

    expect(result).toEqual({ downSent: 0, recoverySent: 1 });
    expect(vi.mocked(sendMail).mock.calls[0][0].subject).toBe("[Stats A.P] 1 AP(s) normalizado(s)");
    expect(vi.mocked(dbExecute).mock.calls.some(([sql]) => String(sql).includes("SET `recoveryAlertSentAt`"))).toBe(true);
  });
});
```

Em `tests/unit/gdmsSync.test.ts`, logo após o `vi.mock("@services/gdms", ...)`, adicione:

```ts
vi.mock("@lib/incidentAlerts", () => ({
  processIncidentAlerts: vi.fn(async () => ({ downSent: 2, recoverySent: 0 })),
}));
```

e adicione o caso dentro do `describe("runGdmsSync", ...)`:

```ts
  it("processa os alertas de ocorrência ao final do sync", async () => {
    const summary = await runGdmsSync("status");
    expect(summary.alerts).toEqual({ downSent: 2, recoverySent: 0 });
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/unit/emailTemplates.test.ts tests/unit/incidentAlerts.test.ts tests/unit/gdmsSync.test.ts`
Expected: FAIL — resumos não exportados, `@lib/incidentAlerts` inexistente, `summary.alerts` indefinido.

- [ ] **Step 3: `lib/emailTemplates.ts` — resumos de ocorrência**

Adicione o import no topo:

```ts
import { formatDuration, secondsBetween } from "@lib/incidentFormat";
```

e ao final do arquivo:

```ts
export type IncidentDigestItem = {
  antennaName: string;
  networkName: string | null;
  since: Date;
  until?: Date;
};

const DIGEST_MAX_ITEMS = 100;
const DIGEST_FOOTNOTE = "Você recebe este aviso por ser administrador do Stats A.P.";

function digestAction(appUrl: string | null) {
  return appUrl ? { label: "Abrir ocorrências", url: `${appUrl.replace(/\/+$/, "")}/incidents` } : undefined;
}

export function buildIncidentDownDigest(
  items: IncidentDigestItem[],
  opts: { now: Date; appUrl: string | null; minMinutes: number; maxItems?: number }
): EmailContent {
  const max = opts.maxItems ?? DIGEST_MAX_ITEMS;
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  const paragraphs = [`${items.length} AP(s) estão offline há mais de ${opts.minMinutes} minuto(s).`];
  if (rest > 0) paragraphs.push(`A lista abaixo mostra os ${shown.length} primeiros, e mais ${rest} AP(s) offline.`);

  return renderEmail({
    subject: `[Stats A.P] ${items.length} AP(s) offline`,
    heading: "APs offline",
    paragraphs,
    table: {
      columns: ["AP", "Rede", "Offline desde", "Duração"],
      rows: shown.map((item) => [
        item.antennaName,
        item.networkName ?? "-",
        formatDateTimeBR(item.since),
        formatDuration(secondsBetween(item.since, opts.now)),
      ]),
    },
    action: digestAction(opts.appUrl),
    footnote: DIGEST_FOOTNOTE,
  });
}

export function buildIncidentRecoveryDigest(
  items: IncidentDigestItem[],
  opts: { appUrl: string | null; maxItems?: number }
): EmailContent {
  const max = opts.maxItems ?? DIGEST_MAX_ITEMS;
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  const paragraphs = [`${items.length} AP(s) que estavam offline voltaram a ficar online.`];
  if (rest > 0) paragraphs.push(`A lista abaixo mostra os ${shown.length} primeiros, e mais ${rest} AP(s).`);

  return renderEmail({
    subject: `[Stats A.P] ${items.length} AP(s) normalizado(s)`,
    heading: "APs normalizados",
    paragraphs,
    table: {
      columns: ["AP", "Rede", "Ficou offline por"],
      rows: shown.map((item) => [
        item.antennaName,
        item.networkName ?? "-",
        formatDuration(secondsBetween(item.since, item.until ?? item.since)),
      ]),
    },
    action: digestAction(opts.appUrl),
    footnote: DIGEST_FOOTNOTE,
  });
}
```

- [ ] **Step 4: Criar `lib/incidentAlerts.ts`**

```ts
import "server-only";

import type { RowDataPacket } from "mysql2/promise";
import { toDate } from "@lib/dateFormat";
import { sendMail } from "@lib/email";
import { buildIncidentDownDigest, buildIncidentRecoveryDigest } from "@lib/emailTemplates";
import { getIncidentAlertConfig } from "@lib/incidentRules";
import { dbExecute, dbQuery } from "@lib/mysql";
import { getConfiguredPublicOrigin } from "@lib/publicUrl";

type RecipientRow = RowDataPacket & { email: string };
type AlertRow = RowDataPacket & {
  id: number;
  antennaName: string;
  networkName: string | null;
  lastDownAt: Date | string;
  recoveredAt?: Date | string | null;
};

export type IncidentAlertResult = { downSent: number; recoverySent: number };

const MAX_INCIDENTS_PER_DIGEST_QUERY = 500;

function placeholders(count: number) {
  return Array.from({ length: count }, () => "?").join(", ");
}

async function markSent(
  column: "alertSentAt" | "recoveryAlertSentAt",
  eventType: "ALERT_SENT" | "RECOVERY_ALERT_SENT",
  ids: number[],
  recipientCount: number,
  now: Date
) {
  await dbExecute(
    `UPDATE \`Incident\` SET \`${column}\` = ?, \`updatedAt\` = ? WHERE \`id\` IN (${placeholders(ids.length)})`,
    [now, now, ...ids]
  );

  const message = `Aviso enviado por e-mail para ${recipientCount} destinatário(s).`;
  await dbExecute(
    `INSERT INTO \`IncidentEvent\` (\`incidentId\`, \`type\`, \`message\`, \`createdAt\`) VALUES ${ids
      .map(() => "(?, ?, ?, ?)")
      .join(", ")}`,
    ids.flatMap((id) => [id, eventType, message, now])
  );
}

// Roda no fim de cada sync (a cada 5 min pelo worker). Um único e-mail-resumo por tipo e ciclo.
// Se o envio falhar, nada é marcado e o próximo ciclo tenta de novo.
export async function processIncidentAlerts(now = new Date()): Promise<IncidentAlertResult> {
  const result: IncidentAlertResult = { downSent: 0, recoverySent: 0 };
  const config = getIncidentAlertConfig(process.env);
  if (!config.enabled) return result;

  const recipients = await dbQuery<RecipientRow>(
    "SELECT `email` FROM `User` WHERE `role` IN ('ADMIN', 'SUPERADMIN') AND `isBlocked` = 0 AND (`suspendedUntil` IS NULL OR `suspendedUntil` <= ?)",
    [now]
  );
  if (!recipients.length) return result;

  const to = recipients.map((row) => row.email).join(", ");
  const appUrl = getConfiguredPublicOrigin();
  const threshold = new Date(now.getTime() - config.minMinutes * 60_000);

  const down = await dbQuery<AlertRow>(
    `SELECT \`id\`, \`antennaName\`, \`networkName\`, \`lastDownAt\` FROM \`Incident\` WHERE \`status\` <> 'RESOLVED' AND \`recoveredAt\` IS NULL AND \`alertSentAt\` IS NULL AND \`lastDownAt\` <= ? ORDER BY \`lastDownAt\` ASC LIMIT ${MAX_INCIDENTS_PER_DIGEST_QUERY}`,
    [threshold]
  );
  if (down.length) {
    try {
      await sendMail({
        to,
        ...buildIncidentDownDigest(
          down.map((row) => ({ antennaName: row.antennaName, networkName: row.networkName, since: toDate(row.lastDownAt) })),
          { now, appUrl, minMinutes: config.minMinutes }
        ),
      });
      await markSent("alertSentAt", "ALERT_SENT", down.map((row) => Number(row.id)), recipients.length, now);
      result.downSent = down.length;
    } catch (error) {
      console.error("processIncidentAlerts: falha ao enviar o alerta de queda:", error);
    }
  }

  const recovered = await dbQuery<AlertRow>(
    `SELECT \`id\`, \`antennaName\`, \`networkName\`, \`lastDownAt\`, \`recoveredAt\` FROM \`Incident\` WHERE \`alertSentAt\` IS NOT NULL AND \`recoveredAt\` IS NOT NULL AND \`recoveryAlertSentAt\` IS NULL ORDER BY \`recoveredAt\` ASC LIMIT ${MAX_INCIDENTS_PER_DIGEST_QUERY}`
  );
  if (recovered.length) {
    try {
      await sendMail({
        to,
        ...buildIncidentRecoveryDigest(
          recovered.map((row) => ({
            antennaName: row.antennaName,
            networkName: row.networkName,
            since: toDate(row.lastDownAt),
            until: toDate(row.recoveredAt ?? row.lastDownAt),
          })),
          { appUrl }
        ),
      });
      await markSent(
        "recoveryAlertSentAt",
        "RECOVERY_ALERT_SENT",
        recovered.map((row) => Number(row.id)),
        recipients.length,
        now
      );
      result.recoverySent = recovered.length;
    } catch (error) {
      console.error("processIncidentAlerts: falha ao enviar o aviso de normalização:", error);
    }
  }

  return result;
}
```

- [ ] **Step 5: `lib/gdmsSync.ts` — alertas no fim do sync**

Adicione o import:

```ts
import { processIncidentAlerts } from "@lib/incidentAlerts";
```

Em `GdmsSyncSummary`, adicione o campo `alerts: { downSent: number; recoverySent: number };` (depois de `errors`).

Na criação do objeto `summary` em `executeSync`, adicione `alerts: { downSent: 0, recoverySent: 0 },` depois de `errors: [],`.

Troque a linha `summary.ok = summary.errors.length === 0;` por:

```ts
  summary.ok = summary.errors.length === 0;

  // Alertas não podem derrubar o sync: uma falha aqui fica só no log.
  try {
    summary.alerts = await processIncidentAlerts(new Date());
  } catch (error) {
    console.error("runGdmsSync: falha ao processar alertas de ocorrência:", error);
  }
```

Em `services/api.ts`, na interface `GdmsSyncSummary`, adicione `alerts?: { downSent: number; recoverySent: number };`.

- [ ] **Step 6: Variáveis de ambiente**

Em `env.example`, após `INVITE_TOKEN_HOURS="72"`, adicione:

```
INCIDENT_ALERTS_ENABLED="true"
INCIDENT_ALERT_MIN_MINUTES="10"
```

No `README.md`, na tabela da seção `### Recuperacao de senha e email` (título sem acento no README), acrescente:

```
| `INVITE_TOKEN_HOURS` | Não | `72` | Validade do link de convite (1 a 336 h) |
| `INCIDENT_ALERTS_ENABLED` | Não | `true` | Liga o e-mail-resumo de APs offline/normalizados para ADMIN e SUPERADMIN |
| `INCIDENT_ALERT_MIN_MINUTES` | Não | `10` | Tempo offline mínimo antes do alerta (1 a 1440 min); evita alarme por queda rápida |
```

- [ ] **Step 7: Rodar testes e typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: tudo PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/emailTemplates.ts lib/incidentAlerts.ts lib/gdmsSync.ts services/api.ts env.example README.md tests/unit/emailTemplates.test.ts tests/unit/incidentAlerts.test.ts tests/unit/gdmsSync.test.ts
git commit -m "feat(ocorrencias): e-mail-resumo de APs offline e normalizados a cada ciclo do sync" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Tarefa 14: API de ocorrências e de notificações

**Files:**
- Modify: `lib/incidents.ts` (consultas e ações), `services/api.ts` (tipos)
- Create: `app/api/incidents/route.ts`, `app/api/incidents/[id]/route.ts`, `app/api/incidents/[id]/actions/route.ts`, `app/api/notifications/route.ts`, `app/api/notifications/seen/route.ts`
- Test: `tests/unit/incidents.test.ts` (novos casos)

**Interfaces:**
- Consumes: `planIncidentAction`, `IncidentAction` (Tarefa 11); `insertIncidentEvents` (Tarefa 12); `toIso` (Tarefa 8); `emit` (`lib/sse.ts`).
- Produces (em `lib/incidents.ts`):
  - `type IncidentItem = { id; antennaId: number | null; antennaName; networkName: string | null; status: IncidentStatus; resolution: string | null; wentDownAt: string | null; lastDownAt: string | null; recoveredAt: string | null; downCount: number; alertSentAt: string | null; resolvedAt: string | null; resolvedByName: string | null; offlineSeconds: number }`
  - `type IncidentEventItem = { id; type; message: string | null; fromStatus: string | null; toStatus: string | null; actorName: string; createdAt: string | null }`
  - `type IncidentFilters = { status: "ACTIVE" | "OPEN" | "IN_PROGRESS" | "RESOLVED" | "ALL"; network: string; q: string; page: number; pageSize: number }`
  - `listIncidents(filters, now?)`, `getIncidentDetail(id, now?): Promise<(IncidentItem & { events: IncidentEventItem[] }) | null>`, `applyIncidentAction({ incidentId, action, message, actor })`, `getNotificationSummary(userId, now?)`, `markNotificationsSeen(userId, now?)`
- Rotas:
  - `GET /api/incidents?status=&network=&q=&page=&pageSize=` → `{ ok, items, totalCount, page, pageSize, totalPages }`
  - `GET /api/incidents/[id]` → `{ ok, item }` | `404 NOT_FOUND`
  - `POST /api/incidents/[id]/actions` `{ action, message? }` (ADMIN/SUPERADMIN) → `{ ok, item }` | `404 NOT_FOUND` | `409 INVALID_TRANSITION` | `400 MESSAGE_REQUIRED` | `400 MESSAGE_TOO_LONG`
  - `GET /api/notifications` → `{ ok, unread, openCount, items: Array<IncidentItem & { isUnread: boolean }> }`
  - `POST /api/notifications/seen` → `{ ok: true }`

- [ ] **Step 1: Testes das ações (falham)**

Em `tests/unit/incidents.test.ts`, troque o import de `@lib/mysql` e de `@lib/incidents` por:

```ts
import { dbExecute, dbQuery, dbQueryOne } from "@lib/mysql";
import { applyIncidentAction, applyIncidentTransition, mapIncidentRow } from "@lib/incidents";
```

adicione, logo após o `vi.mock("@lib/mysql", ...)`:

```ts
vi.mock("@lib/sse", () => ({ emit: vi.fn() }));
```

e acrescente ao final do arquivo:

```ts
describe("applyIncidentAction", () => {
  const incidentRow = {
    id: 12,
    antennaId: 7,
    antennaName: "AP Praça",
    networkName: "Rede A",
    status: "IN_PROGRESS",
    resolution: null,
    wentDownAt: new Date("2026-10-08T11:00:00Z"),
    lastDownAt: new Date("2026-10-08T11:00:00Z"),
    recoveredAt: null,
    downCount: 1,
    alertSentAt: null,
    resolvedAt: null,
    resolvedByName: null,
    createdAt: new Date("2026-10-08T11:00:00Z"),
  };

  it("resolve com a descrição do que foi feito e registra quem resolveu", async () => {
    vi.mocked(dbQueryOne)
      .mockResolvedValueOnce({ id: 12, status: "IN_PROGRESS" } as never)
      .mockResolvedValueOnce({ ...incidentRow, status: "RESOLVED" } as never);
    vi.mocked(dbQuery).mockResolvedValueOnce([] as never);

    const result = await applyIncidentAction({
      incidentId: 12,
      action: "RESOLVE",
      message: "Cabo rompido substituído",
      actor: { id: 3, name: "Marcos" },
    });

    expect(result).toMatchObject({ ok: true, item: { id: 12, status: "RESOLVED" } });
    const [sql, params] = vi.mocked(dbExecute).mock.calls[0];
    expect(sql).toContain("`resolution` = 'MANUAL'");
    expect(params).toEqual(["RESOLVED", expect.any(Date), 3, "Marcos", expect.any(Date), 12]);
    expect(vi.mocked(dbExecute).mock.calls[1][1]).toEqual([
      12,
      "RESOLVED",
      "Cabo rompido substituído",
      "IN_PROGRESS",
      "RESOLVED",
      3,
      "Marcos",
      expect.any(Date),
    ]);
  });

  it("recusa transição inválida sem gravar nada", async () => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce({ id: 12, status: "RESOLVED" } as never);

    const result = await applyIncidentAction({ incidentId: 12, action: "START", actor: { id: 3, name: "Marcos" } });

    expect(result).toEqual({ ok: false, error: "INVALID_TRANSITION", status: 409 });
    expect(dbExecute).not.toHaveBeenCalled();
  });

  it("devolve NOT_FOUND para ocorrência inexistente", async () => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce(null);

    const result = await applyIncidentAction({ incidentId: 99, action: "COMMENT", message: "teste", actor: { id: 3, name: "Marcos" } });

    expect(result).toEqual({ ok: false, error: "NOT_FOUND", status: 404 });
  });
});

describe("mapIncidentRow", () => {
  it("calcula o tempo offline até agora quando o AP ainda não voltou", () => {
    const item = mapIncidentRow(
      {
        id: 1,
        antennaId: null,
        antennaName: "AP Removido",
        networkName: null,
        status: "OPEN",
        resolution: null,
        wentDownAt: new Date("2026-10-08T11:00:00Z"),
        lastDownAt: new Date("2026-10-08T11:00:00Z"),
        recoveredAt: null,
        downCount: 1,
        alertSentAt: null,
        resolvedAt: null,
        resolvedByName: null,
        createdAt: new Date("2026-10-08T11:00:00Z"),
      } as never,
      new Date("2026-10-08T11:45:00Z")
    );

    expect(item).toMatchObject({ id: 1, antennaId: null, offlineSeconds: 2_700, recoveredAt: null });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/unit/incidents.test.ts`
Expected: FAIL — `applyIncidentAction` e `mapIncidentRow` não exportados.

- [ ] **Step 3: `lib/incidents.ts` — consultas, ações e notificações**

Troque os imports do topo por:

```ts
import "server-only";

import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { toDate } from "@lib/dateFormat";
import { toIso } from "@lib/dbMappers";
import { secondsBetween, type IncidentStatus } from "@lib/incidentFormat";
import {
  planIncidentAction,
  planIncidentTransition,
  type IncidentAction,
  type PlannedEvent,
} from "@lib/incidentRules";
import { dbExecute, dbQuery, dbQueryOne, withTransaction } from "@lib/mysql";
import { emit, type PendingEmit } from "@lib/sse";
import type { StatusTransition } from "@lib/statusChanges";
```

e acrescente ao final do arquivo:

```ts
type IncidentRow = RowDataPacket & {
  id: number;
  antennaId: number | null;
  antennaName: string;
  networkName: string | null;
  status: IncidentStatus;
  resolution: string | null;
  wentDownAt: Date | string;
  lastDownAt: Date | string;
  recoveredAt: Date | string | null;
  downCount: number;
  alertSentAt: Date | string | null;
  resolvedAt: Date | string | null;
  resolvedByName: string | null;
  createdAt: Date | string;
};

type IncidentEventRow = RowDataPacket & {
  id: number;
  type: string;
  message: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  actorName: string | null;
  createdAt: Date | string;
};

type CountRow = RowDataPacket & { total: number };
type LockedIncidentRow = RowDataPacket & { id: number; status: IncidentStatus };
type SeenRow = RowDataPacket & { notificationsSeenAt: Date | string | null; createdAt: Date | string };
type SummaryRow = RowDataPacket & { unread: number | null; openCount: number | null };

export type IncidentItem = {
  id: number;
  antennaId: number | null;
  antennaName: string;
  networkName: string | null;
  status: IncidentStatus;
  resolution: string | null;
  wentDownAt: string | null;
  lastDownAt: string | null;
  recoveredAt: string | null;
  downCount: number;
  alertSentAt: string | null;
  resolvedAt: string | null;
  resolvedByName: string | null;
  offlineSeconds: number;
};

export type IncidentEventItem = {
  id: number;
  type: string;
  message: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  actorName: string;
  createdAt: string | null;
};

export type IncidentDetail = IncidentItem & { events: IncidentEventItem[] };

export type IncidentFilters = {
  status: "ACTIVE" | "OPEN" | "IN_PROGRESS" | "RESOLVED" | "ALL";
  network: string;
  q: string;
  page: number;
  pageSize: number;
};

export function mapIncidentRow(row: IncidentRow, now = new Date()): IncidentItem {
  const lastDownAt = toDate(row.lastDownAt);
  const recoveredAt = row.recoveredAt ? toDate(row.recoveredAt) : null;

  return {
    id: Number(row.id),
    antennaId: row.antennaId === null || row.antennaId === undefined ? null : Number(row.antennaId),
    antennaName: row.antennaName,
    networkName: row.networkName ?? null,
    status: row.status,
    resolution: row.resolution ?? null,
    wentDownAt: toIso(row.wentDownAt),
    lastDownAt: toIso(row.lastDownAt),
    recoveredAt: toIso(row.recoveredAt),
    downCount: Number(row.downCount),
    alertSentAt: toIso(row.alertSentAt),
    resolvedAt: toIso(row.resolvedAt),
    resolvedByName: row.resolvedByName ?? null,
    offlineSeconds: secondsBetween(lastDownAt, recoveredAt ?? now),
  };
}

function mapIncidentEventRow(row: IncidentEventRow): IncidentEventItem {
  return {
    id: Number(row.id),
    type: row.type,
    message: row.message ?? null,
    fromStatus: row.fromStatus ?? null,
    toStatus: row.toStatus ?? null,
    actorName: row.actorName || "Sistema",
    createdAt: toIso(row.createdAt),
  };
}

export async function listIncidents(filters: IncidentFilters, now = new Date()) {
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (filters.status === "ACTIVE") {
    where.push("`status` <> 'RESOLVED'");
  } else if (filters.status !== "ALL") {
    where.push("`status` = ?");
    params.push(filters.status);
  }
  if (filters.network) {
    where.push("`networkName` = ?");
    params.push(filters.network);
  }
  if (filters.q) {
    where.push("`antennaName` LIKE ?");
    params.push(`%${filters.q}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const count = await dbQueryOne<CountRow>(`SELECT COUNT(*) AS \`total\` FROM \`Incident\` ${whereSql}`, params);
  const totalCount = Number(count?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));
  const page = Math.min(filters.page, totalPages);

  const rows = await dbQuery<IncidentRow>(
    `SELECT * FROM \`Incident\` ${whereSql} ORDER BY (\`status\` = 'RESOLVED') ASC, \`lastDownAt\` DESC, \`id\` DESC LIMIT ${filters.pageSize} OFFSET ${(page - 1) * filters.pageSize}`,
    params
  );

  return {
    items: rows.map((row) => mapIncidentRow(row, now)),
    totalCount,
    page,
    pageSize: filters.pageSize,
    totalPages,
  };
}

export async function getIncidentDetail(incidentId: number, now = new Date()): Promise<IncidentDetail | null> {
  const row = await dbQueryOne<IncidentRow>("SELECT * FROM `Incident` WHERE `id` = ? LIMIT 1", [incidentId]);
  if (!row) return null;

  const events = await dbQuery<IncidentEventRow>(
    "SELECT `id`, `type`, `message`, `fromStatus`, `toStatus`, `actorName`, `createdAt` FROM `IncidentEvent` WHERE `incidentId` = ? ORDER BY `createdAt` ASC, `id` ASC",
    [incidentId]
  );

  return { ...mapIncidentRow(row, now), events: events.map(mapIncidentEventRow) };
}

type ActionResult =
  | { ok: true; item: IncidentDetail }
  | { ok: false; error: "NOT_FOUND" | "INVALID_TRANSITION" | "MESSAGE_REQUIRED" | "MESSAGE_TOO_LONG"; status: number };

export async function applyIncidentAction(input: {
  incidentId: number;
  action: IncidentAction;
  message?: string | null;
  actor: { id: number; name: string };
}): Promise<ActionResult> {
  const now = new Date();

  const outcome = await withTransaction<ActionResult | null>(async (connection) => {
    const row = await dbQueryOne<LockedIncidentRow>(
      "SELECT `id`, `status` FROM `Incident` WHERE `id` = ? LIMIT 1 FOR UPDATE",
      [input.incidentId],
      connection
    );
    if (!row) return { ok: false, error: "NOT_FOUND", status: 404 };

    const plan = planIncidentAction(row.status, input.action, input.message);
    if (!plan.ok) {
      return { ok: false, error: plan.error, status: plan.error === "INVALID_TRANSITION" ? 409 : 400 };
    }

    if (plan.toStatus === "RESOLVED" && row.status !== "RESOLVED") {
      await dbExecute(
        "UPDATE `Incident` SET `status` = ?, `resolution` = 'MANUAL', `resolvedAt` = ?, `resolvedById` = ?, `resolvedByName` = ?, `updatedAt` = ? WHERE `id` = ?",
        [plan.toStatus, now, input.actor.id, input.actor.name, now, input.incidentId],
        connection
      );
    } else if (plan.toStatus !== row.status) {
      await dbExecute(
        "UPDATE `Incident` SET `status` = ?, `updatedAt` = ? WHERE `id` = ?",
        [plan.toStatus, now, input.incidentId],
        connection
      );
    }

    await insertIncidentEvents(connection, [
      { incidentId: input.incidentId, event: plan.event, at: now, actor: input.actor },
    ]);
    return null;
  });

  if (outcome) return outcome;

  emit("incident.updated", { id: input.incidentId });
  const item = await getIncidentDetail(input.incidentId, now);
  if (!item) return { ok: false, error: "NOT_FOUND", status: 404 };
  return { ok: true, item };
}

export async function getNotificationSummary(userId: number, now = new Date()) {
  const user = await dbQueryOne<SeenRow>(
    "SELECT `notificationsSeenAt`, `createdAt` FROM `User` WHERE `id` = ? LIMIT 1",
    [userId]
  );
  // Usuário novo não recebe como "não lidas" as ocorrências anteriores à criação da conta.
  const seenAt = user?.notificationsSeenAt
    ? toDate(user.notificationsSeenAt)
    : user?.createdAt
      ? toDate(user.createdAt)
      : new Date(0);

  const summary = await dbQueryOne<SummaryRow>(
    "SELECT SUM(CASE WHEN `createdAt` > ? THEN 1 ELSE 0 END) AS `unread`, SUM(CASE WHEN `status` <> 'RESOLVED' THEN 1 ELSE 0 END) AS `openCount` FROM `Incident`",
    [seenAt]
  );
  const rows = await dbQuery<IncidentRow>("SELECT * FROM `Incident` ORDER BY `createdAt` DESC, `id` DESC LIMIT 8");

  return {
    unread: Number(summary?.unread ?? 0),
    openCount: Number(summary?.openCount ?? 0),
    items: rows.map((row) => ({ ...mapIncidentRow(row, now), isUnread: toDate(row.createdAt) > seenAt })),
  };
}

export async function markNotificationsSeen(userId: number, now = new Date()) {
  await dbExecute("UPDATE `User` SET `notificationsSeenAt` = ? WHERE `id` = ?", [now, userId]);
}
```

- [ ] **Step 4: Rotas de ocorrências**

`app/api/incidents/route.ts`:

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRequestAuth } from "@lib/auth";
import { listIncidents } from "@lib/incidents";

const querySchema = z.object({
  status: z.enum(["ACTIVE", "OPEN", "IN_PROGRESS", "RESOLVED", "ALL"]).catch("ACTIVE"),
  network: z.string().trim().max(255).catch(""),
  q: z.string().trim().max(100).catch(""),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(100).catch(25),
});

export async function GET(req: Request) {
  try {
    const auth = await requireRequestAuth(req);
    if ("response" in auth) return auth.response;

    const searchParams = new URL(req.url).searchParams;
    const filters = querySchema.parse({
      status: searchParams.get("status") ?? undefined,
      network: searchParams.get("network") ?? undefined,
      q: searchParams.get("q") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    });

    return NextResponse.json({ ok: true, ...(await listIncidents(filters)) });
  } catch (e) {
    console.error("GET /api/incidents error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
```

`app/api/incidents/[id]/route.ts`:

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRequestAuth } from "@lib/auth";
import { getIncidentDetail } from "@lib/incidents";

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRequestAuth(req);
    if ("response" in auth) return auth.response;

    const parsed = paramsSchema.safeParse(params);
    if (!parsed.success) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    const item = await getIncidentDetail(parsed.data.id);
    if (!item) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    return NextResponse.json({ ok: true, item });
  } catch (e) {
    console.error("GET /api/incidents/[id] error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
```

`app/api/incidents/[id]/actions/route.ts`:

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRequestAuth } from "@lib/auth";
import { applyIncidentAction } from "@lib/incidents";
import { INCIDENT_MESSAGE_MAX } from "@lib/incidentRules";
import { checkRateLimit, rateLimitResponse } from "@lib/rateLimit";

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });
const bodySchema = z.object({
  action: z.enum(["START", "COMMENT", "RESOLVE"]),
  message: z.string().max(INCIDENT_MESSAGE_MAX + 100).nullish(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRequestAuth(req, ["ADMIN", "SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    const rateLimit = checkRateLimit(req, "incident-action", {
      max: 120,
      windowMs: 15 * 60_000,
      key: auth.user.sub,
    });
    if (!rateLimit.ok) return rateLimitResponse(rateLimit);

    const parsedParams = paramsSchema.safeParse(params);
    if (!parsedParams.success) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    const parsedBody = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsedBody.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_FAILED", details: parsedBody.error.issues },
        { status: 400 }
      );
    }

    const result = await applyIncidentAction({
      incidentId: parsedParams.data.id,
      action: parsedBody.data.action,
      message: parsedBody.data.message,
      actor: { id: Number(auth.user.sub), name: auth.user.name },
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true, item: result.item });
  } catch (e) {
    console.error("POST /api/incidents/[id]/actions error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Rotas de notificações**

`app/api/notifications/route.ts`:

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireRequestAuth } from "@lib/auth";
import { getNotificationSummary } from "@lib/incidents";

export async function GET(req: Request) {
  try {
    const auth = await requireRequestAuth(req);
    if ("response" in auth) return auth.response;

    return NextResponse.json({ ok: true, ...(await getNotificationSummary(Number(auth.user.sub))) });
  } catch (e) {
    console.error("GET /api/notifications error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
```

`app/api/notifications/seen/route.ts`:

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireRequestAuth } from "@lib/auth";
import { markNotificationsSeen } from "@lib/incidents";

export async function POST(req: Request) {
  try {
    const auth = await requireRequestAuth(req);
    if ("response" in auth) return auth.response;

    await markNotificationsSeen(Number(auth.user.sub));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/notifications/seen error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
```

- [ ] **Step 6: `services/api.ts` — tipos do front**

Ao final das interfaces (antes de `const UNSAFE_METHODS`), adicione:

```ts
export type IncidentStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";

export interface IncidentListItem {
  id: number;
  antennaId: number | null;
  antennaName: string;
  networkName: string | null;
  status: IncidentStatus;
  resolution: string | null;
  wentDownAt: string | null;
  lastDownAt: string | null;
  recoveredAt: string | null;
  downCount: number;
  alertSentAt: string | null;
  resolvedAt: string | null;
  resolvedByName: string | null;
  offlineSeconds: number;
}

export interface IncidentEventItem {
  id: number;
  type: string;
  message: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  actorName: string;
  createdAt: string | null;
}

export interface IncidentDetail extends IncidentListItem {
  events: IncidentEventItem[];
}

export interface IncidentListResponse {
  ok: boolean;
  items: IncidentListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface NotificationItem extends IncidentListItem {
  isUnread: boolean;
}

export interface NotificationSummary {
  ok: boolean;
  unread: number;
  openCount: number;
  items: NotificationItem[];
}

export interface MeResponse {
  ok: boolean;
  user?: { id: string; name: string; email: string; role: "SUPERADMIN" | "ADMIN" | "USER" };
}
```

- [ ] **Step 7: Testes, typecheck e build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: tudo PASS; o build lista `/api/incidents`, `/api/incidents/[id]`, `/api/incidents/[id]/actions`, `/api/notifications`, `/api/notifications/seen`.

- [ ] **Step 8: Commit**

```bash
git add lib/incidents.ts services/api.ts app/api/incidents app/api/notifications tests/unit/incidents.test.ts
git commit -m "feat(ocorrencias): API de listagem, detalhe, tratativa e notificações" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Tarefa 15: Tela de Ocorrências com linha do tempo e tratativa

**Files:**
- Create: `app/(app)/incidents/page.tsx`, `components/incidents/IncidentDetailPanel.tsx`
- Modify: `components/Sidebar.tsx` (item "Ocorrências" e rótulos)

**Interfaces:**
- Consumes: rotas da Tarefa 14; tipos de `services/api.ts` (Tarefa 14); `INCIDENT_STATUS_LABELS`, `INCIDENT_STATUS_STYLES`, `INCIDENT_EVENT_LABELS`, `RESOLUTION_LABELS`, `formatDuration` (Tarefa 11); `formatDateTimeBR` (Tarefa 5); `connectSSE` (Tarefa 7); `PaginationControls` (props: `page`, `totalPages`, `totalItems`, `pageSize`, `onPageChange`, `itemLabel`).
- Produces: `IncidentDetailPanel` com props `{ incidentId: number; canManage: boolean; onClose: () => void; onChanged: () => void }`; deep link `/incidents?id=<id>` (usado pela Tarefa 16).

- [ ] **Step 1: Criar `components/incidents/IncidentDetailPanel.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { formatDateTimeBR } from "@lib/dateFormat";
import {
  formatDuration,
  INCIDENT_EVENT_LABELS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUS_STYLES,
  RESOLUTION_LABELS,
} from "@lib/incidentFormat";
import { api, ApiError, type IncidentDetail } from "@services/api";
import { connectSSE } from "@services/sseClient";

type Action = "START" | "COMMENT" | "RESOLVE";

type Props = {
  incidentId: number;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
};

function describeActionError(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "MESSAGE_REQUIRED":
        return "Descreva o que foi feito: pelo menos 3 caracteres para comentar e 5 para resolver.";
      case "MESSAGE_TOO_LONG":
        return "O texto pode ter no máximo 2000 caracteres.";
      case "INVALID_TRANSITION":
        return "Esta ação não é permitida no status atual da ocorrência. Atualize a página.";
      case "FORBIDDEN":
        return "Apenas administradores podem tratar ocorrências.";
      case "NOT_FOUND":
        return "Ocorrência não encontrada.";
      default:
        break;
    }
  }
  return "Não foi possível registrar a ação.";
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-soft rounded-xl px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.16em] opacity-60">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}

export default function IncidentDetailPanel({ incidentId, canManage, onClose, onChanged }: Props) {
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<Action | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await api<{ ok: boolean; item: IncidentDetail }>(`/api/incidents/${incidentId}`);
      setDetail(response.item);
      setLoadError(null);
    } catch (error) {
      setLoadError(
        error instanceof ApiError && error.status === 404
          ? "Ocorrência não encontrada."
          : "Não foi possível carregar a ocorrência."
      );
    }
  }, [incidentId]);

  useEffect(() => {
    setDetail(null);
    setMessage("");
    setActionError(null);
    void load();
  }, [load]);

  useEffect(
    () =>
      connectSSE((event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.event === "incident.updated" && Number(payload.id) === incidentId) void load();
        } catch {}
      }),
    [incidentId, load]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function runAction(action: Action) {
    setBusy(action);
    setActionError(null);
    try {
      const response = await api<{ ok: boolean; item: IncidentDetail }>(`/api/incidents/${incidentId}/actions`, {
        method: "POST",
        body: JSON.stringify({ action, message }),
      });
      setDetail(response.item);
      setMessage("");
      onChanged();
    } catch (error) {
      setActionError(describeActionError(error));
    } finally {
      setBusy(null);
    }
  }

  const isResolved = detail?.status === "RESOLVED";

  return (
    <div className="fixed inset-0 z-[1100] flex justify-end bg-black/40 backdrop-blur-[1px]" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes da ocorrência"
        className="surface-overlay flex h-full w-full max-w-xl flex-col overflow-hidden backdrop-blur-md"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-black/10 p-4 dark:border-white/10">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] opacity-60">Ocorrência #{incidentId}</div>
            <h2 className="mt-1 break-words text-lg font-semibold">{detail?.antennaName ?? "Carregando..."}</h2>
            {detail?.networkName ? <div className="text-sm opacity-75">{detail.networkName}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="surface-soft-hover grid h-9 w-9 shrink-0 place-items-center rounded-lg"
            aria-label="Fechar detalhes"
            title="Fechar"
          >
            <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {loadError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
              {loadError}
            </div>
          )}

          {detail && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${INCIDENT_STATUS_STYLES[detail.status]}`}
                >
                  {INCIDENT_STATUS_LABELS[detail.status]}
                </span>
                {detail.resolution ? (
                  <span className="text-xs opacity-70">{RESOLUTION_LABELS[detail.resolution] ?? detail.resolution}</span>
                ) : null}
                {detail.antennaId === null ? (
                  <span className="text-xs opacity-70">AP removido do sistema</span>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Caiu em" value={formatDateTimeBR(detail.wentDownAt)} />
                <Field label="Última queda" value={formatDateTimeBR(detail.lastDownAt)} />
                <Field label="Voltou em" value={detail.recoveredAt ? formatDateTimeBR(detail.recoveredAt) : "Ainda offline"} />
                <Field label="Tempo offline" value={formatDuration(detail.offlineSeconds)} />
                <Field label="Quedas" value={String(detail.downCount)} />
                <Field label="Alerta por e-mail" value={detail.alertSentAt ? formatDateTimeBR(detail.alertSentAt) : "Não enviado"} />
              </div>

              <section aria-label="Linha do tempo">
                <h3 className="mb-2 text-sm font-semibold">Linha do tempo (auditoria)</h3>
                <ol className="space-y-2">
                  {detail.events.map((item) => (
                    <li key={item.id} className="surface-soft rounded-xl px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium">{INCIDENT_EVENT_LABELS[item.type] ?? item.type}</span>
                        <span className="text-xs opacity-70">{formatDateTimeBR(item.createdAt)}</span>
                      </div>
                      {item.message ? <p className="mt-1 whitespace-pre-wrap break-words">{item.message}</p> : null}
                      <div className="mt-1 text-xs opacity-60">por {item.actorName}</div>
                    </li>
                  ))}
                </ol>
              </section>
            </>
          )}
        </div>

        {detail && canManage && (
          <footer className="space-y-2 border-t border-black/10 p-4 dark:border-white/10">
            <label className="block text-sm font-medium" htmlFor="incident-message">
              {isResolved ? "Adicionar comentário" : "O que foi feito?"}
            </label>
            <textarea
              id="incident-message"
              className="surface-field w-full rounded-xl px-3 py-2 text-sm"
              rows={3}
              maxLength={2000}
              placeholder="Ex.: técnico no local, PoE reiniciado, cabo substituído..."
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            {actionError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                {actionError}
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              {detail.status === "OPEN" && (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void runAction("START")}
                  className="rounded-xl border border-amber-500/40 px-3 py-2 text-sm text-amber-700 disabled:opacity-50 dark:text-amber-300"
                >
                  {busy === "START" ? "Salvando..." : "Assumir tratativa"}
                </button>
              )}
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void runAction("COMMENT")}
                className="surface-button rounded-xl px-3 py-2 text-sm disabled:opacity-50"
              >
                {busy === "COMMENT" ? "Salvando..." : "Comentar"}
              </button>
              {!isResolved && (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void runAction("RESOLVE")}
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {busy === "RESOLVE" ? "Salvando..." : "Resolver"}
                </button>
              )}
            </div>
          </footer>
        )}
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: Criar `app/(app)/incidents/page.tsx`**

```tsx
"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import PaginationControls from "@components/PaginationControls";
import IncidentDetailPanel from "@components/incidents/IncidentDetailPanel";
import { formatDateTimeBR } from "@lib/dateFormat";
import { formatDuration, INCIDENT_STATUS_LABELS, INCIDENT_STATUS_STYLES } from "@lib/incidentFormat";
import {
  api,
  type AntennaNetworksResponse,
  type IncidentListResponse,
  type MeResponse,
} from "@services/api";
import { connectSSE } from "@services/sseClient";

const STATUS_FILTERS = [
  { value: "ACTIVE", label: "Abertas e em tratativa" },
  { value: "OPEN", label: "Abertas" },
  { value: "IN_PROGRESS", label: "Em tratativa" },
  { value: "RESOLVED", label: "Resolvidas" },
  { value: "ALL", label: "Todas" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

const PAGE_SIZE = 25;

function IncidentsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = Number(searchParams.get("id")) || null;

  const [status, setStatus] = useState<StatusFilter>("ACTIVE");
  const [network, setNetwork] = useState("");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<IncidentListResponse | null>(null);
  const [networks, setNetworks] = useState<string[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(queryInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      const params = new URLSearchParams({ status, page: String(page), pageSize: String(PAGE_SIZE) });
      if (network) params.set("network", network);
      if (query) params.set("q", query);

      try {
        const response = await api<IncidentListResponse>(`/api/incidents?${params.toString()}`);
        if (!alive) return;
        setData(response);
        setError(null);
        if (response.page !== page) setPage(response.page);
      } catch {
        if (alive) setError("Não foi possível carregar as ocorrências.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, [status, network, query, page, refreshKey]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [me, nets] = await Promise.all([
          api<MeResponse>("/api/me"),
          api<AntennaNetworksResponse>("/api/antennas/networks"),
        ]);
        if (!alive) return;
        setCanManage(me.user?.role === "ADMIN" || me.user?.role === "SUPERADMIN");
        setNetworks(nets.items ?? []);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(
    () =>
      connectSSE((event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.event === "incident.opened" || payload.event === "incident.updated") {
            setRefreshKey((value) => value + 1);
          }
        } catch {}
      }),
    []
  );

  const openIncident = useCallback((id: number) => router.push(`${pathname}?id=${id}`), [pathname, router]);
  const closePanel = useCallback(() => router.push(pathname), [pathname, router]);
  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <section className="glass space-y-4 rounded-3xl p-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Ocorrências</h1>
          <p className="text-sm opacity-75">
            Cada queda de AP abre uma ocorrência automaticamente. Registre o que foi feito para manter o histórico de
            auditoria.
          </p>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por status">
          {STATUS_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={status === option.value}
              onClick={() => {
                setStatus(option.value);
                setPage(1);
              }}
              className={`rounded-xl px-3 py-2 text-sm ${
                status === option.value ? "bg-emerald-600 text-white" : "surface-button"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_280px]">
          <input
            className="surface-field rounded-xl px-3 py-2"
            placeholder="Buscar por nome do AP..."
            aria-label="Buscar por nome do AP"
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
          />
          <select
            className="surface-field rounded-xl px-3 py-2"
            aria-label="Filtrar por rede"
            value={network}
            onChange={(event) => {
              setNetwork(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas as redes</option>
            {networks.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="glass rounded-3xl p-5">
        {error && (
          <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-black/5 dark:bg-white/10">
              <tr>
                <th className="p-3 text-left">AP</th>
                <th className="p-3 text-left">Rede</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Caiu em</th>
                <th className="p-3 text-left">Voltou em</th>
                <th className="p-3 text-left">Tempo offline</th>
                <th className="p-3 text-left">Alerta</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data && (
                <tr>
                  <td colSpan={7} className="p-4 text-center opacity-60">
                    Carregando...
                  </td>
                </tr>
              )}

              {items.map((incident) => (
                <tr
                  key={incident.id}
                  onClick={() => openIncident(incident.id)}
                  className={`cursor-pointer border-t border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5 ${
                    selectedId === incident.id ? "bg-emerald-500/10" : ""
                  }`}
                >
                  <td className="p-3">
                    <button
                      type="button"
                      className="text-left font-medium underline-offset-4 hover:underline"
                      onClick={(event) => {
                        event.stopPropagation();
                        openIncident(incident.id);
                      }}
                    >
                      {incident.antennaName}
                    </button>
                    {incident.downCount > 1 ? (
                      <div className="text-xs opacity-60">{incident.downCount} quedas</div>
                    ) : null}
                  </td>
                  <td className="p-3">{incident.networkName ?? "-"}</td>
                  <td className="p-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${INCIDENT_STATUS_STYLES[incident.status]}`}
                    >
                      {INCIDENT_STATUS_LABELS[incident.status]}
                    </span>
                  </td>
                  <td className="p-3 text-xs">{formatDateTimeBR(incident.lastDownAt)}</td>
                  <td className="p-3 text-xs">{incident.recoveredAt ? formatDateTimeBR(incident.recoveredAt) : "Ainda offline"}</td>
                  <td className="p-3">{formatDuration(incident.offlineSeconds)}</td>
                  <td className="p-3 text-xs">{incident.alertSentAt ? "Enviado" : "-"}</td>
                </tr>
              ))}

              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center opacity-60">
                    Nenhuma ocorrência para os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginationControls
          page={data?.page ?? page}
          totalPages={data?.totalPages ?? 1}
          totalItems={data?.totalCount ?? 0}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          itemLabel="ocorrências"
        />
      </section>

      {selectedId !== null && (
        <IncidentDetailPanel
          incidentId={selectedId}
          canManage={canManage}
          onClose={closePanel}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

export default function IncidentsPage() {
  return (
    <Suspense fallback={<div className="glass rounded-3xl p-5 text-sm opacity-70">Carregando ocorrências...</div>}>
      <IncidentsView />
    </Suspense>
  );
}
```

- [ ] **Step 3: `components/Sidebar.tsx` — item "Ocorrências" e rótulos**

No import de ícones, acrescente `faTriangleExclamation` à lista de `@fortawesome/free-solid-svg-icons`.

No array `links` de `SidebarContent`, troque o bloco por:

```tsx
  const links: NavLink[] = [
    { path: "/", href: { pathname: "/" }, icon: faMap, label: "Mapa" },
    { path: "/dashboard", href: { pathname: "/dashboard" }, icon: faChartPie, label: "Dashboard" },
    { path: "/clients", href: { pathname: "/clients" }, icon: faUsers, label: "Clientes" },
    {
      path: "/incidents",
      href: { pathname: "/incidents" },
      icon: faTriangleExclamation,
      label: "Ocorrências",
    },
    {
      path: "/filter-cluster",
      href: { pathname: "/filter-cluster" },
      icon: faFilter,
      label: "Filtros Cluster",
    },
    ...(canManage
      ? [{ path: "/settings", href: { pathname: "/settings" }, icon: faGear, label: "Configurações" }]
      : []),
  ];
```

Troque `Administracao` por `Administração` (cabeçalho da seção do SUPERADMIN).

- [ ] **Step 4: Typecheck, lint e build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: sem erros; o build lista `○ /incidents`.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/incidents/page.tsx" components/incidents/IncidentDetailPanel.tsx components/Sidebar.tsx
git commit -m "feat(ocorrencias): tela de ocorrências com linha do tempo e tratativa" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Tarefa 16: Sino de notificações no topo e link no toast

**Files:**
- Create: `components/NotificationBell.tsx`
- Modify: `components/TopBar.tsx` (sino + textos), `components/AntennaStatusNotifications.tsx` (link + textos)

**Interfaces:**
- Consumes: `GET /api/notifications`, `POST /api/notifications/seen` (Tarefa 14); `NotificationSummary` (Tarefa 14); deep link `/incidents?id=` (Tarefa 15).

- [ ] **Step 1: Criar `components/NotificationBell.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell } from "@fortawesome/free-solid-svg-icons";
import { formatDateTimeBR } from "@lib/dateFormat";
import { INCIDENT_STATUS_LABELS, INCIDENT_STATUS_STYLES } from "@lib/incidentFormat";
import { api, type NotificationSummary } from "@services/api";
import { connectSSE } from "@services/sseClient";

const REFRESH_MS = 60_000;

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<NotificationSummary | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      setSummary(await api<NotificationSummary>("/api/notifications"));
    } catch {}
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(load, REFRESH_MS);
    const disconnect = connectSSE((event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === "incident.opened" || payload.event === "incident.updated") void load();
      } catch {}
    });
    return () => {
      window.clearInterval(timer);
      disconnect();
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function markAllRead() {
    try {
      await api("/api/notifications/seen", { method: "POST" });
      await load();
    } catch {}
  }

  function openIncident(id: number) {
    setOpen(false);
    router.push(`/incidents?id=${id}`);
  }

  const unread = summary?.unread ?? 0;
  const badge = unread > 99 ? "99+" : String(unread);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="surface-soft-hover relative grid h-8 w-8 place-items-center rounded-lg sm:h-9 sm:w-9"
        title="Notificações"
        aria-label={unread ? `Notificações: ${unread} não lida(s)` : "Notificações"}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <FontAwesomeIcon icon={faBell} className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-rose-600 px-1 text-center text-[10px] font-semibold leading-[18px] text-white">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notificações de ocorrências"
          className="surface-overlay absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl p-3 backdrop-blur-md"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">Ocorrências</div>
              <div className="text-xs opacity-70">{summary?.openCount ?? 0} em aberto</div>
            </div>
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={unread === 0}
              className="rounded-lg px-2 py-1 text-xs underline-offset-4 hover:underline disabled:opacity-40"
            >
              Marcar como lidas
            </button>
          </div>

          <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
            {(summary?.items ?? []).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => openIncident(item.id)}
                  className="surface-soft-hover w-full rounded-xl px-3 py-2 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      {item.isUnread ? (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" aria-label="Não lida" />
                      ) : null}
                      <span className="truncate text-sm font-medium">{item.antennaName}</span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${INCIDENT_STATUS_STYLES[item.status]}`}
                    >
                      {INCIDENT_STATUS_LABELS[item.status]}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs opacity-70">
                    {item.networkName ? `${item.networkName} · ` : ""}
                    {formatDateTimeBR(item.lastDownAt)}
                  </div>
                </button>
              </li>
            ))}
            {summary && summary.items.length === 0 && (
              <li className="px-3 py-4 text-center text-sm opacity-70">Nenhuma ocorrência registrada.</li>
            )}
          </ul>

          <Link
            href="/incidents"
            onClick={() => setOpen(false)}
            className="mt-2 block rounded-xl px-3 py-2 text-center text-sm font-medium underline-offset-4 hover:underline"
          >
            Ver todas as ocorrências
          </Link>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: `components/TopBar.tsx` — sino e textos**

Adicione o import:

```tsx
import NotificationBell from "@components/NotificationBell";
```

Logo antes do comentário `{/* Tema */}`, insira:

```tsx
              {/* Notificações de ocorrências */}
              <NotificationBell />

```

Troque os textos:
- `title={isFs ? "Sair do Fullscreen do mapa" : "Fullscreen do mapa"}` → `title={isFs ? "Sair da tela cheia do mapa" : "Tela cheia do mapa"}`
- `aria-label="Alternar fullscreen do mapa"` → `aria-label="Alternar tela cheia do mapa"`
- `title={isLight ? "Mudar para Dark" : "Mudar para Light"}` → `title={isLight ? "Ativar tema escuro" : "Ativar tema claro"}`

- [ ] **Step 3: `components/AntennaStatusNotifications.tsx` — link e textos**

Adicione o import `import Link from "next/link";`.

Logo após o bloco `{toast.networkName ? ( ... ) : null}`, insira:

```tsx
                {isOffline ? (
                  <Link
                    href="/incidents"
                    onClick={() => removeToast(toast.id)}
                    className="mt-1 inline-block text-xs font-medium underline underline-offset-4"
                  >
                    Ver ocorrências
                  </Link>
                ) : null}
```

Troque `aria-label="Fechar notificacao"` por `aria-label="Fechar notificação"` e `title="Fechar notificacao"` por `title="Fechar notificação"`.

- [ ] **Step 4: Typecheck, lint e build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add components/NotificationBell.tsx components/TopBar.tsx components/AntennaStatusNotifications.tsx
git commit -m "feat(ocorrencias): sino de notificações no topo e atalho no aviso de AP offline" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

# Fase D — Rotação do mapa

### Tarefa 17: Controle de rotação que acompanha o arraste

**Files:**
- Create: `lib/mapRotation.ts`, `components/map/RotationControl.tsx`
- Modify: `components/MapClient.tsx` (remove o joystick antigo, usa o componente novo, preserva rotação no `fitBounds`, textos PT-BR)
- Test: `tests/unit/mapRotation.test.ts`

**Interfaces:**
- Produces:
  - `lib/mapRotation.ts`: `ROTATION_STEP_BUTTON = 45`, `ROTATION_STEP_KEY = 15`, `normalizeBearing(value): number` (em `[0, 360)`), `toSignedBearing(value): number` (em `(-180, 180]`), `pointerAngle(dx, dy): number` (graus no sentido horário a partir do topo), `shortestDelta(from, to): number` (em `(-180, 180]`), `bearingFromDrag(startBearing, startAngle, currentAngle): number`, `bearingLabel(value): string` (N, NE, L, SE, S, SO, O, NO)
  - `components/map/RotationControl.tsx`: `RotationControl({ map }: { map: maplibregl.Map | null })`

- [ ] **Step 1: Testes da matemática (falham)**

`tests/unit/mapRotation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  bearingFromDrag,
  bearingLabel,
  normalizeBearing,
  pointerAngle,
  shortestDelta,
  toSignedBearing,
} from "@lib/mapRotation";

describe("pointerAngle", () => {
  it("mede em graus no sentido horário a partir do topo", () => {
    expect(pointerAngle(0, -10)).toBe(0);
    expect(pointerAngle(10, 0)).toBe(90);
    expect(pointerAngle(0, 10)).toBe(180);
    expect(pointerAngle(-10, 0)).toBe(270);
  });
});

describe("normalizeBearing / toSignedBearing", () => {
  it("normaliza para [0, 360) e (-180, 180]", () => {
    expect(normalizeBearing(-90)).toBe(270);
    expect(normalizeBearing(720)).toBe(0);
    expect(normalizeBearing(-0)).toBe(0);
    expect(toSignedBearing(270)).toBe(-90);
    expect(toSignedBearing(-180)).toBe(180);
  });
});

describe("shortestDelta", () => {
  it("escolhe o menor caminho, atravessando 0°/360°", () => {
    expect(shortestDelta(350, 10)).toBe(20);
    expect(shortestDelta(10, 350)).toBe(-20);
  });
});

describe("bearingFromDrag", () => {
  it("arrastar no sentido horário gira o mapa no sentido horário (bearing diminui)", () => {
    expect(bearingFromDrag(0, 0, 90)).toBe(-90);
  });

  it("não salta ao começar o arraste", () => {
    expect(bearingFromDrag(37, 200, 200)).toBe(37);
  });

  it("atravessa a marca de 0°/360° sem salto", () => {
    expect(bearingFromDrag(10, 350, 5)).toBe(-5);
  });

  it("mantém o resultado em (-180, 180]", () => {
    expect(bearingFromDrag(170, 0, 270)).toBe(-100);
  });
});

describe("bearingLabel", () => {
  it("usa os pontos cardeais em português", () => {
    expect(bearingLabel(0)).toBe("N");
    expect(bearingLabel(90)).toBe("L");
    expect(bearingLabel(-90)).toBe("O");
    expect(bearingLabel(135)).toBe("SE");
    expect(bearingLabel(225)).toBe("SO");
    expect(bearingLabel(359)).toBe("N");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/unit/mapRotation.test.ts`
Expected: FAIL — `@lib/mapRotation` inexistente.

- [ ] **Step 3: Criar `lib/mapRotation.ts`**

```ts
// Matemática do controle de rotação do mapa.
// Bearing do MapLibre: direção da bússola que fica no topo da tela (90 = leste em cima).

export const ROTATION_STEP_BUTTON = 45;
export const ROTATION_STEP_KEY = 15;

const LABELS = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];

export function normalizeBearing(value: number): number {
  const normalized = value % 360;
  return (normalized < 0 ? normalized + 360 : normalized) + 0;
}

export function toSignedBearing(value: number): number {
  const normalized = normalizeBearing(value);
  return normalized > 180 ? normalized - 360 : normalized;
}

export function pointerAngle(dx: number, dy: number): number {
  return normalizeBearing((Math.atan2(dx, -dy) * 180) / Math.PI);
}

export function shortestDelta(from: number, to: number): number {
  const delta = normalizeBearing(to - from);
  return delta > 180 ? delta - 360 : delta;
}

// Arrasto relativo: o mapa gira o mesmo ângulo que o ponteiro percorreu, no mesmo sentido.
export function bearingFromDrag(startBearing: number, startAngle: number, currentAngle: number): number {
  return toSignedBearing(startBearing - shortestDelta(startAngle, currentAngle));
}

export function bearingLabel(value: number): string {
  return LABELS[Math.round(normalizeBearing(value) / 45) % LABELS.length];
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/unit/mapRotation.test.ts`
Expected: PASS.

- [ ] **Step 5: Criar `components/map/RotationControl.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotateLeft, faRotateRight, faXmark } from "@fortawesome/free-solid-svg-icons";
import {
  bearingFromDrag,
  bearingLabel,
  normalizeBearing,
  pointerAngle,
  ROTATION_STEP_BUTTON,
  ROTATION_STEP_KEY,
} from "@lib/mapRotation";

type Props = { map: MapLibreMap | null };

type DragState = { pointerId: number; startAngle: number; startBearing: number };

const ROSE_MARKS = [
  { label: "N", angle: 0, className: "text-rose-300" },
  { label: "L", angle: 90, className: "text-white/75" },
  { label: "S", angle: 180, className: "text-white/75" },
  { label: "O", angle: 270, className: "text-white/75" },
];

function NeedleIcon({ bearing }: { bearing: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      style={{ transform: `rotate(${-bearing}deg)` }}
      aria-hidden="true"
    >
      <path d="M12 2 L16 12 L8 12 Z" fill="#f87171" />
      <path d="M12 22 L8 12 L16 12 Z" fill="#e2e8f0" />
      <circle cx="12" cy="12" r="1.6" fill="#0f172a" />
    </svg>
  );
}

export default function RotationControl({ map }: Props) {
  const [open, setOpen] = useState(false);
  const [bearing, setBearing] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dialRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingBearingRef = useRef<number | null>(null);

  // Só este componente re-renderiza durante a rotação, no máximo uma vez por quadro.
  useEffect(() => {
    if (!map) return;
    let raf: number | null = null;
    const sync = () => {
      if (raf !== null) return;
      raf = window.requestAnimationFrame(() => {
        raf = null;
        setBearing(map.getBearing());
      });
    };

    setBearing(map.getBearing());
    map.on("rotate", sync);
    return () => {
      map.off("rotate", sync);
      if (raf !== null) window.cancelAnimationFrame(raf);
    };
  }, [map]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    },
    []
  );

  const scheduleBearing = useCallback(
    (value: number) => {
      if (!map) return;
      pendingBearingRef.current = value;
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        const next = pendingBearingRef.current;
        pendingBearingRef.current = null;
        if (next !== null) map.setBearing(next);
      });
    },
    [map]
  );

  const angleAt = useCallback((clientX: number, clientY: number) => {
    const dial = dialRef.current;
    if (!dial) return 0;
    const rect = dial.getBoundingClientRect();
    return pointerAngle(clientX - (rect.left + rect.width / 2), clientY - (rect.top + rect.height / 2));
  }, []);

  const rotateBy = useCallback(
    (delta: number) => {
      if (!map) return;
      map.easeTo({ bearing: map.getBearing() + delta, duration: 250 });
    },
    [map]
  );

  const resetNorth = useCallback(() => {
    map?.easeTo({ bearing: 0, duration: 300 });
  }, [map]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!map || event.button !== 0) return;
    event.preventDefault();
    map.stop();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startAngle: angleAt(event.clientX, event.clientY),
      startBearing: map.getBearing(),
    };
    setDragging(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    scheduleBearing(bearingFromDrag(drag.startBearing, drag.startAngle, angleAt(event.clientX, event.clientY)));
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setDragging(false);
  }

  function handleLostCapture() {
    dragRef.current = null;
    setDragging(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      rotateBy(ROTATION_STEP_KEY);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      rotateBy(-ROTATION_STEP_KEY);
    } else if (event.key === "Home") {
      event.preventDefault();
      resetNorth();
    }
  }

  const heading = Math.round(normalizeBearing(bearing)) % 360;
  const label = bearingLabel(bearing);

  return (
    <div className="pointer-events-auto flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950/80 text-white shadow-lg ring-1 ring-white/10 backdrop-blur-sm hover:bg-slate-900/90"
        title={open ? "Fechar controle de rotação" : "Abrir controle de rotação"}
        aria-label={open ? "Fechar controle de rotação" : "Abrir controle de rotação"}
        aria-expanded={open}
      >
        <NeedleIcon bearing={bearing} />
      </button>

      {open && (
        <div
          role="group"
          aria-label="Rotação do mapa"
          className="relative w-[156px] rounded-[22px] bg-slate-950/90 p-3 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-md"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
            title="Fechar controle"
            aria-label="Fechar controle"
          >
            <FontAwesomeIcon icon={faXmark} className="h-3 w-3" />
          </button>

          <div className="pr-6 text-[10px] uppercase tracking-[0.18em] text-white/50">Rotação</div>
          <div className="pr-6 text-xs font-semibold text-white/85">
            {heading}° · {label}
          </div>

          <div className="mt-3 flex justify-center">
            <div
              ref={dialRef}
              role="slider"
              tabIndex={0}
              aria-label="Orientação do mapa"
              aria-valuemin={0}
              aria-valuemax={359}
              aria-valuenow={heading}
              aria-valuetext={`${heading} graus, ${label}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onLostPointerCapture={handleLostCapture}
              onKeyDown={handleKeyDown}
              title="Arraste o anel para girar o mapa"
              className={`relative h-[112px] w-[112px] touch-none select-none rounded-full border border-white/10 outline-none
                bg-[radial-gradient(circle_at_30%_30%,rgba(148,163,184,0.22),rgba(71,85,105,0.35)_45%,rgba(2,6,23,0.96)_100%)]
                shadow-[inset_0_10px_22px_rgba(255,255,255,0.10),inset_0_-14px_24px_rgba(0,0,0,0.58)]
                focus-visible:ring-2 focus-visible:ring-sky-400
                ${dragging ? "cursor-grabbing ring-2 ring-sky-400/60" : "cursor-grab"}`}
            >
              <div className="pointer-events-none absolute inset-0" style={{ transform: `rotate(${-bearing}deg)` }}>
                {ROSE_MARKS.map((mark) => (
                  <span
                    key={mark.label}
                    className={`absolute left-1/2 top-1/2 text-[11px] font-semibold ${mark.className}`}
                    style={{
                      transform: `translate(-50%, -50%) rotate(${mark.angle}deg) translateY(-42px) rotate(${-mark.angle}deg)`,
                    }}
                  >
                    {mark.label}
                  </span>
                ))}
              </div>
              <div className="pointer-events-none absolute inset-[30px] rounded-full border border-white/10 bg-black/30" />
              <div className="pointer-events-none absolute left-1/2 top-[3px] h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[7px] border-x-transparent border-t-sky-300" />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => rotateBy(ROTATION_STEP_BUTTON)}
              className="inline-flex h-8 items-center justify-center rounded-lg bg-white/10 text-sky-200 hover:bg-white/20"
              title="Girar 45° no sentido anti-horário"
              aria-label="Girar 45° no sentido anti-horário"
            >
              <FontAwesomeIcon icon={faRotateLeft} className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={resetNorth}
              className="inline-flex h-8 items-center justify-center rounded-lg bg-white/10 text-xs font-semibold text-rose-200 hover:bg-white/20"
              title="Alinhar ao norte"
              aria-label="Alinhar ao norte"
            >
              N
            </button>
            <button
              type="button"
              onClick={() => rotateBy(-ROTATION_STEP_BUTTON)}
              className="inline-flex h-8 items-center justify-center rounded-lg bg-white/10 text-sky-200 hover:bg-white/20"
              title="Girar 45° no sentido horário"
              aria-label="Girar 45° no sentido horário"
            >
              <FontAwesomeIcon icon={faRotateRight} className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="mt-2 text-[10px] leading-snug text-white/50">
            Arraste o anel para girar. Com o anel selecionado, as setas giram 15° e Home volta ao norte.
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: `components/MapClient.tsx` — trocar o joystick pelo componente novo**

1. No import de ícones, remova `faCompass`, `faChevronUp`, `faChevronRight`, `faChevronDown` e `faChevronLeft`. Depois de `import { connectSSE } from "@services/sseClient";`, adicione:

```tsx
import RotationControl from "@components/map/RotationControl";
```

2. Remova a constante `const JOYSTICK_RADIUS = 26;` e as funções `normalizeBearing` e `getBearingLabel` (logo após `buildPopupContent`).

3. No estado, troque `const [bearing, setBearing] = useState(0);` por:

```tsx
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);
```

e remova `const [joystickActive, setJoystickActive] = useState(false);`, `const [joystickOpen, setJoystickOpen] = useState(false);`, `const joystickRef = ...`, `const joystickPointerIdRef = ...` e todo o `const syncBearing = useCallback(...)`.

4. Em `fitCity`, troque o objeto de opções do `fitBounds` por:

```tsx
    map.fitBounds(CITY_BOUNDS, {
      padding: 24,
      duration: animate ? 600 : 0,
      maxZoom: 13,
      // Sem bearing explícito o maplibre volta a rotação para 0°.
      bearing: map.getBearing(),
    });
```

5. No efeito que cria o mapa:
   - depois de `mapRef.current = map;` adicione `setMapInstance(map);`;
   - em `handleInitialLoad`, remova a linha `syncBearing();`;
   - remova `map.on("rotate", syncBearing);` e `map.off("rotate", syncBearing);`;
   - no cleanup, depois de `setMapReady(false);` adicione `setMapInstance(null);`;
   - troque o array de dependências `[fitCity, syncBearing]` por `[fitCity]`.

6. Em `fitPins`, troque o objeto de opções do `fitBounds` por:

```tsx
    map.fitBounds(bounds, {
      padding: 28,
      duration: 600,
      maxZoom: filtered.length === 1 ? 17 : 18,
      bearing: map.getBearing(),
    });
```

7. Remova todo o trecho que começa em `const handleBearingChange = useCallback(` e termina no fim do `const joystickVector = useMemo(...)` (inclui `resetBearing`, `setBearingPreset`, `updateBearingFromPointer`, `clearJoystickInteraction`, `handleJoystickPointerDown`, `handleJoystickPointerMove`, `finishJoystickInteraction`, `heading` e `headingLabel`).

8. No JSX, troque o bloco inteiro `<div className="pointer-events-none absolute left-4 top-4 z-[1005] flex flex-col gap-2"> ... </div>` (o botão da bússola e o painel do joystick, até antes de `<div className="absolute right-4 top-4 z-[1005] flex gap-2 pointer-events-none">`) por:

```tsx
      <div className="pointer-events-none absolute left-4 top-4 z-[1005]">
        <RotationControl map={mapReady ? mapInstance : null} />
      </div>
```

9. Textos PT-BR no mesmo arquivo:
   - `"Camada satelite indisponivel no momento. Mapa alterado para OSM."` → `"Camada de satélite indisponível no momento. O mapa foi alterado para OSM."`
   - `"Posicao selecionada"` → `"Posição selecionada"`
   - `"Latitude/Longitude invalidas."` → `"Latitude/longitude inválidas."`
   - `"Fora do intervalo geografico."` → `"Coordenadas fora do intervalo geográfico."`
   - `"Erro ao salvar."` → `"Não foi possível salvar o AP."`
   - `<div className="text-xs opacity-80">Pins</div>` → `<div className="text-xs opacity-80">Pinos</div>`
   - `<option value="sat">Satelite</option>` → `<option value="sat">Satélite</option>`
   - `placeholder="Descricao (opcional)"` → `placeholder="Descrição (opcional)"`
   - `Dica: clique no mapa com o modal aberto para preencher Lat/Lon.` → `Dica: com esta janela aberta, clique no mapa para preencher latitude e longitude.`
   - `<h3 className="text-lg font-semibold">Nova Antena</h3>` → `<h3 className="text-lg font-semibold">Nova antena</h3>`

- [ ] **Step 7: Testes, typecheck, lint e build**

Run: `npx vitest run && npx tsc --noEmit && npm run lint && npm run build`
Expected: tudo PASS; `grep -n "joystick\|syncBearing\|faCompass" components/MapClient.tsx` não encontra nada.

- [ ] **Step 8: Commit**

```bash
git add lib/mapRotation.ts tests/unit/mapRotation.test.ts components/map/RotationControl.tsx components/MapClient.tsx
git commit -m "fix(mapa): controle de rotação que acompanha o arraste e preserva a rotação nos enquadramentos" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

# Fase E — Revisão PT-BR

### Tarefa 18: Acentuação e pontuação nos textos restantes

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`, `app/(app)/filter-cluster/page.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/forgot-password/page.tsx`, `app/(auth)/reset-password/page.tsx`, `app/api/users/[id]/route.ts`, `lib/validatorsAuth.ts`, `components/PaginationControls.tsx`, `components/AntennaToolbar.tsx`, `components/Sidebar.tsx`, `components/Footer.tsx`

As telas reescritas nas tarefas anteriores (Configurações, Admin, Clientes, Ocorrências, mapa, topo, avisos) já saem corrigidas. Esta tarefa cobre o restante.

- [ ] **Step 1: Substituições exatas**

| Arquivo | Antes | Depois |
| --- | --- | --- |
| `app/(app)/dashboard/page.tsx` | `Distribuicao de status` | `Distribuição de status` |
| `app/(app)/dashboard/page.tsx` | `{variant === "donut" ? "Donut" : variant === "gauge" ? "Gauge" : "Radial"}` | `{variant === "donut" ? "Rosca" : variant === "gauge" ? "Medidor" : "Radial"}` |
| `app/(app)/filter-cluster/page.tsx` | `Pagina atual` | `Página atual` |
| `app/(app)/filter-cluster/page.tsx` | `UP nesta pagina` | `UP nesta página` |
| `app/(app)/filter-cluster/page.tsx` | `DOWN nesta pagina` | `DOWN nesta página` |
| `app/(app)/filter-cluster/page.tsx` | `Ultima atualizacao` | `Última atualização` |
| `app/(app)/filter-cluster/page.tsx` | `<th className="p-3 text-left">Acoes</th>` | `<th className="p-3 text-left">Ações</th>` |
| `app/(app)/filter-cluster/page.tsx` | `Toggle` (texto do botão) | `Alternar status` |
| `app/(auth)/login/page.tsx` | `"Credenciais invalidas."` | `"E-mail ou senha incorretos."` |
| `app/(auth)/login/page.tsx` | `"Sua conta esta bloqueada. Procure um administrador."` | `"Sua conta está bloqueada. Procure um administrador."` |
| `app/(auth)/login/page.tsx` | `"Sua conta esta suspensa temporariamente. Aguarde a liberacao ou contate um administrador."` | `"Sua conta está suspensa temporariamente. Aguarde a liberação ou fale com um administrador."` |
| `app/(auth)/login/page.tsx` | `"Falha de origem da requisicao. Recarregue a pagina e tente novamente."` | `"Falha de origem da requisição. Recarregue a página e tente novamente."` |
| `app/(auth)/login/page.tsx` | `"Sessao de seguranca invalida. Recarregue a pagina e tente novamente."` | `"Sessão de segurança inválida. Recarregue a página e tente novamente."` |
| `app/(auth)/login/page.tsx` | `"Nao foi possivel entrar agora."` (2 ocorrências) | `"Não foi possível entrar agora."` |
| `app/(auth)/login/page.tsx` | `placeholder="Email"` | `placeholder="E-mail"` |
| `app/(auth)/login/page.tsx` | `Solicite o acesso com um administrador.` | `Solicite o acesso a um administrador.` |
| `app/(auth)/forgot-password/page.tsx` | `"Nao foi possivel processar o pedido agora."` (2 ocorrências) | `"Não foi possível processar o pedido agora."` |
| `app/(auth)/forgot-password/page.tsx` | `"Se o email informado existir, enviaremos um link de redefinicao em instantes."` | `"Se o e-mail informado estiver cadastrado, enviaremos um link de redefinição em instantes."` |
| `app/(auth)/forgot-password/page.tsx` | `placeholder="Email"` | `placeholder="E-mail"` |
| `app/(auth)/reset-password/page.tsx` | `"Token de redefinicao ausente ou invalido."` | `"Link de redefinição ausente ou inválido."` |
| `app/(auth)/reset-password/page.tsx` | `"As senhas informadas nao coincidem."` | `"As senhas informadas não coincidem."` |
| `app/(auth)/reset-password/page.tsx` | `"O link de redefinicao e invalido ou expirou."` | `"O link de redefinição é inválido ou expirou."` |
| `app/(auth)/reset-password/page.tsx` | `"Nao foi possivel redefinir a senha."` (2 ocorrências) | `"Não foi possível redefinir a senha."` |
| `app/(auth)/reset-password/page.tsx` | `"Senha redefinida com sucesso. Voce ja pode entrar."` | `"Senha redefinida com sucesso. Você já pode entrar."` |
| `app/(auth)/reset-password/page.tsx` | `Defina uma nova senha para concluir a recuperacao de acesso.` | `Defina uma nova senha para concluir a recuperação de acesso.` |
| `app/(auth)/reset-password/page.tsx` | `Politica de senha` | `Política de senha` |
| `app/api/users/[id]/route.ts` | `"Informe uma data de suspensao valida."` | `"Informe uma data de suspensão válida."` |
| `app/api/users/[id]/route.ts` | `"A suspensao deve terminar no futuro."` | `"A suspensão deve terminar no futuro."` |
| `lib/validatorsAuth.ts` | `"Minimo de 12 caracteres."` | `"Mínimo de 12 caracteres."` |
| `lib/validatorsAuth.ts` | `"Pelo menos uma letra minuscula."` | `"Pelo menos uma letra minúscula."` |
| `lib/validatorsAuth.ts` | `"Pelo menos uma letra maiuscula."` | `"Pelo menos uma letra maiúscula."` |
| `lib/validatorsAuth.ts` | `"Pelo menos um numero."` | `"Pelo menos um número."` |
| `lib/validatorsAuth.ts` | `"Pelo menos um simbolo."` | `"Pelo menos um símbolo."` |
| `lib/validatorsAuth.ts` | `"A senha deve ter no minimo 12 caracteres."` | `"A senha deve ter no mínimo 12 caracteres."` |
| `lib/validatorsAuth.ts` | `"A senha pode ter no maximo 72 caracteres."` | `"A senha pode ter no máximo 72 caracteres."` |
| `lib/validatorsAuth.ts` | `"A senha deve conter ao menos uma letra minuscula."` | `"A senha deve conter ao menos uma letra minúscula."` |
| `lib/validatorsAuth.ts` | `"A senha deve conter ao menos uma letra maiuscula."` | `"A senha deve conter ao menos uma letra maiúscula."` |
| `lib/validatorsAuth.ts` | `"A senha deve conter ao menos um numero."` | `"A senha deve conter ao menos um número."` |
| `lib/validatorsAuth.ts` | `"A senha deve conter ao menos um simbolo."` | `"A senha deve conter ao menos um símbolo."` |
| `components/PaginationControls.tsx` | `aria-label="Primeira pagina"` | `aria-label="Primeira página"` |
| `components/PaginationControls.tsx` | `aria-label="Pagina anterior"` | `aria-label="Página anterior"` |
| `components/PaginationControls.tsx` | `aria-label="Proxima pagina"` | `aria-label="Próxima página"` |
| `components/PaginationControls.tsx` | `aria-label="Ultima pagina"` | `aria-label="Última página"` |
| `components/AntennaToolbar.tsx` | `>Pagina<` | `>Página<` |
| `components/Sidebar.tsx` | `"Usuario"` (todas as ocorrências) | `"Usuário"` |
| `components/Footer.tsx` | `dashboard e configuracoes.` | `dashboard e configurações.` |

- [ ] **Step 2: Varredura de sobras (deve sair vazia)**

Run:

```bash
grep -rnE "\b(Nao|nao|Configuracoes|configuracoes|Acoes|acoes|Descricao|Posicao|Rotacao|rotacao|Satelite|invalid[ao]s?|Usuario|usuario|usuarios|Politica|Observacoes|pendencias|Ola|voce|Voce|solicitacao|redefinicao|Redefinicao|minimo|maximo|numero|simbolo|minuscula|maiuscula|indisponivel|possivel|notificacao|Distribuicao|Pagina|pagina|Ultima|Proxima|Administracao|recuperacao|Sessao|requisicao|geografico|suspensao|liberacao|atualizacao)\b" app components lib --include=*.ts --include=*.tsx
grep -rnE "Fullscreen|\"Toggle\"|>Toggle<|Mudar para (Dark|Light)|network\$\{|>Pins<" app components --include=*.tsx
```

Expected: nenhuma linha. Se aparecer alguma, corrija com a mesma regra (acentuação padrão do português; termos técnicos mantidos como na seção Global Constraints) e rode de novo.

- [ ] **Step 3: Testes, typecheck, lint e build**

Run: `npx vitest run && npx tsc --noEmit && npm run lint && npm run build`
Expected: tudo PASS (os testes não dependem dos textos alterados nesta tarefa).

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/dashboard/page.tsx" "app/(app)/filter-cluster/page.tsx" "app/(auth)/login/page.tsx" "app/(auth)/forgot-password/page.tsx" "app/(auth)/reset-password/page.tsx" "app/api/users/[id]/route.ts" lib/validatorsAuth.ts components/PaginationControls.tsx components/AntennaToolbar.tsx components/Sidebar.tsx components/Footer.tsx
git commit -m "fix(ptbr): acentuação e pontuação nos textos da interface" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

# Fase F — Verificação de ponta a ponta

### Tarefa 19: Banco e SMTP isolados, GWN real (só leitura), fluxos completos

Ambiente isolado: MySQL 8.4 na porta `3399` e Mailpit (captura todo e-mail; nada sai para a internet). O GWN real é consultado só para leitura. Nenhum container de outro projeto é tocado.

`<scratchpad>` nos comandos abaixo é o diretório temporário da sessão (fora do repositório); troque pelo caminho real antes de rodar. Rode tudo em Git Bash a partir da raiz do repositório.

**Files:**
- Create (fora do repositório, no scratchpad): `e2e.env`
- Nenhuma alteração de código, a menos que um passo falhe (nesse caso, corrigir com TDD na tarefa dona do código e repetir o passo).

- [ ] **Step 1: Subir MySQL e Mailpit isolados**

```bash
docker run -d --name statsap-e2e-mysql -e MYSQL_ROOT_PASSWORD=e2e-root -e MYSQL_DATABASE=statsap_e2e -e MYSQL_USER=statsap -e MYSQL_PASSWORD=e2e-pass -p 127.0.0.1:3399:3306 mysql:8.4 --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
docker run -d --name statsap-e2e-mailpit -p 127.0.0.1:8025:8025 -p 127.0.0.1:1025:1025 axllent/mailpit --smtp-auth-accept-any --smtp-auth-allow-insecure
```

Aguarde até `docker exec statsap-e2e-mysql mysqladmin ping -h 127.0.0.1 -uroot -pe2e-root --silent` responder `mysqld is alive`.

- [ ] **Step 2: Variáveis do ambiente de teste**

Crie `<scratchpad>/e2e.env`:

```
DATABASE_URL=mysql://statsap:e2e-pass@127.0.0.1:3399/statsap_e2e
NODE_ENV=development
COOKIE_SECURE=false
APP_URL=http://localhost:3300
NEXT_PUBLIC_APP_URL=http://localhost:3300
JWT_SECRET=e2e-jwt-secret-com-mais-de-32-caracteres-123
INTERNAL_API_KEY=e2e-internal-key-com-mais-de-24-caracteres
EMAIL_TRANSPORT_DEFAULT_HOST=127.0.0.1
EMAIL_TRANSPORT_DEFAULT_PORT=1025
EMAIL_TRANSPORT_DEFAULT_USERNAME=e2e
EMAIL_TRANSPORT_DEFAULT_PASSWORD=e2e
EMAIL_TRANSPORT_DEFAULT_TLS=false
EMAIL_DEFAULT_FROM=noreply@statsap.test
SUPERADMIN_EMAIL=admin@statsap.test
SUPERADMIN_PASSWORD=E2e-Admin-Pass#2026
SUPERADMIN_NAME=Admin E2E
SUPERADMIN_PROMOTE_IF_EXISTS=true
INCIDENT_ALERT_MIN_MINUTES=1
TRUST_PROXY_HEADERS=false
```

As credenciais `GDMS_*` vêm do `.env` do projeto (o `next dev` carrega o `.env` só para chaves que não estão no ambiente; as acima têm prioridade).

- [ ] **Step 3: Schema, migração idempotente e seed**

```bash
set -a; source <scratchpad>/e2e.env; set +a
node scripts/init-db.mjs && node scripts/init-db.mjs && node scripts/seed-superadmin.mjs
docker exec statsap-e2e-mysql mysql -ustatsap -pe2e-pass statsap_e2e -e "SHOW TABLES; SELECT * FROM SchemaMigration;"
```

Expected: a segunda execução não falha; existem `UserInvite`, `Incident`, `IncidentEvent`, `SchemaMigration`; `incident_backfill_v1` registrado uma vez.

- [ ] **Step 4: Subir a aplicação**

Em background: `set -a; source <scratchpad>/e2e.env; set +a; npx next dev -p 3300`. Aguarde `curl -s http://localhost:3300/api/health` responder `200`.

- [ ] **Step 5: Sync completo contra o GWN real e conferência das posições**

```bash
curl -s -X POST -H "x-internal-api-key: $INTERNAL_API_KEY" http://localhost:3300/api/integrations/gdms/sync > <scratchpad>/sync-full.json
node -e "const s=require(process.argv[1]);console.log({ok:s.ok,networks:s.networks,totalFetched:s.totalFetched,created:s.created,withoutCoords:s.withoutCoords,errors:s.errors.length})" <scratchpad>/sync-full.json
docker exec statsap-e2e-mysql mysql -ustatsap -pe2e-pass statsap_e2e -e "SELECT SUM(lat<>0 AND lon<>0) AS posicionados, SUM(lat=0 AND lon=0) AS sem_posicao, COUNT(*) AS total FROM Antenna;"
```

Expected: `ok: true`, cerca de 604 criados, `posicionados` ≈ 589 e `sem_posicao` ≈ 15 (os números exatos podem variar com o inventário do GWN).

Depois, simule posição manual errada e confira que o GWN vence:

```bash
docker exec statsap-e2e-mysql mysql -ustatsap -pe2e-pass statsap_e2e -e "UPDATE Antenna SET lat=-1, lon=-1 WHERE lat<>0 ORDER BY id LIMIT 3;"
curl -s -X POST -H "x-internal-api-key: $INTERNAL_API_KEY" "http://localhost:3300/api/integrations/gdms/sync?mode=status" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const s=JSON.parse(d);console.log({ok:s.ok,coordsUpdated:s.coordsUpdated,created:s.created})})"
```

Expected: `coordsUpdated: 3`, `created: 0`.

- [ ] **Step 6: Login, /clients com cache e sessão**

```bash
JAR=<scratchpad>/admin.cookies
curl -s -c $JAR -H "Origin: http://localhost:3300" -H "Content-Type: application/json" -d '{"email":"admin@statsap.test","password":"E2e-Admin-Pass#2026"}' http://localhost:3300/api/auth/login
CSRF=$(grep csrf $JAR | awk '{print $7}')
curl -s -b $JAR http://localhost:3300/api/stats/network-clients | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const s=JSON.parse(d);console.log({source:s.source,totalClients:s.totalClients,generatedAt:s.generatedAt})})"
curl -s -b $JAR http://localhost:3300/api/stats/network-clients | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).generatedAt))"
```

Expected: `source: "client/list"`; o `generatedAt` da segunda chamada é igual ao da primeira (cache de 60 s).

- [ ] **Step 7: Ocorrência ponta a ponta (queda → alerta → volta → aviso)**

```bash
H=(-b $JAR -H "Origin: http://localhost:3300" -H "x-csrf-token: $CSRF" -H "Content-Type: application/json")
ID=$(curl -s "${H[@]}" -d '{"name":"AP Teste E2E","lat":-22.43,"lon":-46.95}' http://localhost:3300/api/antennas | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).item.id))")
curl -s "${H[@]}" -X PATCH -d '{"status":"UP"}' http://localhost:3300/api/antennas/$ID > /dev/null
curl -s "${H[@]}" -X PATCH -d '{"status":"DOWN"}' http://localhost:3300/api/antennas/$ID > /dev/null
curl -s -b $JAR "http://localhost:3300/api/incidents?q=AP%20Teste%20E2E"
```

Expected: uma ocorrência `OPEN` para "AP Teste E2E".

Aguarde mais de 1 minuto (`INCIDENT_ALERT_MIN_MINUTES=1`) e rode um ciclo do worker:

```bash
curl -s -X POST -H "x-internal-api-key: $INTERNAL_API_KEY" "http://localhost:3300/api/integrations/gdms/sync?mode=status" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).alerts))"
curl -s "http://localhost:8025/api/v1/messages" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).messages.map(m=>m.Subject)))"
```

Expected: `alerts.downSent >= 1` e um e-mail `[Stats A.P] N AP(s) offline` no Mailpit (o N inclui os APs reais que estão offline no GWN).

Volte o AP e rode outro ciclo:

```bash
curl -s "${H[@]}" -X PATCH -d '{"status":"UP"}' http://localhost:3300/api/antennas/$ID > /dev/null
curl -s -X POST -H "x-internal-api-key: $INTERNAL_API_KEY" "http://localhost:3300/api/integrations/gdms/sync?mode=status" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).alerts))"
INC=$(curl -s -b $JAR "http://localhost:3300/api/incidents?status=ALL&q=AP%20Teste%20E2E" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).items[0].id))")
curl -s -b $JAR http://localhost:3300/api/incidents/$INC | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const i=JSON.parse(d).item;console.log(i.status,i.resolution,i.events.map(e=>e.type))})"
```

Expected: `alerts.recoverySent >= 1`; ocorrência `RESOLVED AUTO_RECOVERED` com eventos `OPENED, ALERT_SENT, RECOVERED, AUTO_RESOLVED, RECOVERY_ALERT_SENT`; e-mail `[Stats A.P] N AP(s) normalizado(s)` no Mailpit.

Tratativa manual: derrube de novo, assuma e resolva:

```bash
curl -s "${H[@]}" -X PATCH -d '{"status":"DOWN"}' http://localhost:3300/api/antennas/$ID > /dev/null
INC2=$(curl -s -b $JAR "http://localhost:3300/api/incidents?q=AP%20Teste%20E2E" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).items[0].id))")
curl -s "${H[@]}" -d '{"action":"START"}' http://localhost:3300/api/incidents/$INC2/actions > /dev/null
curl -s "${H[@]}" -d '{"action":"RESOLVE","message":"ok"}' http://localhost:3300/api/incidents/$INC2/actions
curl -s "${H[@]}" -d '{"action":"RESOLVE","message":"Fonte PoE substituída no poste"}' http://localhost:3300/api/incidents/$INC2/actions | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const i=JSON.parse(d).item;console.log(i.status,i.resolution,i.resolvedByName)})"
```

Expected: a resolução com "ok" responde `400 MESSAGE_REQUIRED`; a segunda responde `RESOLVED MANUAL Admin E2E`.

- [ ] **Step 8: Convite ponta a ponta e revogação de sessão**

```bash
curl -s "${H[@]}" -d '{"email":"convidado@statsap.test","role":"USER"}' http://localhost:3300/api/users/invites
TOKEN=$(curl -s "http://localhost:8025/api/v1/messages" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const m=JSON.parse(d).messages.find(x=>x.Subject.startsWith('Convite'));console.log(m.ID)})" | xargs -I{} curl -s "http://localhost:8025/api/v1/message/{}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).Text.match(/token=([0-9a-f]{64})/)[1]))")
curl -s "http://localhost:3300/api/auth/invite?token=$TOKEN"
GUEST=<scratchpad>/guest.cookies
curl -s -c $GUEST -H "Origin: http://localhost:3300" -H "Content-Type: application/json" -d "{\"token\":\"$TOKEN\",\"name\":\"Convidado E2E\",\"password\":\"Convidado-Pass#2026\"}" http://localhost:3300/api/auth/accept-invite
curl -s -H "Origin: http://localhost:3300" -H "Content-Type: application/json" -d "{\"token\":\"$TOKEN\",\"name\":\"Outro\",\"password\":\"Convidado-Pass#2026\"}" http://localhost:3300/api/auth/accept-invite
curl -s -b $GUEST http://localhost:3300/api/me
```

Expected: o GET devolve `email: convidado@statsap.test`; o primeiro aceite responde `ok: true` com cookies; o segundo responde `400 INVALID_INVITE`; `/api/me` do convidado mostra `role: USER`.

Bloqueie o convidado e confirme que a sessão cai na hora:

```bash
GID=$(curl -s -b $GUEST http://localhost:3300/api/me | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).user.id))")
curl -s "${H[@]}" -X PATCH -d '{"action":"BLOCK"}' http://localhost:3300/api/users/$GID > /dev/null
curl -s -i -b $GUEST http://localhost:3300/api/me | grep -iE "^HTTP|set-cookie|SESSION_REVOKED"
```

Expected: `HTTP/1.1 401`, `set-cookie: auth=; ... Max-Age=0` e corpo com `SESSION_REVOKED`.

- [ ] **Step 9: Conferência visual no navegador (http://localhost:3300, logado como admin)**

- Mapa: os APs aparecem posicionados; o controle de rotação gira no mesmo sentido do arraste, sem salto ao tocar, com o "N" do anel apontando para o norte real; "Cidade" e "Pinos" não desfazem a rotação.
- Configurações: só os APs sem posição no GWN; "Sincronizar GDMS" mostra o painel de resumo.
- Clientes: título "Clientes conectados por rede" e totais coerentes com o GWN.
- Ocorrências: lista, filtros, painel com linha do tempo; "Assumir tratativa", "Comentar" e "Resolver" funcionam.
- Sino: contador de não lidas, lista e "Marcar como lidas".
- Admin: "Convidar usuário", convites pendentes com Reenviar/Revogar.
- `/accept-invite?token=invalido` mostra a mensagem de convite inválido.
- Textos com acentuação em todas as telas visitadas.

Se não houver ferramenta de navegador disponível na sessão, peça ao usuário para conferir esta lista.

- [ ] **Step 10: Verificação final e limpeza**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
docker rm -f statsap-e2e-mysql statsap-e2e-mailpit
```

Encerre o `next dev` em background. Expected: todos os comandos sem erro; containers removidos.

- [ ] **Step 11: Registrar o resultado**

Não há commit de código nesta tarefa. Registre no resumo final os números observados (APs, posicionados, sem posição, clientes, e-mails capturados) e qualquer divergência encontrada.

---

## Execução

Após a última tarefa: revisão de todo o branch (superpowers:requesting-code-review) e encerramento (superpowers:finishing-a-development-branch).
