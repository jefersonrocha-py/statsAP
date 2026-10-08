import "server-only";

import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  planApUpdate,
  type ApSyncPlan,
  type LocalAntennaSnapshot,
  type SyncMode,
} from "@lib/gdmsSyncPlan";
import { processIncidentAlerts } from "@lib/incidentAlerts";
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
  alerts: { downSent: number; recoverySent: number };
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
    alerts: { downSent: 0, recoverySent: 0 },
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

// Os alertas dependem só do banco: rodam mesmo quando a leitura do GWN falha
// (senão uma instabilidade do GWN atrasaria o aviso das quedas já registradas).
// Uma falha aqui fica só no log e não derruba o sync.
async function runIncidentAlerts(): Promise<GdmsSyncSummary["alerts"]> {
  try {
    return await processIncidentAlerts(new Date());
  } catch (error) {
    console.error("runGdmsSync: falha ao processar alertas de ocorrência:", error);
    return { downSent: 0, recoverySent: 0 };
  }
}

export async function runGdmsSync(mode: SyncMode): Promise<GdmsSyncSummary> {
  const store = globalThis as SyncGlobal;
  if (store.__gdmsSyncRunning) throw new SyncInProgressError();

  store.__gdmsSyncRunning = true;
  try {
    let summary: GdmsSyncSummary;
    try {
      summary = await executeSync(mode);
    } catch (error) {
      await runIncidentAlerts();
      throw error;
    }
    summary.alerts = await runIncidentAlerts();
    return summary;
  } finally {
    store.__gdmsSyncRunning = false;
  }
}
