"use client";

import { useEffect, useState } from "react";
import Client from "@components/Client";
import { api, type NetworkClientStatsResponse } from "@services/api";

export default function ClientsPage() {
  const [networkClientStats, setNetworkClientStats] = useState<NetworkClientStatsResponse | null>(null);
  const [networkClientError, setNetworkClientError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadClientStats() {
      try {
        const response = await api<NetworkClientStatsResponse>("/api/stats/network-clients");
        if (!active) return;
        setNetworkClientStats(response || null);
        setNetworkClientError(null);
      } catch {
        if (!active) return;
        setNetworkClientError("Não foi possível carregar os clientes por rede no GWN agora.");
      }
    }

    loadClientStats();
    const refreshTimer = window.setInterval(loadClientStats, 60_000);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, []);

  return (
    <div>
      <Client
        items={networkClientStats?.items ?? []}
        totalClients={networkClientStats?.totalClients ?? 0}
        totalNetworks={networkClientStats?.totalNetworks ?? 0}
        generatedAt={networkClientStats?.generatedAt ?? null}
        isLoading={!networkClientStats && !networkClientError}
        error={networkClientError}
      />
    </div>
  );
}
