import { describe, expect, it, vi } from "vitest";
import { createCachedLoader } from "@lib/ttlCache";

describe("createCachedLoader", () => {
  it("reaproveita o valor dentro do TTL", async () => {
    let clock = 1_000;
    const loader = vi.fn(async () => "valor");
    const load = createCachedLoader(loader, 60_000, () => clock);

    await load();
    clock += 59_000;
    await expect(load()).resolves.toEqual({ value: "valor", cachedAt: 1_000 });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("recarrega depois do TTL", async () => {
    let clock = 1_000;
    const loader = vi.fn(async () => clock);
    const load = createCachedLoader(loader, 60_000, () => clock);

    await load();
    clock += 60_000;
    await expect(load()).resolves.toEqual({ value: 61_000, cachedAt: 61_000 });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("compartilha a chamada em andamento entre requisições simultâneas", async () => {
    const loader = vi.fn(async () => "valor");
    const load = createCachedLoader(loader, 60_000);

    await Promise.all([load(), load(), load()]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("não guarda erro no cache", async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error("GDMS fora")).mockResolvedValueOnce("ok");
    const load = createCachedLoader(loader, 60_000);

    await expect(load()).rejects.toThrow("GDMS fora");
    await expect(load()).resolves.toMatchObject({ value: "ok" });
  });
});
