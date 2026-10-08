import { describe, expect, it } from "vitest";
import {
  normalizeApStatus,
  parseCoordinatePair,
  pickApId,
  pickRawLat,
  pickRawLng,
} from "@lib/gdmsNormalize";

describe("parseCoordinatePair", () => {
  it("aceita latitude/longitude em texto, como o ap/list do GWN devolve", () => {
    expect(parseCoordinatePair("-22.441292", "-46.972298")).toEqual({ lat: -22.441292, lng: -46.972298 });
  });

  it("aceita números", () => {
    expect(parseCoordinatePair(-22.5, -46.9)).toEqual({ lat: -22.5, lng: -46.9 });
  });

  it("aceita vírgula decimal e espaços", () => {
    expect(parseCoordinatePair(" -22,5 ", "-46,9")).toEqual({ lat: -22.5, lng: -46.9 });
  });

  it("rejeita valores vazios ou ausentes", () => {
    expect(parseCoordinatePair("", "")).toBeNull();
    expect(parseCoordinatePair(undefined, "-46.9")).toBeNull();
    expect(parseCoordinatePair(null, null)).toBeNull();
  });

  it("rejeita texto não numérico", () => {
    expect(parseCoordinatePair("abc", "-46.9")).toBeNull();
  });

  it("rejeita valores fora da faixa", () => {
    expect(parseCoordinatePair("-91", "0.5")).toBeNull();
    expect(parseCoordinatePair("10", "181")).toBeNull();
  });

  it("rejeita o par 0,0 (AP sem posição)", () => {
    expect(parseCoordinatePair("0", "0")).toBeNull();
    expect(parseCoordinatePair(0, 0)).toBeNull();
  });

  it("aceita um eixo zero quando o outro não é zero", () => {
    expect(parseCoordinatePair("0", "-46.9")).toEqual({ lat: 0, lng: -46.9 });
  });
});

describe("pickRawLat / pickRawLng", () => {
  it("prioriza latitude/longitude do ap/list", () => {
    const ap = { latitude: "-22.4", longitude: "-46.9", lat: 1, lng: 2 };
    expect(pickRawLat(ap)).toBe("-22.4");
    expect(pickRawLng(ap)).toBe("-46.9");
  });

  it("cai para formatos alternativos", () => {
    expect(pickRawLat({ gps: { lat: -1 } })).toBe(-1);
    expect(pickRawLng({ location: { longitude: -2 } })).toBe(-2);
  });
});

describe("pickApId", () => {
  it("usa o MAC quando não há id", () => {
    expect(pickApId({ mac: "00:0B:82:AA:AA:AA" })).toBe("00:0B:82:AA:AA:AA");
  });

  it("ignora identificador vazio", () => {
    expect(pickApId({ id: "  " })).toBeUndefined();
  });
});

describe("normalizeApStatus", () => {
  it("1 é UP; qualquer outro valor é DOWN", () => {
    expect(normalizeApStatus(1)).toBe("UP");
    expect(normalizeApStatus("1")).toBe("UP");
    expect(normalizeApStatus(0)).toBe("DOWN");
    expect(normalizeApStatus(undefined)).toBe("DOWN");
  });
});
