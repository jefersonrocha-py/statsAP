export type IncidentStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  OPEN: "Aberta",
  IN_PROGRESS: "Em tratativa",
  RESOLVED: "Resolvida",
};

export const INCIDENT_STATUS_STYLES: Record<IncidentStatus, string> = {
  OPEN: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  IN_PROGRESS: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  RESOLVED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

export const INCIDENT_EVENT_LABELS: Record<string, string> = {
  OPENED: "Ocorrência aberta",
  WENT_DOWN_AGAIN: "Caiu novamente",
  RECOVERED: "AP voltou a ficar online",
  STATUS_CHANGED: "Tratativa iniciada",
  COMMENT: "Comentário",
  RESOLVED: "Resolvida",
  AUTO_RESOLVED: "Normalizada automaticamente",
  ALERT_SENT: "Alerta de queda enviado",
  RECOVERY_ALERT_SENT: "Aviso de normalização enviado",
};

export const RESOLUTION_LABELS: Record<string, string> = {
  MANUAL: "Resolvida por operador",
  AUTO_RECOVERED: "Normalizada automaticamente",
};

export function secondsBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000));
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds < 60) return `${seconds} s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours < 24) return restMinutes ? `${hours} h ${String(restMinutes).padStart(2, "0")} min` : `${hours} h`;

  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days} d ${restHours} h` : `${days} d`;
}
