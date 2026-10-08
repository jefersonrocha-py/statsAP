import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  listeners = new Map<string, Array<(event: MessageEvent) => void>>();
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  dispatch(type: string, data: unknown) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(new MessageEvent(type, { data: JSON.stringify(data) }));
    }
  }

  close() {
    this.closed = true;
  }
}

describe("connectSSE", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("window", globalThis);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("compartilha uma única conexão entre componentes e fecha quando todos saem", async () => {
    const { connectSSE } = await import("@services/sseClient");
    const first = vi.fn();
    const second = vi.fn();

    const disconnectFirst = connectSSE(first);
    const disconnectSecond = connectSSE(second);
    expect(FakeEventSource.instances).toHaveLength(1);

    FakeEventSource.instances[0].dispatch("incident.opened", { id: 3 });
    expect(JSON.parse(first.mock.calls[0][0].data)).toEqual({ event: "incident.opened", id: 3 });
    expect(second).toHaveBeenCalledTimes(1);

    disconnectFirst();
    disconnectSecond();
    expect(FakeEventSource.instances[0].closed).toBe(false);
    vi.advanceTimersByTime(1_000);
    expect(FakeEventSource.instances[0].closed).toBe(true);
  });
});
