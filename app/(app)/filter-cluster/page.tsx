"use client";

import { useEffect, useMemo, useState } from "react";
import AntennaToolbar from "@components/AntennaToolbar";
import PaginationControls from "@components/PaginationControls";
import { toCSV } from "@lib/csv";
import {
  api,
  type Antenna,
  type AntennaListResponse,
  type AntennaNetworksResponse,
} from "@services/api";
import { connectSSE } from "@services/sseClient";

type Role = "SUPERADMIN" | "ADMIN" | "USER";
type MeResponse =
  | { ok: true; user: { id: string | number; name: string; email: string; role: Role } }
  | { ok: false; error: string };

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
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (query.trim()) params.set("q", query.trim());
  if (network) params.set("network", network);
  return `/api/antennas?${params.toString()}`;
}

function formatCoordinate(value: Antenna["lat"] | Antenna["lon"]) {
  if (typeof value === "number") return value.toFixed(5);
  if (typeof value === "string" && value.trim()) return value;
  return "-";
}

function formatUpdatedAt(value: Antenna["updatedAt"]) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

function mapExportRows(items: Antenna[]) {
  return items.map((antenna) => ({
    Nome: antenna.name,
    Rede: antenna.networkName ?? "",
    Latitude: formatCoordinate(antenna.lat),
    Longitude: formatCoordinate(antenna.lon),
    Status: antenna.status,
    AtualizadoEm: antenna.updatedAt ? new Date(antenna.updatedAt).toISOString() : "",
  }));
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function FilterClusterPage() {
  const [items, setItems] = useState<Antenna[]>([]);
  const [networks, setNetworks] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [network, setNetwork] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const canManage = role === "ADMIN" || role === "SUPERADMIN";

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

    async function loadAuxiliaryData() {
      try {
        const [meResponse, networksResponse] = await Promise.all([
          fetch("/api/me", { cache: "no-store" }),
          api<AntennaNetworksResponse>("/api/antennas/networks"),
        ]);

        const meJson: MeResponse = await meResponse.json();
        if (!alive) return;

        if (meJson.ok) setRole(meJson.user.role);
        else setRole(null);
        setNetworks(networksResponse.items ?? []);
      } catch {
        if (alive) {
          setRole(null);
          setNetworks([]);
        }
      }
    }

    loadAuxiliaryData();
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

  async function toggleStatus(antenna: Antenna) {
    const next = antenna.status === "UP" ? "DOWN" : "UP";
    await api(`/api/antennas/${antenna.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: next }),
    });
    setRefreshKey((value) => value + 1);
  }

  async function removeAntenna(antenna: Antenna) {
    if (!confirm(`Excluir ${antenna.name}?`)) return;
    await api(`/api/antennas/${antenna.id}`, { method: "DELETE" });
    if (items.length === 1 && page > 1) setPage(page - 1);
    else setRefreshKey((value) => value + 1);
  }

  async function fetchAllFilteredItems() {
    const collected: Antenna[] = [];
    let exportPage = 1;
    let exportTotalPages = 1;

    while (exportPage <= exportTotalPages) {
      const response = await api<AntennaListResponse>(
        buildPath({ page: exportPage, pageSize: 1000, query, network })
      );
      collected.push(...(response.items ?? []));
      exportTotalPages = response.totalPages ?? 1;
      exportPage += 1;
    }

    return collected;
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const rows = mapExportRows(await fetchAllFilteredItems());
      const csv = toCSV(rows);
      downloadBlob(
        "filtros-cluster-aps.csv",
        new Blob([csv], { type: "text/csv;charset=utf-8" })
      );
    } finally {
      setExporting(false);
    }
  }

  const summary = useMemo(() => {
    const up = items.filter((item) => item.status === "UP").length;
    const down = items.filter((item) => item.status === "DOWN").length;
    return { up, down };
  }, [items]);

  return (
    <div className="space-y-4">
      <AntennaToolbar
        title="Filtros Cluster & APs"
        description="Tela operacional para localizar APs por nome ou cluster e exportar os resultados em CSV."
        query={query}
        network={network}
        networks={networks}
        pageSize={pageSize}
        totalCount={totalCount}
        queryPlaceholder="Filtrar por AP ou rede..."
        exporting={exporting}
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
        onExportCsv={exportCsv}
      />

      <section className="grid gap-3 md:grid-cols-3">
        <article className="glass rounded-2xl p-4">
          <div className="text-xs uppercase tracking-[0.18em] opacity-60">Página atual</div>
          <div className="mt-2 text-3xl font-semibold">{items.length}</div>
        </article>
        <article className="glass rounded-2xl p-4">
          <div className="text-xs uppercase tracking-[0.18em] opacity-60">UP nesta página</div>
          <div className="mt-2 text-3xl font-semibold text-emerald-500">{summary.up}</div>
        </article>
        <article className="glass rounded-2xl p-4">
          <div className="text-xs uppercase tracking-[0.18em] opacity-60">DOWN nesta página</div>
          <div className="mt-2 text-3xl font-semibold text-rose-500">{summary.down}</div>
        </article>
      </section>

      <section className="glass rounded-3xl p-5">
        <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-black/5 dark:bg-white/10">
              <tr>
                <th className="p-3 text-left">Nome</th>
                <th className="p-3 text-left">Rede</th>
                <th className="p-3 text-left">Latitude</th>
                <th className="p-3 text-left">Longitude</th>
                <th className="p-3 text-left">Última atualização</th>
                <th className="p-3 text-left">Status</th>
                {canManage && <th className="p-3 text-left">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className="p-4 text-center opacity-60">
                    Carregando...
                  </td>
                </tr>
              )}

              {!loading &&
                items.map((antenna) => (
                  <tr
                    key={String(antenna.id)}
                    className="border-t border-black/10 dark:border-white/10"
                  >
                    <td className="p-3">{antenna.name}</td>
                    <td className="p-3">{antenna.networkName ?? "-"}</td>
                    <td className="p-3">{formatCoordinate(antenna.lat)}</td>
                    <td className="p-3">{formatCoordinate(antenna.lon)}</td>
                    <td className="p-3 text-xs opacity-70">{formatUpdatedAt(antenna.updatedAt)}</td>
                    <td className="p-3">
                      <span
                        className={
                          antenna.status === "UP"
                            ? "font-medium text-emerald-600 dark:text-emerald-300"
                            : "font-medium text-rose-600 dark:text-rose-300"
                        }
                      >
                        {antenna.status}
                      </span>
                    </td>
                    {canManage && (
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => toggleStatus(antenna)}
                            className="rounded-xl bg-brand1 px-3 py-2 text-white transition hover:opacity-90"
                          >
                            Alternar status
                          </button>
                          <button
                            type="button"
                            onClick={() => removeAntenna(antenna)}
                            className="rounded-xl bg-rose-600 px-3 py-2 text-white transition hover:opacity-90"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}

              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className="p-4 text-center opacity-60">
                    Nenhum AP encontrado para os filtros atuais.
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
          itemLabel="APs"
        />
      </section>
    </div>
  );
}
