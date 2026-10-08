import { describe, expect, it } from "vitest";
import { planApUpdate, type LocalAntennaSnapshot, type RemoteApSnapshot } from "@lib/gdmsSyncPlan";

const local: LocalAntennaSnapshot = {
  id: 7,
  name: "AP Praça",
  status: "UP",
  lat: -22.4,
  lon: -46.9,
  networkId: "10",
  networkName: "Rede A",
};

const remote: RemoteApSnapshot = {
  apId: "00:0B:82:AA:AA:01",
  apName: "AP Praça",
  networkId: "10",
  networkName: "Rede A",
  status: "UP",
  coords: { lat: -22.4, lng: -46.9 },
};

describe("planApUpdate", () => {
  it("cria AP novo no modo full já com a posição do GWN", () => {
    expect(planApUpdate(null, { ...remote, coords: { lat: -22.5, lng: -46.8 } }, "full")).toEqual({
      kind: "create",
      values: {
        name: "AP Praça",
        lat: -22.5,
        lon: -46.8,
        status: "UP",
        gdmsApId: "00:0B:82:AA:AA:01",
        networkId: "10",
        networkName: "Rede A",
      },
    });
  });

  it("cria AP novo em 0,0 quando o GWN não tem posição", () => {
    const plan = planApUpdate(null, { ...remote, coords: null }, "full");
    expect(plan).toMatchObject({ kind: "create", values: { lat: 0, lon: 0 } });
  });

  it("ignora AP novo no modo status", () => {
    expect(planApUpdate(null, remote, "status")).toEqual({ kind: "skip" });
  });

  it("aplica a posição do GWN sobre a posição local (GWN sempre vence)", () => {
    const plan = planApUpdate(local, { ...remote, coords: { lat: -22.45, lng: -46.95 } }, "status");
    expect(plan).toMatchObject({ kind: "update", coordsChanged: true, set: { lat: -22.45, lon: -46.95 } });
  });

  it("mantém a posição local quando o GWN não tem posição", () => {
    const plan = planApUpdate(local, { ...remote, coords: null }, "full");
    expect(plan).toMatchObject({ kind: "update", coordsChanged: false });
    if (plan.kind !== "update") throw new Error("esperava update");
    expect(plan.set.lat).toBeUndefined();
    expect(plan.set.lon).toBeUndefined();
  });

  it("não considera mudança abaixo da tolerância", () => {
    const plan = planApUpdate(local, { ...remote, coords: { lat: -22.40000001, lng: -46.9 } }, "status");
    expect(plan).toMatchObject({ kind: "update", coordsChanged: false });
  });

  it("detecta mudança de status e informa o status anterior", () => {
    const plan = planApUpdate(local, { ...remote, status: "DOWN" }, "status");
    expect(plan).toMatchObject({
      kind: "update",
      antennaId: 7,
      statusChanged: true,
      previousStatus: "UP",
      set: { status: "DOWN" },
    });
  });

  it("atualiza nome e rede só no modo full", () => {
    const changed = { ...remote, apName: "AP Praça 2", networkId: "11", networkName: "Rede B" };

    expect(planApUpdate(local, changed, "full")).toMatchObject({
      metadataChanged: true,
      antennaName: "AP Praça 2",
      networkName: "Rede B",
      set: { name: "AP Praça 2", networkId: "11", networkName: "Rede B" },
    });

    const statusOnly = planApUpdate(local, changed, "status");
    expect(statusOnly).toMatchObject({ metadataChanged: false, antennaName: "AP Praça", networkName: "Rede A" });
    if (statusOnly.kind !== "update") throw new Error("esperava update");
    expect(statusOnly.set.name).toBeUndefined();
  });
});
