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
