// Matemática do controle de rotação do mapa.
// Bearing do MapLibre: direção da bússola que fica no topo da tela (90 = leste em cima).

export const ROTATION_STEP_BUTTON = 45;
export const ROTATION_STEP_KEY = 15;

const LABELS = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];

export function normalizeBearing(value: number): number {
  const normalized = value % 360;
  return (normalized < 0 ? normalized + 360 : normalized) + 0;
}

export function toSignedBearing(value: number): number {
  const normalized = normalizeBearing(value);
  return normalized > 180 ? normalized - 360 : normalized;
}

export function pointerAngle(dx: number, dy: number): number {
  return normalizeBearing((Math.atan2(dx, -dy) * 180) / Math.PI);
}

export function shortestDelta(from: number, to: number): number {
  const delta = normalizeBearing(to - from);
  return delta > 180 ? delta - 360 : delta;
}

// Arrasto relativo: o mapa gira o mesmo ângulo que o ponteiro percorreu, no mesmo sentido.
export function bearingFromDrag(startBearing: number, startAngle: number, currentAngle: number): number {
  return toSignedBearing(startBearing - shortestDelta(startAngle, currentAngle));
}

export function bearingLabel(value: number): string {
  return LABELS[Math.round(normalizeBearing(value) / 45) % LABELS.length];
}
