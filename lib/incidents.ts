import "server-only";

import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { toDate } from "@lib/dateFormat";
import { toIso } from "@lib/dbMappers";
import { secondsBetween, type IncidentStatus } from "@lib/incidentFormat";
import {
  planIncidentAction,
  planIncidentTransition,
  type IncidentAction,
  type PlannedEvent,
} from "@lib/incidentRules";
import { dbExecute, dbQuery, dbQueryOne, withTransaction } from "@lib/mysql";
import { emit, type PendingEmit } from "@lib/sse";
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
        "UPDATE `Incident` SET `downCount` = ?, `lastDownAt` = ?, `recoveredAt` = NULL, `alertSentAt` = NULL, `recoveryAlertSentAt` = NULL, `alertsSuppressed` = 0, `updatedAt` = ? WHERE `id` = ?",
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

type IncidentRow = RowDataPacket & {
  id: number;
  antennaId: number | null;
  antennaName: string;
  networkName: string | null;
  status: IncidentStatus;
  resolution: string | null;
  wentDownAt: Date | string;
  lastDownAt: Date | string;
  recoveredAt: Date | string | null;
  downCount: number;
  alertSentAt: Date | string | null;
  resolvedAt: Date | string | null;
  resolvedByName: string | null;
  createdAt: Date | string;
};

type IncidentEventRow = RowDataPacket & {
  id: number;
  type: string;
  message: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  actorName: string | null;
  createdAt: Date | string;
};

type CountRow = RowDataPacket & { total: number };
type LockedIncidentRow = RowDataPacket & { id: number; status: IncidentStatus };
type SeenRow = RowDataPacket & { notificationsSeenAt: Date | string | null; createdAt: Date | string };
type SummaryRow = RowDataPacket & { unread: number | null; openCount: number | null };

export type IncidentItem = {
  id: number;
  antennaId: number | null;
  antennaName: string;
  networkName: string | null;
  status: IncidentStatus;
  resolution: string | null;
  wentDownAt: string | null;
  lastDownAt: string | null;
  recoveredAt: string | null;
  downCount: number;
  alertSentAt: string | null;
  resolvedAt: string | null;
  resolvedByName: string | null;
  offlineSeconds: number;
};

export type IncidentEventItem = {
  id: number;
  type: string;
  message: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  actorName: string;
  createdAt: string | null;
};

export type IncidentDetail = IncidentItem & { events: IncidentEventItem[] };

export type IncidentFilters = {
  status: "ACTIVE" | "OPEN" | "IN_PROGRESS" | "RESOLVED" | "ALL";
  network: string;
  q: string;
  page: number;
  pageSize: number;
};

export function mapIncidentRow(row: IncidentRow, now = new Date()): IncidentItem {
  const lastDownAt = toDate(row.lastDownAt);
  const recoveredAt = row.recoveredAt ? toDate(row.recoveredAt) : null;

  return {
    id: Number(row.id),
    antennaId: row.antennaId === null || row.antennaId === undefined ? null : Number(row.antennaId),
    antennaName: row.antennaName,
    networkName: row.networkName ?? null,
    status: row.status,
    resolution: row.resolution ?? null,
    wentDownAt: toIso(row.wentDownAt),
    lastDownAt: toIso(row.lastDownAt),
    recoveredAt: toIso(row.recoveredAt),
    downCount: Number(row.downCount),
    alertSentAt: toIso(row.alertSentAt),
    resolvedAt: toIso(row.resolvedAt),
    resolvedByName: row.resolvedByName ?? null,
    offlineSeconds: secondsBetween(lastDownAt, recoveredAt ?? now),
  };
}

function mapIncidentEventRow(row: IncidentEventRow): IncidentEventItem {
  return {
    id: Number(row.id),
    type: row.type,
    message: row.message ?? null,
    fromStatus: row.fromStatus ?? null,
    toStatus: row.toStatus ?? null,
    actorName: row.actorName || "Sistema",
    createdAt: toIso(row.createdAt),
  };
}

export async function listIncidents(filters: IncidentFilters, now = new Date()) {
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (filters.status === "ACTIVE") {
    where.push("`status` <> 'RESOLVED'");
  } else if (filters.status !== "ALL") {
    where.push("`status` = ?");
    params.push(filters.status);
  }
  if (filters.network) {
    where.push("`networkName` = ?");
    params.push(filters.network);
  }
  if (filters.q) {
    where.push("`antennaName` LIKE ?");
    params.push(`%${filters.q}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const count = await dbQueryOne<CountRow>(`SELECT COUNT(*) AS \`total\` FROM \`Incident\` ${whereSql}`, params);
  const totalCount = Number(count?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));
  const page = Math.min(filters.page, totalPages);

  const rows = await dbQuery<IncidentRow>(
    `SELECT * FROM \`Incident\` ${whereSql} ORDER BY (\`status\` = 'RESOLVED') ASC, \`lastDownAt\` DESC, \`id\` DESC LIMIT ${filters.pageSize} OFFSET ${(page - 1) * filters.pageSize}`,
    params
  );

  return {
    items: rows.map((row) => mapIncidentRow(row, now)),
    totalCount,
    page,
    pageSize: filters.pageSize,
    totalPages,
  };
}

export async function getIncidentDetail(incidentId: number, now = new Date()): Promise<IncidentDetail | null> {
  const row = await dbQueryOne<IncidentRow>("SELECT * FROM `Incident` WHERE `id` = ? LIMIT 1", [incidentId]);
  if (!row) return null;

  const events = await dbQuery<IncidentEventRow>(
    "SELECT `id`, `type`, `message`, `fromStatus`, `toStatus`, `actorName`, `createdAt` FROM `IncidentEvent` WHERE `incidentId` = ? ORDER BY `createdAt` ASC, `id` ASC",
    [incidentId]
  );

  return { ...mapIncidentRow(row, now), events: events.map(mapIncidentEventRow) };
}

type ActionResult =
  | { ok: true; item: IncidentDetail }
  | { ok: false; error: "NOT_FOUND" | "INVALID_TRANSITION" | "MESSAGE_REQUIRED" | "MESSAGE_TOO_LONG"; status: number };

export async function applyIncidentAction(input: {
  incidentId: number;
  action: IncidentAction;
  message?: string | null;
  actor: { id: number; name: string };
}): Promise<ActionResult> {
  const now = new Date();

  const outcome = await withTransaction<ActionResult | null>(async (connection) => {
    const row = await dbQueryOne<LockedIncidentRow>(
      "SELECT `id`, `status` FROM `Incident` WHERE `id` = ? LIMIT 1 FOR UPDATE",
      [input.incidentId],
      connection
    );
    if (!row) return { ok: false, error: "NOT_FOUND", status: 404 };

    const plan = planIncidentAction(row.status, input.action, input.message);
    if (!plan.ok) {
      return { ok: false, error: plan.error, status: plan.error === "INVALID_TRANSITION" ? 409 : 400 };
    }

    if (plan.toStatus === "RESOLVED" && row.status !== "RESOLVED") {
      await dbExecute(
        "UPDATE `Incident` SET `status` = ?, `resolution` = 'MANUAL', `resolvedAt` = ?, `resolvedById` = ?, `resolvedByName` = ?, `updatedAt` = ? WHERE `id` = ?",
        [plan.toStatus, now, input.actor.id, input.actor.name, now, input.incidentId],
        connection
      );
    } else if (plan.toStatus !== row.status) {
      await dbExecute(
        "UPDATE `Incident` SET `status` = ?, `updatedAt` = ? WHERE `id` = ?",
        [plan.toStatus, now, input.incidentId],
        connection
      );
    }

    await insertIncidentEvents(connection, [
      { incidentId: input.incidentId, event: plan.event, at: now, actor: input.actor },
    ]);
    return null;
  });

  if (outcome) return outcome;

  emit("incident.updated", { id: input.incidentId });
  const item = await getIncidentDetail(input.incidentId, now);
  if (!item) return { ok: false, error: "NOT_FOUND", status: 404 };
  return { ok: true, item };
}

export async function getNotificationSummary(userId: number, now = new Date()) {
  const user = await dbQueryOne<SeenRow>(
    "SELECT `notificationsSeenAt`, `createdAt` FROM `User` WHERE `id` = ? LIMIT 1",
    [userId]
  );
  // Usuário novo não recebe como "não lidas" as ocorrências anteriores à criação da conta.
  const seenAt = user?.notificationsSeenAt
    ? toDate(user.notificationsSeenAt)
    : user?.createdAt
      ? toDate(user.createdAt)
      : new Date(0);

  const summary = await dbQueryOne<SummaryRow>(
    "SELECT SUM(CASE WHEN `createdAt` > ? THEN 1 ELSE 0 END) AS `unread`, SUM(CASE WHEN `status` <> 'RESOLVED' THEN 1 ELSE 0 END) AS `openCount` FROM `Incident`",
    [seenAt]
  );
  const rows = await dbQuery<IncidentRow>("SELECT * FROM `Incident` ORDER BY `createdAt` DESC, `id` DESC LIMIT 8");

  return {
    unread: Number(summary?.unread ?? 0),
    openCount: Number(summary?.openCount ?? 0),
    items: rows.map((row) => ({ ...mapIncidentRow(row, now), isUnread: toDate(row.createdAt) > seenAt })),
  };
}

export async function markNotificationsSeen(userId: number, now = new Date()) {
  await dbExecute("UPDATE `User` SET `notificationsSeenAt` = ? WHERE `id` = ?", [now, userId]);
}
