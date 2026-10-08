// Datas são gravadas em UTC; toda exibição usa o fuso da operação.
export const APP_TIME_ZONE = "America/Sao_Paulo";

export function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDateTimeBR(value: Date | string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
