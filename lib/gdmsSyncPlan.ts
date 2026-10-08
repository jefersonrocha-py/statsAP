import type { Coordinates } from "@lib/gdmsNormalize";

// Decide, para cada AP lido do GWN, se o sync cria, atualiza ou ignora o registro local.
// Regra de coordenadas: o GWN sempre vence quando informa posição; sem posição no GWN, mantém a local.

export type SyncMode = "full" | "status";

export type LocalAntennaSnapshot = {
  id: number;
  name: string;
  status: string;
  lat: number;
  lon: number;
  networkId: string | null;
  networkName: string | null;
};

export type RemoteApSnapshot = {
  apId: string;
  apName: string;
  networkId: string;
  networkName: string;
  status: "UP" | "DOWN";
  coords: Coordinates | null;
};

export type CreateValues = {
  name: string;
  lat: number;
  lon: number;
  status: "UP" | "DOWN";
  gdmsApId: string;
  networkId: string;
  networkName: string;
};

export type UpdatePlan = {
  kind: "update";
  antennaId: number;
  previousStatus: string;
  antennaName: string;
  networkName: string | null;
  statusChanged: boolean;
  coordsChanged: boolean;
  metadataChanged: boolean;
  set: {
    status: "UP" | "DOWN";
    lat?: number;
    lon?: number;
    name?: string;
    networkId?: string;
    networkName?: string;
  };
};

export type ApSyncPlan = { kind: "skip" } | { kind: "create"; values: CreateValues } | UpdatePlan;

const COORD_EPSILON = 1e-7;

function coordsDiffer(local: { lat: number; lon: number }, remote: Coordinates) {
  return (
    Math.abs(Number(local.lat) - remote.lat) > COORD_EPSILON ||
    Math.abs(Number(local.lon) - remote.lng) > COORD_EPSILON
  );
}

export function planApUpdate(
  existing: LocalAntennaSnapshot | null,
  ap: RemoteApSnapshot,
  mode: SyncMode
): ApSyncPlan {
  if (!existing) {
    if (mode === "status") return { kind: "skip" };
    return {
      kind: "create",
      values: {
        name: ap.apName,
        lat: ap.coords?.lat ?? 0,
        lon: ap.coords?.lng ?? 0,
        status: ap.status,
        gdmsApId: ap.apId,
        networkId: ap.networkId,
        networkName: ap.networkName,
      },
    };
  }

  const set: UpdatePlan["set"] = { status: ap.status };
  const coordsChanged = ap.coords !== null && coordsDiffer(existing, ap.coords);
  if (coordsChanged && ap.coords) {
    set.lat = ap.coords.lat;
    set.lon = ap.coords.lng;
  }

  let metadataChanged = false;
  if (mode === "full") {
    if (existing.name !== ap.apName) {
      set.name = ap.apName;
      metadataChanged = true;
    }
    if ((existing.networkId ?? null) !== ap.networkId || (existing.networkName ?? null) !== ap.networkName) {
      set.networkId = ap.networkId;
      set.networkName = ap.networkName;
      metadataChanged = true;
    }
  }

  return {
    kind: "update",
    antennaId: existing.id,
    previousStatus: existing.status,
    antennaName: set.name ?? existing.name,
    networkName: set.networkName ?? existing.networkName,
    statusChanged: existing.status !== ap.status,
    coordsChanged,
    metadataChanged,
    set,
  };
}
