import { describe, expect, it, vi } from "vitest";

vi.mock("@lib/mysql", () => ({
  dbQuery: vi.fn(),
  dbQueryOne: vi.fn(),
  dbExecute: vi.fn(async () => ({ insertId: 41, affectedRows: 1 })),
  withTransaction: vi.fn(async (callback: (connection: unknown) => Promise<unknown>) => callback({})),
}));

import { dbExecute, dbQueryOne } from "@lib/mysql";
import { applyIncidentTransition } from "@lib/incidents";

const connection = {} as never;
const at = new Date("2026-10-08T12:00:00Z");
const base = { antennaId: 7, antennaName: "AP Praça", networkName: "Rede A", at };

function executedTypes() {
  return vi
    .mocked(dbExecute)
    .mock.calls.filter(([sql]) => String(sql).startsWith("INSERT INTO `IncidentEvent`"))
    .map(([, params]) => (params as unknown[])[1]);
}

describe("applyIncidentTransition", () => {
  it("abre ocorrência quando o AP cai sem ocorrência pendente", async () => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce(null);

    const emits = await applyIncidentTransition(connection, { ...base, previousStatus: "UP", status: "DOWN" });

    const [insertSql, insertParams] = vi.mocked(dbExecute).mock.calls[0];
    expect(insertSql).toContain("INSERT INTO `Incident`");
    expect(insertParams).toEqual([7, "AP Praça", "Rede A", at, at, at, at]);
    expect(vi.mocked(dbExecute).mock.calls[1][1]).toEqual([41, "OPENED", "O AP ficou offline.", null, "OPEN", null, null, at]);
    expect(emits).toEqual([
      {
        event: "incident.opened",
        payload: { id: 41, antennaId: 7, name: "AP Praça", networkName: "Rede A", at: at.toISOString() },
      },
    ]);
  });

  it("normaliza automaticamente a ocorrência aberta quando o AP volta", async () => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce({
      id: 12,
      status: "OPEN",
      lastDownAt: new Date("2026-10-08T11:30:00Z"),
      recoveredAt: null,
      downCount: 1,
    } as never);

    const emits = await applyIncidentTransition(connection, { ...base, previousStatus: "DOWN", status: "UP" });

    expect(vi.mocked(dbExecute).mock.calls[0][0]).toContain("`status` = 'RESOLVED'");
    expect(executedTypes()).toEqual(["RECOVERED", "AUTO_RESOLVED"]);
    expect(emits).toEqual([{ event: "incident.updated", payload: { id: 12 } }]);
  });

  it("mantém em tratativa quando o AP volta e alguém já assumiu", async () => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce({
      id: 12,
      status: "IN_PROGRESS",
      lastDownAt: new Date("2026-10-08T11:30:00Z"),
      recoveredAt: null,
      downCount: 1,
    } as never);

    await applyIncidentTransition(connection, { ...base, previousStatus: "DOWN", status: "UP" });

    expect(vi.mocked(dbExecute).mock.calls[0][0]).not.toContain("RESOLVED");
    expect(executedTypes()).toEqual(["RECOVERED"]);
  });

  it("nova queda numa ocorrência em tratativa renova lastDownAt e zera os alertas", async () => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce({
      id: 12,
      status: "IN_PROGRESS",
      lastDownAt: new Date("2026-10-08T10:00:00Z"),
      recoveredAt: new Date("2026-10-08T11:00:00Z"),
      downCount: 1,
    } as never);

    await applyIncidentTransition(connection, { ...base, previousStatus: "UP", status: "DOWN" });

    const [sql, params] = vi.mocked(dbExecute).mock.calls[0];
    expect(sql).toContain("`alertSentAt` = NULL");
    expect(params).toEqual([2, at, at, 12]);
    expect(executedTypes()).toEqual(["WENT_DOWN_AGAIN"]);
  });
});
