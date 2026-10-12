import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@lib/mysql", () => ({ dbQueryOne: vi.fn() }));

import { dbQueryOne } from "@lib/mysql";
import { requireRequestAuth } from "@lib/auth";
import { signAuthToken, type JwtPayload } from "@lib/jwt";

const tokenUser: JwtPayload = { sub: "5", email: "ana@exemplo.com", name: "Ana", role: "USER" };
const activeRow = {
  id: 5,
  name: "Ana Souza",
  email: "ana@exemplo.com",
  role: "ADMIN",
  isBlocked: 0,
  suspendedUntil: null,
};

async function requestWithToken(payload: JwtPayload = tokenUser) {
  const token = await signAuthToken(payload);
  return new Request("https://stats.test/api/me", { headers: { authorization: `Bearer ${token}` } });
}

describe("requireRequestAuth", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "x".repeat(40);
  });

  it("usa nome e papel atuais do banco, não os do token", async () => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce(activeRow as never);

    const result = await requireRequestAuth(await requestWithToken(), ["ADMIN"]);

    expect(result).toEqual({ user: { sub: "5", email: "ana@exemplo.com", name: "Ana Souza", role: "ADMIN" } });
  });

  it.each([
    ["excluído", null],
    ["bloqueado", { ...activeRow, isBlocked: 1 }],
    ["suspenso", { ...activeRow, suspendedUntil: new Date(Date.now() + 3_600_000) }],
  ])("recusa usuário %s com SESSION_REVOKED e apaga os cookies", async (_label, row) => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce(row as never);

    const result = await requireRequestAuth(await requestWithToken());

    if (!result.response) throw new Error("esperava resposta de erro");
    expect(result.response.status).toBe(401);
    expect(await result.response.json()).toEqual({ ok: false, error: "SESSION_REVOKED" });
    const setCookie = result.response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("auth=");
    expect(setCookie).toContain("Max-Age=0");
  });

  it("recusa sessão criada antes da troca de senha", async () => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce({
      ...activeRow,
      passwordChangedAt: new Date(Date.now() + 60_000),
    } as never);

    const result = await requireRequestAuth(await requestWithToken());

    if (!result.response) throw new Error("esperava resposta de erro");
    expect(result.response.status).toBe(401);
    expect(await result.response.json()).toEqual({ ok: false, error: "SESSION_REVOKED" });
  });

  it("mantém sessão criada depois da troca de senha", async () => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce({
      ...activeRow,
      passwordChangedAt: new Date(Date.now() - 60_000),
    } as never);

    const result = await requireRequestAuth(await requestWithToken());

    expect(result).toMatchObject({ user: { sub: "5" } });
  });

  it("devolve 403 quando o papel no banco não tem permissão", async () => {
    vi.mocked(dbQueryOne).mockResolvedValueOnce({ ...activeRow, role: "USER" } as never);

    const result = await requireRequestAuth(
      await requestWithToken({ ...tokenUser, role: "SUPERADMIN" }),
      ["SUPERADMIN"]
    );

    if (!result.response) throw new Error("esperava resposta de erro");
    expect(result.response.status).toBe(403);
  });

  it("recusa token inválido sem consultar o banco", async () => {
    const req = new Request("https://stats.test/api/me", { headers: { authorization: "Bearer invalido" } });

    const result = await requireRequestAuth(req);

    if (!result.response) throw new Error("esperava resposta de erro");
    expect(result.response.status).toBe(401);
    expect(dbQueryOne).not.toHaveBeenCalled();
  });
});
