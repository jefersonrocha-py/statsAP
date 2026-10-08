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
