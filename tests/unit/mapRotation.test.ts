import { describe, expect, it } from "vitest";
import {
  bearingFromDrag,
  bearingLabel,
  normalizeBearing,
  pointerAngle,
  shortestDelta,
  stepRotationTarget,
  toSignedBearing,
} from "@lib/mapRotation";

describe("pointerAngle", () => {
  it("mede em graus no sentido horário a partir do topo", () => {
    expect(pointerAngle(0, -10)).toBe(0);
    expect(pointerAngle(10, 0)).toBe(90);
    expect(pointerAngle(0, 10)).toBe(180);
    expect(pointerAngle(-10, 0)).toBe(270);
  });
});

describe("normalizeBearing / toSignedBearing", () => {
  it("normaliza para [0, 360) e (-180, 180]", () => {
    expect(normalizeBearing(-90)).toBe(270);
    expect(normalizeBearing(720)).toBe(0);
    expect(normalizeBearing(-0)).toBe(0);
    expect(toSignedBearing(270)).toBe(-90);
    expect(toSignedBearing(-180)).toBe(180);
  });
});

describe("shortestDelta", () => {
  it("escolhe o menor caminho, atravessando 0°/360°", () => {
    expect(shortestDelta(350, 10)).toBe(20);
    expect(shortestDelta(10, 350)).toBe(-20);
  });
});

describe("bearingFromDrag", () => {
  it("arrastar no sentido horário gira o mapa no sentido horário (bearing diminui)", () => {
    expect(bearingFromDrag(0, 0, 90)).toBe(-90);
  });

  it("não salta ao começar o arraste", () => {
    expect(bearingFromDrag(37, 200, 200)).toBe(37);
  });

  it("atravessa a marca de 0°/360° sem salto", () => {
    expect(bearingFromDrag(10, 350, 5)).toBe(-5);
  });

  it("mantém o resultado em (-180, 180]", () => {
    expect(bearingFromDrag(170, 0, 270)).toBe(-100);
  });
});

describe("bearingLabel", () => {
  it("usa os pontos cardeais em português", () => {
    expect(bearingLabel(0)).toBe("N");
    expect(bearingLabel(90)).toBe("L");
    expect(bearingLabel(-90)).toBe("O");
    expect(bearingLabel(135)).toBe("SE");
    expect(bearingLabel(225)).toBe("SO");
    expect(bearingLabel(359)).toBe("N");
  });
});

describe("stepRotationTarget", () => {
  it("parte do bearing atual quando não há giro em andamento", () => {
    expect(stepRotationTarget(10, null, -15, 1_000)).toBe(-5);
  });

  it("soma ao destino pendente enquanto a animação anterior não terminou", () => {
    // O mapa ainda está em -7° a caminho de -15°: o segundo toque precisa chegar a -30°, não a -22°.
    expect(stepRotationTarget(-7, { target: -15, expiresAt: 1_250 }, -15, 1_100)).toBe(-30);
  });

  it("ignora o destino pendente depois que a animação terminou", () => {
    expect(stepRotationTarget(40, { target: -15, expiresAt: 1_250 }, -15, 1_300)).toBe(25);
  });
});
