import { describe, expect, it } from "vitest";
import {
  readSidebarCollapsed,
  SIDEBAR_COLLAPSED_KEY,
  writeSidebarCollapsed,
} from "@lib/sidebarPreference";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    data,
  };
}

describe("preferência de sidebar recolhida", () => {
  it("começa expandida quando não há preferência salva", () => {
    expect(readSidebarCollapsed(memoryStorage())).toBe(false);
  });

  it("lê a preferência salva", () => {
    expect(readSidebarCollapsed(memoryStorage({ [SIDEBAR_COLLAPSED_KEY]: "1" }))).toBe(true);
    expect(readSidebarCollapsed(memoryStorage({ [SIDEBAR_COLLAPSED_KEY]: "0" }))).toBe(false);
  });

  it("grava a escolha do usuário", () => {
    const storage = memoryStorage();
    writeSidebarCollapsed(true, storage);
    expect(storage.data.get(SIDEBAR_COLLAPSED_KEY)).toBe("1");
    writeSidebarCollapsed(false, storage);
    expect(storage.data.get(SIDEBAR_COLLAPSED_KEY)).toBe("0");
  });

  it("não quebra quando o navegador bloqueia o armazenamento", () => {
    const blocked = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    };
    expect(readSidebarCollapsed(blocked)).toBe(false);
    expect(() => writeSidebarCollapsed(true, blocked)).not.toThrow();
  });

  it("sem armazenamento disponível (servidor) usa o padrão", () => {
    expect(readSidebarCollapsed(null)).toBe(false);
    expect(() => writeSidebarCollapsed(true, null)).not.toThrow();
  });
});
