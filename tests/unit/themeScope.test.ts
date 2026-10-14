import { describe, expect, it } from "vitest";
import { displayedTheme, hasFixedTheme } from "@lib/themeScope";

describe("hasFixedTheme", () => {
  it.each(["/login", "/forgot-password", "/reset-password", "/accept-invite", "/login/", "/accept-invite/x"])(
    "a tela de autenticação %s não segue o tema do app",
    (pathname) => {
      expect(hasFixedTheme(pathname)).toBe(true);
    }
  );

  it.each(["/", "/dashboard", "/account", "/incidents", "/loginx", "/settings"])("%s segue o tema do app", (pathname) => {
    expect(hasFixedTheme(pathname)).toBe(false);
  });
});

describe("displayedTheme", () => {
  it("telas de autenticação ficam sempre claras, mesmo com o tema escuro escolhido", () => {
    expect(displayedTheme("dark", "/login")).toBe("light");
    expect(displayedTheme("light", "/login")).toBe("light");
  });

  it("as demais telas usam o tema escolhido", () => {
    expect(displayedTheme("dark", "/dashboard")).toBe("dark");
    expect(displayedTheme("light", "/dashboard")).toBe("light");
  });
});
