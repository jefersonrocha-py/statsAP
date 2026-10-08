// Uma única EventSource por aba, compartilhada por todos os componentes.
const NAMED_EVENTS = [
  "connected",
  "ping",
  "antenna.created",
  "antenna.updated",
  "antenna.deleted",
  "status.changed",
  "incident.opened",
  "incident.updated",
] as const;

const CLOSE_DELAY_MS = 1_000;

type Listener = (event: MessageEvent) => void;

const listeners = new Set<Listener>();
let source: EventSource | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;

function wrapEvent(event: MessageEvent, type: string) {
  let payload: unknown = event.data;

  try {
    payload = JSON.parse(event.data);
  } catch {}

  const data =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? { event: type, ...(payload as Record<string, unknown>) }
      : { event: type, data: payload };

  return new MessageEvent("message", {
    data: JSON.stringify(data),
  });
}

function broadcast(event: MessageEvent) {
  for (const listener of Array.from(listeners)) {
    try {
      listener(event);
    } catch {}
  }
}

function ensureSource() {
  if (source) return;
  source = new EventSource("/api/events");
  for (const type of NAMED_EVENTS) {
    source.addEventListener(type, (event) => broadcast(wrapEvent(event as MessageEvent, type)));
  }
  source.onmessage = (event) => broadcast(event);
  source.onerror = () => {};
}

export function connectSSE(onEvent: Listener) {
  if (typeof window === "undefined") return () => {};

  listeners.add(onEvent);
  if (closeTimer !== null) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  ensureSource();

  return () => {
    listeners.delete(onEvent);
    if (listeners.size > 0 || closeTimer !== null) return;

    // Espera um instante antes de fechar: trocar de página desmonta e remonta os componentes.
    closeTimer = setTimeout(() => {
      closeTimer = null;
      if (listeners.size === 0 && source) {
        source.close();
        source = null;
      }
    }, CLOSE_DELAY_MS);
  };
}
