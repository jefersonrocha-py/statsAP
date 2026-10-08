import { formatDuration, secondsBetween, type IncidentStatus } from "@lib/incidentFormat";

// Máquina de estados das ocorrências de AP offline (ver spec, seção 7.2).

export type { IncidentStatus } from "@lib/incidentFormat";

export type IncidentEventType =
  | "OPENED"
  | "WENT_DOWN_AGAIN"
  | "RECOVERED"
  | "STATUS_CHANGED"
  | "COMMENT"
  | "RESOLVED"
  | "AUTO_RESOLVED"
  | "ALERT_SENT"
  | "RECOVERY_ALERT_SENT";

export type IncidentAction = "START" | "COMMENT" | "RESOLVE";

export type PlannedEvent = {
  type: IncidentEventType;
  message: string;
  fromStatus?: IncidentStatus;
  toStatus?: IncidentStatus;
};

export type OpenIncidentSnapshot = {
  id: number;
  status: "OPEN" | "IN_PROGRESS";
  lastDownAt: Date;
  recoveredAt: Date | null;
  downCount: number;
};

export type IncidentTransitionPlan =
  | { kind: "none" }
  | { kind: "open"; events: PlannedEvent[] }
  | { kind: "wentDownAgain"; incidentId: number; downCount: number; events: PlannedEvent[] }
  | { kind: "recovered"; incidentId: number; offlineSeconds: number; autoResolve: boolean; events: PlannedEvent[] };

export const INCIDENT_MESSAGE_MAX = 2000;

export function planIncidentTransition(input: {
  previousStatus: string;
  status: "UP" | "DOWN";
  at: Date;
  openIncident: OpenIncidentSnapshot | null;
}): IncidentTransitionPlan {
  if (input.previousStatus === input.status) return { kind: "none" };
  const open = input.openIncident;

  if (input.status === "DOWN") {
    if (open) {
      const downCount = open.downCount + 1;
      return {
        kind: "wentDownAgain",
        incidentId: open.id,
        downCount,
        events: [{ type: "WENT_DOWN_AGAIN", message: `O AP caiu novamente (${downCount}ª queda nesta ocorrência).` }],
      };
    }
    return { kind: "open", events: [{ type: "OPENED", message: "O AP ficou offline.", toStatus: "OPEN" }] };
  }

  if (!open || open.recoveredAt) return { kind: "none" };

  const offlineSeconds = secondsBetween(open.lastDownAt, input.at);
  const autoResolve = open.status === "OPEN";
  const events: PlannedEvent[] = [
    { type: "RECOVERED", message: `O AP voltou a ficar online após ${formatDuration(offlineSeconds)} offline.` },
  ];
  if (autoResolve) {
    events.push({
      type: "AUTO_RESOLVED",
      message: "Ocorrência normalizada automaticamente: o AP voltou antes de alguém registrar tratativa.",
      fromStatus: "OPEN",
      toStatus: "RESOLVED",
    });
  }

  return { kind: "recovered", incidentId: open.id, offlineSeconds, autoResolve, events };
}

export type ActionPlan =
  | { ok: true; toStatus: IncidentStatus; event: PlannedEvent }
  | { ok: false; error: "INVALID_TRANSITION" | "MESSAGE_REQUIRED" | "MESSAGE_TOO_LONG" };

export function planIncidentAction(
  current: IncidentStatus,
  action: IncidentAction,
  rawMessage?: string | null
): ActionPlan {
  const message = (rawMessage ?? "").trim();
  if (message.length > INCIDENT_MESSAGE_MAX) return { ok: false, error: "MESSAGE_TOO_LONG" };

  switch (action) {
    case "START":
      if (current !== "OPEN") return { ok: false, error: "INVALID_TRANSITION" };
      return {
        ok: true,
        toStatus: "IN_PROGRESS",
        event: {
          type: "STATUS_CHANGED",
          message: message || "Tratativa iniciada.",
          fromStatus: "OPEN",
          toStatus: "IN_PROGRESS",
        },
      };
    case "COMMENT":
      if (message.length < 3) return { ok: false, error: "MESSAGE_REQUIRED" };
      return { ok: true, toStatus: current, event: { type: "COMMENT", message } };
    case "RESOLVE":
      if (current === "RESOLVED") return { ok: false, error: "INVALID_TRANSITION" };
      if (message.length < 5) return { ok: false, error: "MESSAGE_REQUIRED" };
      return {
        ok: true,
        toStatus: "RESOLVED",
        event: { type: "RESOLVED", message, fromStatus: current, toStatus: "RESOLVED" },
      };
    default:
      return { ok: false, error: "INVALID_TRANSITION" };
  }
}

export function getIncidentAlertConfig(env: Record<string, string | undefined>) {
  const enabled = env.INCIDENT_ALERTS_ENABLED?.trim().toLowerCase() !== "false";
  const raw = Number(env.INCIDENT_ALERT_MIN_MINUTES ?? 10);
  const minMinutes = Number.isFinite(raw) && raw >= 1 && raw <= 1440 ? Math.floor(raw) : 10;
  return { enabled, minMinutes };
}
