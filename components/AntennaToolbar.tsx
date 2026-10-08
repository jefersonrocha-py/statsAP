"use client";

type Props = {
  title: string;
  description: string;
  query: string;
  network: string;
  networks: string[];
  pageSize: number;
  totalCount: number;
  queryPlaceholder: string;
  exporting?: boolean;
  extraAction?: React.ReactNode;
  onQueryChange: (value: string) => void;
  onNetworkChange: (value: string) => void;
  onPageSizeChange: (value: number) => void;
  onExportCsv?: () => void;
};

export default function AntennaToolbar({
  title,
  description,
  query,
  network,
  networks,
  pageSize,
  totalCount,
  queryPlaceholder,
  exporting = false,
  extraAction,
  onQueryChange,
  onNetworkChange,
  onPageSizeChange,
  onExportCsv,
}: Props) {
  const canExport = typeof onExportCsv === "function";

  return (
    <section className="glass space-y-4 rounded-3xl p-5">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="max-w-3xl text-sm opacity-75">{description}</p>
        </div>
        <div className="surface-soft rounded-2xl px-4 py-3 text-sm">
          <div className="opacity-70">Registros encontrados</div>
          <div className="text-2xl font-semibold">{totalCount}</div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(220px,1fr)_140px_auto]">
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-[0.18em] opacity-65">Buscar</span>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={queryPlaceholder}
            className="surface-field w-full rounded-2xl px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs uppercase tracking-[0.18em] opacity-65">Cluster / Rede</span>
          <select
            value={network}
            onChange={(event) => onNetworkChange(event.target.value)}
            className="surface-field w-full rounded-2xl px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
          >
            <option value="">Todas as redes</option>
            {networks.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs uppercase tracking-[0.18em] opacity-65">Página</span>
          <select
            value={String(pageSize)}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="surface-field w-full rounded-2xl px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} por página
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-end gap-2">
          {canExport && (
            <button
              type="button"
              onClick={onExportCsv}
              disabled={exporting}
              className="rounded-2xl bg-brand1 px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {exporting ? "Exportando..." : "Exportar CSV"}
            </button>
          )}
          {extraAction}
        </div>
      </div>
    </section>
  );
}
