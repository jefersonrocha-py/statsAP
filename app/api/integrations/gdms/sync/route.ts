import type { RowDataPacket } from "mysql2/promise";
import { NextResponse } from "next/server";
import { requireRequestAuthOrInternal } from "@lib/auth";
import { dbExecute, dbQueryOne, withTransaction } from "@lib/mysql";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@lib/rateLimit";
import { emit } from "@lib/sse";
import { listAPsByNetwork, listNetworks } from "@services/gdms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExistingAntennaRow = RowDataPacket & {
  id: number;
  name: string;
  status: string;
  lat: number;
  lon: number;
  networkName: string | null;
};

type SyncEvent =
  | {
      event: "antenna.created";
      payload: { id: number; name: string; networkName: string | null; status: string };
    }
  | {
      event: "antenna.updated";
      payload: { id: number; name: string; networkName: string | null; kind: "sync" };
    }
  | {
      event: "status.changed";
      payload: {
        id: number;
        name: string;
        networkName: string | null;
        previousStatus: string;
        status: string;
        at: string;
      };
    };

type SyncOutcome =
  | { kind: "created"; emitEvent: SyncEvent }
  | { kind: "updated"; statusChanged: boolean; emitEvent?: SyncEvent }
  | { kind: "skipped" };

export async function POST(req: Request) {
  try {
    const auth = await requireRequestAuthOrInternal(req, ["ADMIN", "SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    const rateLimit = checkRateLimit(req, "gdms-sync", {
      max: 2,
      windowMs: 15 * 60_000,
      key: "user" in auth ? auth.user.sub : `internal:${getClientIp(req)}`,
    });
    if (!rateLimit.ok) {
      return rateLimitResponse(rateLimit);
    }

    const { searchParams } = new URL(req.url);
    const statusOnly = searchParams.get("mode") === "status";
    const networks = await listNetworks();
    const now = new Date();

    let created = 0;
    let updated = 0;
    let statusChanged = 0;
    let totalFetched = 0;
    const perNetwork: Array<{ id: string; name: string; fetched: number }> = [];
    const errors: Array<{ apId: string; reason: string }> = [];

    for (const network of networks) {
      const aps = await listAPsByNetwork(network.id, network.networkName ?? "");
      perNetwork.push({ id: network.id, name: network.networkName ?? "", fetched: aps.length });
      totalFetched += aps.length;

      for (const ap of aps) {
        try {
          const outcome = await withTransaction<SyncOutcome>(async (connection) => {
            const existing = await dbQueryOne<ExistingAntennaRow>(
              "SELECT `id`, `name`, `status`, `lat`, `lon`, `networkName` FROM `Antenna` WHERE `gdmsApId` = ? LIMIT 1",
              [ap.apId],
              connection
            );

            if (statusOnly) {
              if (!existing) return { kind: "skipped" };

              const statusChangedNow = existing.status !== ap.status;
              const assignments = ["`status` = ?", "`lastSyncAt` = ?", "`updatedAt` = ?"];
              const values: Array<string | Date> = [ap.status, now, now];

              if (statusChangedNow) {
                assignments.push("`lastStatusChange` = ?");
                values.push(now);
              }

              values.push(ap.apId);
              await dbExecute(
                `UPDATE \`Antenna\` SET ${assignments.join(", ")} WHERE \`gdmsApId\` = ?`,
                values,
                connection
              );

              if (statusChangedNow) {
                await dbExecute(
                  "INSERT INTO `StatusHistory` (`antennaId`, `status`, `changedAt`) VALUES (?, ?, ?)",
                  [existing.id, ap.status, now],
                  connection
                );
              }

              return {
                kind: "updated",
                statusChanged: statusChangedNow,
                emitEvent: statusChangedNow
                  ? {
                      event: "status.changed",
                      payload: {
                        id: existing.id,
                        name: existing.name,
                        networkName: existing.networkName,
                        previousStatus: existing.status,
                        status: ap.status,
                        at: now.toISOString(),
                      },
                    }
                  : undefined,
              };
            }

            if (!existing) {
              const lat = ap.coords?.lat ?? 0;
              const lon = ap.coords?.lng ?? 0;
              const result = await dbExecute(
                "INSERT INTO `Antenna` (`name`, `description`, `lat`, `lon`, `status`, `gdmsApId`, `networkId`, `networkName`, `lastSyncAt`, `createdAt`, `updatedAt`) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                  ap.apName,
                  lat,
                  lon,
                  ap.status,
                  ap.apId,
                  ap.networkId,
                  ap.networkName,
                  now,
                  now,
                  now,
                ],
                connection
              );

              await dbExecute(
                "INSERT INTO `StatusHistory` (`antennaId`, `status`, `changedAt`) VALUES (?, ?, ?)",
                [result.insertId, ap.status, now],
                connection
              );

              return {
                kind: "created",
                emitEvent: {
                  event: "antenna.created",
                  payload: {
                    id: result.insertId,
                    name: ap.apName,
                    networkName: ap.networkName ?? null,
                    status: ap.status,
                  },
                },
              };
            }

            const statusChangedNow = existing.status !== ap.status;
            const nameChanged = existing.name !== ap.apName;
            const networkChanged = existing.networkName !== (ap.networkName ?? null);
            const coordsFilled =
              Number(existing.lat) === 0 &&
              Number(existing.lon) === 0 &&
              ap.coords !== null;
            const assignments = [
              "`name` = ?",
              "`networkId` = ?",
              "`networkName` = ?",
              "`status` = ?",
              "`lastSyncAt` = ?",
              "`updatedAt` = ?",
            ];
            const values: Array<string | number | Date> = [
              ap.apName,
              ap.networkId,
              ap.networkName,
              ap.status,
              now,
              now,
            ];

            if (statusChangedNow) {
              assignments.push("`lastStatusChange` = ?");
              values.push(now);
            }

            if (ap.coords) {
              assignments.push("`lat` = ?", "`lon` = ?");
              values.push(ap.coords.lat, ap.coords.lng);
            }

            values.push(existing.id);
            await dbExecute(
              `UPDATE \`Antenna\` SET ${assignments.join(", ")} WHERE \`id\` = ?`,
              values,
              connection
            );

            if (statusChangedNow) {
              await dbExecute(
                "INSERT INTO `StatusHistory` (`antennaId`, `status`, `changedAt`) VALUES (?, ?, ?)",
                [existing.id, ap.status, now],
                connection
              );
            }

            return {
              kind: "updated",
              statusChanged: statusChangedNow,
              emitEvent: statusChangedNow
                ? {
                    event: "status.changed",
                    payload: {
                      id: existing.id,
                      name: ap.apName,
                      networkName: ap.networkName ?? null,
                      previousStatus: existing.status,
                      status: ap.status,
                      at: now.toISOString(),
                    },
                  }
                : nameChanged || networkChanged || coordsFilled
                  ? {
                      event: "antenna.updated",
                      payload: {
                        id: existing.id,
                        name: ap.apName,
                        networkName: ap.networkName ?? null,
                        kind: "sync",
                      },
                    }
                  : undefined,
            };
          });

          if (outcome.kind === "created") {
            created++;
            emit(outcome.emitEvent.event, outcome.emitEvent.payload);
            continue;
          }

          if (outcome.kind === "updated") {
            updated++;
            if (outcome.statusChanged) statusChanged++;
            if (outcome.emitEvent) {
              emit(outcome.emitEvent.event, outcome.emitEvent.payload);
            }
          }
        } catch (rowErr: any) {
          errors.push({ apId: ap.apId, reason: rowErr?.message ?? String(rowErr) });
        }
      }
    }

    return NextResponse.json({
      ok: errors.length === 0,
      mode: statusOnly ? "status" : "full",
      networks: networks.length,
      totalFetched,
      created,
      updated,
      statusChanged,
      perNetwork,
      errors: errors.slice(0, 50),
      at: now.toISOString(),
    });
  } catch (e) {
    console.error("POST /api/integrations/gdms/sync error:", e);
    return NextResponse.json({ ok: false, error: "GDMS_SYNC_FAILED" }, { status: 500 });
  }
}
