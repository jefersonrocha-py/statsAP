import { describe, expect, it, vi } from "vitest";
import { api, ApiError } from "@services/api";

describe("api()", () => {
  it("lança ApiError com status e código da resposta", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: false, error: "SYNC_IN_PROGRESS" }), { status: 409 }))
    );

    const error = await api("/api/integrations/gdms/sync", { method: "POST" }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: "SYNC_IN_PROGRESS" });
  });

  it("redireciona para /login quando a API responde 401", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { pathname: "/dashboard", assign } });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: false, error: "SESSION_REVOKED" }), { status: 401 }))
    );

    await expect(api("/api/stats")).rejects.toMatchObject({ status: 401, code: "SESSION_REVOKED" });
    expect(assign).toHaveBeenCalledWith("/login");
  });

  it("não redireciona quando já está no /login", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { pathname: "/login", assign } });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));

    await expect(api("/api/me")).rejects.toBeInstanceOf(ApiError);
    expect(assign).not.toHaveBeenCalled();
  });
});
