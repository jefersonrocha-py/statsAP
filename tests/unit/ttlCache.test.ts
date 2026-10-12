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

  it("dentro do limite de stale, devolve o valor vencido na hora e atualiza em segundo plano", async () => {
    let clock = 1_000;
    let release!: (value: string) => void;
    const loader = vi
      .fn()
      .mockResolvedValueOnce("antigo")
      .mockImplementationOnce(() => new Promise<string>((resolve) => (release = resolve)));
    const load = createCachedLoader(loader, 60_000, () => clock, 600_000);

    await load();
    clock += 120_000;
    await expect(load()).resolves.toEqual({ value: "antigo", cachedAt: 1_000 });
    expect(loader).toHaveBeenCalledTimes(2);

    release("novo");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(load()).resolves.toEqual({ value: "novo", cachedAt: 121_000 });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("além do limite de stale, espera o valor novo", async () => {
    let clock = 1_000;
    const loader = vi.fn().mockResolvedValueOnce("antigo").mockResolvedValueOnce("novo");
    const load = createCachedLoader(loader, 60_000, () => clock, 600_000);

    await load();
    clock += 700_000;
    await expect(load()).resolves.toEqual({ value: "novo", cachedAt: 701_000 });
  });

  it("falha na atualização em segundo plano mantém o valor anterior", async () => {
    let clock = 1_000;
    const loader = vi
      .fn()
      .mockResolvedValue("depois")
      .mockResolvedValueOnce("antigo")
      .mockRejectedValueOnce(new Error("GDMS fora"));
    const load = createCachedLoader(loader, 60_000, () => clock, 600_000);

    await load();
    clock += 120_000;
    await expect(load()).resolves.toMatchObject({ value: "antigo" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(load()).resolves.toMatchObject({ value: "antigo" });
    expect(loader).toHaveBeenCalledTimes(3);
  });
});
