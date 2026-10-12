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
            {isLoading ? "…" : fmtInt(totalClients)}
          </div>
          <div className="mt-1 text-xs opacity-70">
            {isLoading
              ? "Consultando o GWN…"
              : `${fmtInt(totalNetworks)} ${totalNetworks === 1 ? "rede" : "redes"}${
                  lastUpdatedLabel ? ` · Atualizado em ${lastUpdatedLabel}` : ""
                }`}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : items.length ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
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
