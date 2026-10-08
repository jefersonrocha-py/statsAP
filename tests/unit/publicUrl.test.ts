import { beforeEach, describe, expect, it } from "vitest";
import { buildPublicUrl } from "@lib/publicUrl";

function request(headers: Record<string, string> = {}) {
  return new Request("http://0.0.0.0:3000/api/x", { headers });
}

describe("buildPublicUrl", () => {
  beforeEach(() => {
    delete process.env.APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.TRUST_PROXY_HEADERS;
  });

  it("usa o override quando informado", () => {
    process.env.APP_URL = "https://stats.exemplo.com";
    expect(buildPublicUrl(request(), "/reset-password", { token: "abc" }, "https://auth.exemplo.com/")).toBe(
      "https://auth.exemplo.com/reset-password?token=abc"
    );
  });

  it("usa APP_URL", () => {
    process.env.APP_URL = "https://stats.exemplo.com";
    expect(buildPublicUrl(request(), "/accept-invite", { token: "t" })).toBe(
      "https://stats.exemplo.com/accept-invite?token=t"
    );
  });

  it("ignora X-Forwarded-* sem TRUST_PROXY_HEADERS", () => {
    const req = request({ "x-forwarded-proto": "https", "x-forwarded-host": "evil.test", host: "stats.local:3200" });
    expect(buildPublicUrl(req, "/x", {})).toBe("http://stats.local:3200/x");
  });

  it("usa X-Forwarded-* com TRUST_PROXY_HEADERS=true", () => {
    process.env.TRUST_PROXY_HEADERS = "true";
    const req = request({ "x-forwarded-proto": "https", "x-forwarded-host": "stats.exemplo.com", host: "web:3000" });
    expect(buildPublicUrl(req, "/x", {})).toBe("https://stats.exemplo.com/x");
  });

  it("troca 0.0.0.0 por localhost", () => {
    expect(buildPublicUrl(request(), "/x", {})).toBe("http://localhost:3000/x");
  });
});
