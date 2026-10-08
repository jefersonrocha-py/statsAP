import "server-only";

import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { toDate } from "@lib/dateFormat";
import { planIncidentTransition, type PlannedEvent } from "@lib/incidentRules";
import { dbExecute, dbQueryOne } from "@lib/mysql";
import type { PendingEmit } from "@lib/sse";
import type { StatusTransition } from "@lib/statusChanges";

type OpenIncidentRow = RowDataPacket & {
  id: number;
  status: "OPEN" | "IN_PROGRESS";
  lastDownAt: Date | string;
  recoveredAt: Date | string | null;
  downCount: number;
};

type EventInsert = {
  incidentId: number;
  event: PlannedEvent;
  at: Date;
  actor?: { id: number; name: string } | null;
};

// IncidentEvent é a trilha de auditoria: a aplicação só insere, nunca altera nem apaga.
export async function insertIncidentEvents(connection: PoolConnection, items: EventInsert[]) {
  for (const item of items) {
    await dbExecute(
      "INSERT INTO `IncidentEvent` (`incidentId`, `type`, `message`, `fromStatus`, `toStatus`, `actorUserId`, `actorName`, `createdAt`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        item.incidentId,
        item.event.type,
        item.event.message,
        item.event.fromStatus ?? null,
        item.event.toStatus ?? null,
        item.actor?.id ?? null,
        item.actor?.name ?? null,
        item.at,
      ],
      connection
    );
  }
}

export async function applyIncidentTransition(
  connection: PoolConnection,
  transition: StatusTransition
): Promise<PendingEmit[]> {
  const row = await dbQueryOne<OpenIncidentRow>(
    "SELECT `id`, `status`, `lastDownAt`, `recoveredAt`, `downCount` FROM `Incident` WHERE `antennaId` = ? AND `status` <> 'RESOLVED' ORDER BY `id` DESC LIMIT 1 FOR UPDATE",
    [transition.antennaId],
    connection
  );

  const plan = planIncidentTransition({
    previousStatus: transition.previousStatus,
    status: transition.status,
    at: transition.at,
    openIncident: row
      ? {
          id: Number(row.id),
          status: row.status,
          lastDownAt: toDate(row.lastDownAt),
          recoveredAt: row.recoveredAt ? toDate(row.recoveredAt) : null,
          downCount: Number(row.downCount),
        }
      : null,
  });

  const at = transition.at;

  switch (plan.kind) {
    case "none":
      return [];

    case "open": {
      const result = await dbExecute(
        "INSERT INTO `Incident` (`antennaId`, `antennaName`, `networkName`, `status`, `wentDownAt`, `lastDownAt`, `createdAt`, `updatedAt`) VALUES (?, ?, ?, 'OPEN', ?, ?, ?, ?)",
        [transition.antennaId, transition.antennaName.slice(0, 80), transition.networkName, at, at, at, at],
        connection
      );
      await insertIncidentEvents(
        connection,
        plan.events.map((event) => ({ incidentId: result.insertId, event, at }))
      );
      return [
        {
          event: "incident.opened",
          payload: {
            id: result.insertId,
            antennaId: transition.antennaId,
            name: transition.antennaName,
            networkName: transition.networkName,
            at: at.toISOString(),
          },
        },
      ];
    }

    case "wentDownAgain": {
      await dbExecute(
        "UPDATE `Incident` SET `downCount` = ?, `lastDownAt` = ?, `recoveredAt` = NULL, `alertSentAt` = NULL, `recoveryAlertSentAt` = NULL, `updatedAt` = ? WHERE `id` = ?",
        [plan.downCount, at, at, plan.incidentId],
        connection
      );
      await insertIncidentEvents(
        connection,
        plan.events.map((event) => ({ incidentId: plan.incidentId, event, at }))
      );
      return [{ event: "incident.updated", payload: { id: plan.incidentId } }];
    }

    case "recovered": {
      if (plan.autoResolve) {
        await dbExecute(
          "UPDATE `Incident` SET `recoveredAt` = ?, `status` = 'RESOLVED', `resolution` = 'AUTO_RECOVERED', `resolvedAt` = ?, `updatedAt` = ? WHERE `id` = ?",
          [at, at, at, plan.incidentId],
          connection
        );
      } else {
        await dbExecute(
          "UPDATE `Incident` SET `recoveredAt` = ?, `updatedAt` = ? WHERE `id` = ?",
          [at, at, plan.incidentId],
          connection
        );
      }
      await insertIncidentEvents(
        connection,
        plan.events.map((event) => ({ incidentId: plan.incidentId, event, at }))
      );
      return [{ event: "incident.updated", payload: { id: plan.incidentId } }];
    }
  }
}
