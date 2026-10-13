import { beforeEach, describe, expect, it } from "vitest";
import { buildPublicUrl, getConfiguredPublicOrigin, PublicUrlNotConfiguredError } from "@lib/publicUrl";

describe("buildPublicUrl", () => {
  beforeEach(() => {
    delete process.env.APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("usa o override quando informado", () => {
    process.env.APP_URL = "https://stats.exemplo.com";
    expect(buildPublicUrl("/reset-password", { token: "abc" }, "https://auth.exemplo.com/")).toBe(
      "https://auth.exemplo.com/reset-password?token=abc"
    );
  });

  it("usa APP_URL", () => {
    process.env.APP_URL = "https://stats.exemplo.com";
    expect(buildPublicUrl("/accept-invite", { token: "t" })).toBe("https://stats.exemplo.com/accept-invite?token=t");
  });

  it("usa NEXT_PUBLIC_APP_URL quando APP_URL não foi definida", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://stats.exemplo.com/";
    expect(buildPublicUrl("/x", {})).toBe("https://stats.exemplo.com/x");
  });

  it("sem URL pública configurada, recusa montar o link em vez de confiar na requisição", () => {
    expect(() => buildPublicUrl("/reset-password", { token: "abc" })).toThrow(PublicUrlNotConfiguredError);
  });

  it("ignora valores que não são endereços http(s)", () => {
    process.env.APP_URL = "javascript:alert(1)";
    expect(getConfiguredPublicOrigin()).toBeNull();
    process.env.APP_URL = "sem protocolo";
    expect(getConfiguredPublicOrigin()).toBeNull();
  });
});
