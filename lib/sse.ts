type Client = {
  id: number;
  controller: ReadableStreamDefaultController;
  closed: boolean;
};

let clientId = 0;
const clients = new Map<number, Client>();
const encoder = new TextEncoder();

export function addClient(controller: ReadableStreamDefaultController) {
  const id = ++clientId;
  const client: Client = { id, controller, closed: false };
  clients.set(id, client);

  // ping inicial
  safeEnqueue(client, `event: connected\ndata: {"id":${id}}\n\n`);

  // retorna função de remoção
  return () => {
    const c = clients.get(id);
    if (!c) return;
    c.closed = true;
    clients.delete(id);
  };
}

export function emit(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [id, c] of clients) {
    if (c.closed) {
      clients.delete(id);
      continue;
    }
    const ok = safeEnqueue(c, payload);
    if (!ok) {
      c.closed = true;
      clients.delete(id);
    }
  }
}

function safeEnqueue(c: Client, text: string) {
  try {
    c.controller.enqueue(encoder.encode(text));
    return true;
  } catch {
    return false;
  }
}

export type PendingEmit = { event: string; payload: Record<string, unknown> };

// Eventos montados dentro de uma transação só são emitidos depois do commit.
export function emitAll(events: PendingEmit[]) {
  for (const item of events) emit(item.event, item.payload);
}
