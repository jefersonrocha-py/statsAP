import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  executed: [] as Array<{ sql: string; params: unknown[] }>,
  localRows: [] as Array<Record<string, unknown>>,
}));

vi.mock("@lib/mysql", () => ({
  dbQuery: vi.fn(async () => db.localRows),
  dbQueryOne: vi.fn(async () => null),
  dbExecute: vi.fn(async (sql: string, params: unknown[] = []) => {
    db.executed.push({ sql, params });
    return { insertId: 99, affectedRows: 1 };
  }),
  withTransaction: vi.fn(async (callback: (connection: unknown) => Promise<unknown>) => callback({})),
}));

vi.mock("@lib/sse", () => {
  const emit = vi.fn();
  return {
    emit,
    emitAll: (events: Array<{ event: string; payload: unknown }>) =>
      events.forEach((item) => emit(item.event, item.payload)),
  };
});

vi.mock("@services/gdms", () => ({ listNetworks: vi.fn(), listAPsByNetwork: vi.fn() }));

import { withTransaction } from "@lib/mysql";
import { emit } from "@lib/sse";
import { listAPsByNetwork, listNetworks } from "@services/gdms";
import { runGdmsSync, SyncInProgressError } from "@lib/gdmsSync";

const apExisting = {
  networkId: "10",
  networkName: "Rede A",
  apId: "AA:01",
  apName: "AP Praça",
  status: "DOWN" as const,
  coords: { lat: -22.44, lng: -46.97 },
};
const apNew = {
  networkId: "10",
  networkName: "Rede A",
  apId: "AA:02",
  apName: "AP Novo",
  status: "UP" as const,
  coords: null,
};

describe("runGdmsSync", () => {
  beforeEach(() => {
    db.executed.length = 0;
    db.localRows = [
      { id: 7, name: "AP Praça", status: "UP", lat: 0, lon: 0, networkId: "10", networkName: "Rede A", gdmsApId: "AA:01" },
    ];
    vi.mocked(listNetworks).mockResolvedValue([{ id: "10", networkName: "Rede A" }]);
    vi.mocked(listAPsByNetwork).mockResolvedValue([apExisting, apNew]);
  });

  it("modo status: aplica posição e status dos APs existentes e não cria novos", async () => {
    const summary = await runGdmsSync("status");

    expect(summary).toMatchObject({
      ok: true,
      mode: "status",
      networks: 1,
      totalFetched: 2,
      created: 0,
      updated: 1,
      statusChanged: 1,
      coordsUpdated: 1,
      withoutCoords: 1,
      errors: [],
    });
    const update = db.executed.find((query) => query.sql.startsWith("UPDATE `Antenna`"));
    expect(update?.sql).toContain("`lat` = ?");
    expect(update?.params).toEqual(expect.arrayContaining([-22.44, -46.97, "DOWN", 7]));
    expect(db.executed.some((query) => query.sql.includes("INSERT INTO `StatusHistory`"))).toBe(true);
    expect(db.executed.some((query) => query.sql.startsWith("INSERT INTO `Antenna`"))).toBe(false);
    expect(emit).toHaveBeenCalledWith(
      "status.changed",
      expect.objectContaining({ id: 7, previousStatus: "UP", status: "DOWN" })
    );
  });

  it("modo full: cria o AP novo", async () => {
    const summary = await runGdmsSync("full");

    expect(summary.created).toBe(1);
    expect(db.executed.some((query) => query.sql.startsWith("INSERT INTO `Antenna`"))).toBe(true);
    expect(emit).toHaveBeenCalledWith("antenna.created", expect.objectContaining({ name: "AP Novo" }));
  });

  it("aplica uma única vez o AP que aparece em duas redes", async () => {
    vi.mocked(listNetworks).mockResolvedValue([
      { id: "10", networkName: "Rede A" },
      { id: "11", networkName: "Rede B" },
    ]);
    vi.mocked(listAPsByNetwork)
      .mockResolvedValueOnce([apExisting])
      .mockResolvedValueOnce([{ ...apExisting, networkId: "11", networkName: "Rede B" }]);

    const summary = await runGdmsSync("status");

    expect(summary.totalFetched).toBe(2);
    expect(summary.updated).toBe(1);
    expect(db.executed.filter((query) => query.sql.startsWith("UPDATE `Antenna`"))).toHaveLength(1);
  });

  it("registra erro por AP sem interromper o sync", async () => {
    vi.mocked(withTransaction).mockRejectedValueOnce(new Error("deadlock"));

    const summary = await runGdmsSync("status");

    expect(summary.ok).toBe(false);
    expect(summary.errors).toEqual([{ apId: "AA:01", reason: "deadlock" }]);
  });

  it("recusa execução simultânea", async () => {
    let release: () => void = () => undefined;
    vi.mocked(listNetworks).mockImplementationOnce(
      () => new Promise((resolve) => { release = () => resolve([]); })
    );

    const first = runGdmsSync("status");
    await expect(runGdmsSync("status")).rejects.toBeInstanceOf(SyncInProgressError);
    release();
    await expect(first).resolves.toMatchObject({ networks: 0 });
  });
});
