// components/DashboardCards.tsx
"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

type Props = {
  total: number;
  up: number;
  down: number;
  upPct: number;   // 0..100
  downPct: number; // 0..100
  connectedClients?: number | null;
  clientNetworks?: number | null;
  isLoading?: boolean;
  className?: string;

  /** Lista opcional para renderizar tabela paginada (50 por página por padrão) */
  items?: any[];
  pageSize?: number;

  /** Opcional: cabeçalho custom da tabela */
  renderHeader?: () => React.ReactNode;

  /** Opcional: como renderizar cada item (recebe item da página atual) */
  renderRow?: (item: any) => React.ReactNode;

  /** Opcional: rótulo acessível da tabela */
  tableAriaLabel?: string;
};

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function fmtInt(n: number) {
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("pt-BR").format(Math.round(n));
}
function fmtPct(n: number) {
  if (!Number.isFinite(n)) return "0,0%";
  const v = Math.max(0, Math.min(100, n));
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(v) + "%";
}

function Progress({ pct, color = "emerald" }: { pct: number; color?: "emerald" | "rose" | "cyan" }) {
  const bar =
    color === "emerald" ? "bg-emerald-500" : color === "rose" ? "bg-rose-500" : "bg-cyan-500";
  const width = `${Math.max(0, Math.min(100, pct))}%`;
  return (
    <div className="mt-2 h-2 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden" aria-hidden>
      <div className={cx("h-full", bar)} style={{ width }} />
    </div>
  );
}

function Card({
  title,
  value,
  sub,
  accent = "cyan",
  withProgress = false,
  progressPct = 0,
  "aria-label": ariaLabel,
}: {
  title: string;
  value: string;
  sub?: string;
  accent?: "green" | "red" | "cyan";
  withProgress?: boolean;
  progressPct?: number;
  "aria-label"?: string;
}) {
  const ring =
    accent === "green"
      ? "ring-1 ring-emerald-400/50"
      : accent === "red"
      ? "ring-1 ring-rose-400/50"
      : "ring-1 ring-cyan-400/50";

  return (
    <section
      className={cx("glass rounded-2xl p-4", ring, "min-h-[86px]")}
      role="group"
      aria-label={ariaLabel ?? title}
    >
      <div className="text-xs opacity-70">{title}</div>
      <motion.div
        className="text-3xl font-semibold tracking-tight mt-1"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 24 }}
      >
        {value}
      </motion.div>
      {sub && <div className="text-xs opacity-60 mt-1">{sub}</div>}
      {withProgress && (
        <Progress
          pct={progressPct}
          color={accent === "red" ? "rose" : accent === "green" ? "emerald" : "cyan"}
        />
      )}
    </section>
  );
}

function SkeletonCard() {
  return (
    <div className="glass rounded-2xl p-4 ring-1 ring-white/10 animate-pulse">
      <div className="h-3 w-16 bg-black/10 dark:bg-white/10 rounded" />
      <div className="h-8 w-24 bg-black/10 dark:bg-white/10 rounded mt-2" />
      <div className="h-3 w-20 bg-black/10 dark:bg-white/10 rounded mt-2" />
    </div>
  );
}

function DefaultHeader() {
  return (
    <tr>
      <th className="text-left p-2">Nome</th>
      <th className="text-left p-2">Rede</th>
      <th className="text-left p-2">Latitude</th>
      <th className="text-left p-2">Longitude</th>
      <th className="text-left p-2">Última atualização</th>
      <th className="text-left p-2">Status</th>
    </tr>
  );
}

function DefaultRow({ a }: { a: any }) {
  const latStr =
    typeof a?.lat === "number" ? a.lat.toFixed(5) : a?.lat != null ? String(a.lat) : "-";
  const lonStr =
    typeof a?.lon === "number" ? a.lon.toFixed(5) : a?.lon != null ? String(a.lon) : "-";
  const updatedStr =
    typeof a?.updatedAt === "string"
      ? new Date(a.updatedAt).toLocaleString()
      : a?.updatedAt
      ? new Date(a.updatedAt as any).toLocaleString()
      : "-";
  const status = a?.status ?? "-";
  return (
    <tr className="border-t border-black/10 dark:border-white/10">
      <td className="p-2">{a?.name ?? "-"}</td>
      <td className="p-2">{a?.networkName ?? "-"}</td>
      <td className="p-2">{latStr}</td>
      <td className="p-2">{lonStr}</td>
      <td className="p-2 text-xs opacity-70">{updatedStr}</td>
      <td className="p-2">
        <span className={status === "UP" ? "text-green-600" : status === "DOWN" ? "text-red-600" : ""}>
          {status}
        </span>
      </td>
    </tr>
  );
}

function Pagination({
  page,
  setPage,
  totalPages,
  totalItems,
  pageSize,
}: {
  page: number;
  setPage: (p: number) => void;
  totalPages: number;
  totalItems: number;
  pageSize: number;
}) {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="mt-3 flex flex-col md:flex-row items-center justify-between gap-2 text-sm">
      <div className="opacity-70">
        {totalItems === 0 ? "Nenhum item" : `Mostrando ${start}–${end} de ${totalItems}`}
      </div>
      <div className="flex items-center gap-1">
        <button
          className="px-2 py-1 rounded bg-black/5 dark:bg-white/10 disabled:opacity-50"
          onClick={() => setPage(1)}
          disabled={page <= 1}
          aria-label="Primeira página"
        >
          «
        </button>
        <button
          className="px-2 py-1 rounded bg-black/5 dark:bg-white/10 disabled:opacity-50"
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label="Página anterior"
        >
          ‹
        </button>
        <span className="px-2">
          Página <strong>{page}</strong> / {totalPages}
        </span>
        <button
          className="px-2 py-1 rounded bg-black/5 dark:bg-white/10 disabled:opacity-50"
          onClick={() => setPage(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          aria-label="Próxima página"
        >
          ›
        </button>
        <button
          className="px-2 py-1 rounded bg-black/5 dark:bg-white/10 disabled:opacity-50"
          onClick={() => setPage(totalPages)}
          disabled={page >= totalPages}
          aria-label="Última página"
        >
          »
        </button>
      </div>
    </div>
  );
}

function DashboardCardsInner({
  total,
  up,
  down,
  upPct,
  downPct,
  connectedClients,
  clientNetworks,
  isLoading,
  className,
  items,
  pageSize = 50,
  renderHeader,
  renderRow,
  tableAriaLabel = "Tabela de itens",
}: Props) {
  // Garantias/safe math
  const safe = useMemo(() => {
    const t = Math.max(0, Number(total) || 0);
    const u = Math.max(0, Number(up) || 0);
    const d = Math.max(0, Number(down) || 0);
    const upPctSafe = t > 0 ? (u / t) * 100 : 0;
    const downPctSafe = t > 0 ? (d / t) * 100 : 0;
    return {
      total: t,
      up: u,
      down: d,
      upPct: Number.isFinite(upPct) ? upPct : upPctSafe,
      downPct: Number.isFinite(downPct) ? downPct : downPctSafe,
    };
  }, [total, up, down, upPct, downPct]);

  const [page, setPage] = useState(1);

  // Reposiciona na página 1 se a lista ou pageSize mudar
  useEffect(() => {
    setPage(1);
  }, [items, pageSize]);

  const { pageItems, totalPages } = useMemo(() => {
    const all = Array.isArray(items) ? items : [];
    const tp = Math.max(1, Math.ceil(all.length / pageSize));
    const curr = Math.min(page, tp);
    const start = (curr - 1) * pageSize;
    const end = start + pageSize;
    return { pageItems: all.slice(start, end), totalPages: tp };
  }, [items, page, pageSize]);

  if (isLoading) {
    const skeletonCount = connectedClients !== undefined ? 5 : 4;
    return (
      <div className={cx("grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5", className)}>
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    );
  }

  const showConnectedClientsCard = connectedClients !== undefined;
  const clientSub =
    connectedClients === null
      ? "Atualizando leitura do GDMS"
      : clientNetworks && clientNetworks > 0
      ? `${fmtInt(clientNetworks)} ${clientNetworks === 1 ? "rede" : "redes"}`
      : "Visão geral do GDMS";

  return (
    <div className={cx("space-y-3", className)}>
      {/* Cards de métricas */}
      <div
        className={cx(
          "grid grid-cols-2 gap-3",
          showConnectedClientsCard ? "md:grid-cols-4 xl:grid-cols-5" : "md:grid-cols-4"
        )}
      >
        <Card
          title="Total"
          value={fmtInt(safe.total)}
          accent="cyan"
          aria-label={`Total de antenas: ${fmtInt(safe.total)}`}
        />
        <Card
          title="UP"
          value={fmtInt(safe.up)}
          sub={fmtPct(safe.upPct)}
          accent="green"
          aria-label={`Antenas UP: ${fmtInt(safe.up)} (${fmtPct(safe.upPct)})`}
        />
        <Card
          title="DOWN"
          value={fmtInt(safe.down)}
          sub={fmtPct(safe.downPct)}
          accent="red"
          aria-label={`Antenas DOWN: ${fmtInt(safe.down)} (${fmtPct(safe.downPct)})`}
        />
        <Card
          title="Disponibilidade"
          value={fmtPct(safe.upPct)}
          sub="(UP / Total)"
          accent="green"
          withProgress
          progressPct={safe.upPct}
          aria-label={`Disponibilidade: ${fmtPct(safe.upPct)}`}
        />
        {showConnectedClientsCard && (
          <Card
            title="Clientes Conectados"
            value={connectedClients === null ? "..." : fmtInt(connectedClients)}
            sub={clientSub}
            accent="cyan"
            aria-label={
              connectedClients === null
                ? "Clientes conectados em atualização"
                : `Clientes conectados: ${fmtInt(connectedClients)}`
            }
          />
        )}
      </div>

      {/* Tabela paginada (opcional) */}
      {Array.isArray(items) && (
        <div className="glass rounded-2xl p-3">
          <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
            <table className="w-full text-sm" aria-label={tableAriaLabel}>
              <thead className="bg-black/5 dark:bg-white/10">
                {renderHeader ? renderHeader() : <DefaultHeader />}
              </thead>
              <tbody>
                {pageItems.length > 0 ? (
                  pageItems.map((it, idx) =>
                    renderRow ? (
                      <FragmentRow key={(it?.id as any) ?? idx}>{renderRow(it)}</FragmentRow>
                    ) : (
                      <DefaultRow key={(it?.id as any) ?? idx} a={it} />
                    ),
                  )
                ) : (
                  <tr>
                    <td className="p-3 text-center opacity-60" colSpan={6}>
                      Nenhum item.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            setPage={setPage}
            totalPages={totalPages}
            totalItems={Array.isArray(items) ? items.length : 0}
            pageSize={pageSize}
          />
        </div>
      )}
    </div>
  );
}

// Garante uma <tr> válida quando usar renderRow retornando <tr>
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export default memo(DashboardCardsInner);
