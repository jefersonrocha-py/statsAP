import { describe, expect, it } from "vitest";
import { formatDateTimeBR, toDate } from "@lib/dateFormat";

describe("formatDateTimeBR", () => {
  it("formata no fuso de São Paulo mesmo com o servidor em UTC", () => {
    expect(formatDateTimeBR("2026-10-08T15:30:00Z")).toMatch(/^08\/10\/2026,? 12:30$/);
  });

  it("devolve '-' para vazio ou inválido", () => {
    expect(formatDateTimeBR(null)).toBe("-");
    expect(formatDateTimeBR("")).toBe("-");
    expect(formatDateTimeBR("não é data")).toBe("-");
  });
});

describe("toDate", () => {
  it("aceita Date e string ISO", () => {
    const date = new Date("2026-10-08T10:00:00Z");
    expect(toDate(date)).toBe(date);
    expect(toDate("2026-10-08T10:00:00Z").getTime()).toBe(date.getTime());
  });
});
