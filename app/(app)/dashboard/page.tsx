"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardCards from "@components/DashboardCards";
import DonutChart from "@components/DonutChart";
import { api, type NetworkClientStatsResponse, type Stats } from "@services/api";
import { connectSSE } from "@services/sseClient";

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [networkClientStats, setNetworkClientStats] = useState<NetworkClientStatsResponse | null>(null);
  const [chartVariant, setChartVariant] = useState<"donut" | "gauge" | "radial">("donut");
  const [showLegend, setShowLegend] = useState(true);

  useEffect(() => {
    let active = true;

    // Os totais locais vêm do banco e chegam na hora; os clientes dependem do GWN (mais lento).
    // Carregados separadamente, os cards não ficam presos esperando o GWN.
    async function loadStats() {
      const statsResult = await api<Stats>("/api/stats").catch(() => null);
      if (active) setStats(statsResult || null);
    }

    async function loadClientStats() {
      const result = await api<NetworkClientStatsResponse>("/api/stats/network-clients").catch(() => null);
      if (active) setNetworkClientStats(result || null);
    }

    loadStats();
    loadClientStats();
    const refreshTimer = window.setInterval(() => {
      loadStats();
      loadClientStats();
    }, 60_000);

    const disconnect = connectSSE((event) => {
      try {
        const payload = JSON.parse(event.data);
        if (
          ["antenna.created", "antenna.updated", "antenna.deleted", "status.changed"].includes(
            payload.event
          )
        ) {
          loadStats();
        }
      } catch {}
    });

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      disconnect();
    };
  }, []);

  const cardsData = useMemo(() => {
    if (!stats) return null;

    const up = (stats.up ?? stats.online ?? 0) as number;
    const down = (stats.down ?? stats.offline ?? 0) as number;
    const inferredTotal = up + down + (stats.unknown ?? 0);
    const total = (stats.total ?? inferredTotal) as number;
    const denominator = total || inferredTotal || 1;

    return {
      total,
      up,
      down,
      unknown: stats.unknown ?? Math.max(0, total - up - down),
      upPct: Number(((up / denominator) * 100).toFixed(2)),
      downPct: Number(((down / denominator) * 100).toFixed(2)),
    };
  }, [stats]);

  return (
    <div className="space-y-4">
      <DashboardCards
        total={cardsData?.total ?? 0}
        up={cardsData?.up ?? 0}
        down={cardsData?.down ?? 0}
        upPct={cardsData?.upPct ?? 0}
        downPct={cardsData?.downPct ?? 0}
        connectedClients={networkClientStats?.totalClients ?? null}
        clientNetworks={networkClientStats?.totalNetworks ?? null}
        isLoading={!cardsData}
      />

      {cardsData && (
        <section className="glass space-y-4 rounded-3xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Distribuição de status</h2>
              <p className="text-sm opacity-70">
                Compare disponibilidade, indisponibilidade e volume total da base.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
                {(["donut", "gauge", "radial"] as const).map((variant) => (
                  <button
                    key={variant}
                    type="button"
                    onClick={() => setChartVariant(variant)}
                    className={`px-3 py-2 text-sm ${
                      chartVariant === variant
                        ? "bg-brand1 text-white"
                        : "bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20"
                    }`}
                    aria-pressed={chartVariant === variant}
                  >
                    {variant === "donut" ? "Rosca" : variant === "gauge" ? "Medidor" : "Radial"}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showLegend}
                  onChange={(event) => setShowLegend(event.target.checked)}
                />
                Mostrar legenda
              </label>
            </div>
          </div>

          <DonutChart
            up={cardsData.up}
            down={cardsData.down}
            unknown={cardsData.unknown}
            variant={chartVariant}
            showLegend={showLegend}
            height={300}
          />
        </section>
      )}
    </div>
  );
}
