// Normalização dos campos que o GWN/GDMS devolve no ap/list.
// O ap/list real devolve latitude/longitude como string ("-22.441292") ou "" quando o AP não tem posição.

export type Coordinates = { lat: number; lng: number };

type RawAp = Record<string, any>;

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseCoordinatePair(rawLat: unknown, rawLng: unknown): Coordinates | null {
  const lat = toFiniteNumber(rawLat);
  const lng = toFiniteNumber(rawLng);
  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

export function pickRawLat(ap: RawAp): unknown {
  return (
    ap.latitude ?? ap.ap_latitude ?? ap.lat ?? ap.Latitude ?? ap.Lat ??
    ap.gpsLatitude ?? ap.gpsLat ?? ap.gps?.latitude ?? ap.gps?.lat ??
    ap.locationLatitude ?? ap.location?.latitude ?? ap.location?.lat ??
    ap.position?.latitude ?? ap.position?.lat
  );
}

export function pickRawLng(ap: RawAp): unknown {
  return (
    ap.longitude ?? ap.ap_longitude ?? ap.lng ?? ap.lon ?? ap.Longitude ?? ap.Lng ??
    ap.gpsLongitude ?? ap.gpsLng ?? ap.gps?.longitude ?? ap.gps?.lng ??
    ap.locationLongitude ?? ap.location?.longitude ?? ap.location?.lng ??
    ap.position?.longitude ?? ap.position?.lng
  );
}

export function pickApId(ap: RawAp): string | undefined {
  const candidate =
    ap.id ??
    ap.apId ?? ap.ap_id ?? ap.apID ??
    ap.deviceId ?? ap.device_id ??
    ap.mac ?? ap.MAC ?? ap.macAddr ?? ap.macAddress ??
    ap.serialNumber ?? ap.sn ?? ap.SN ??
    ap.uuid ?? ap.UUID;
  if (candidate === undefined || candidate === null) return undefined;
  const value = String(candidate).trim();
  return value.length ? value : undefined;
}

export function normalizeApStatus(raw: unknown): "UP" | "DOWN" {
  return Number(raw) === 1 ? "UP" : "DOWN";
}
