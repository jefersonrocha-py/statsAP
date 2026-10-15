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
  it("telas de autenticação ficam sempre escuras, mesmo com o tema claro escolhido", () => {
    expect(displayedTheme("light", "/login")).toBe("dark");
    expect(displayedTheme("dark", "/login")).toBe("dark");
    expect(displayedTheme("light", "/forgot-password")).toBe("dark");
  });

  it("as demais telas usam o tema escolhido", () => {
    expect(displayedTheme("dark", "/dashboard")).toBe("dark");
    expect(displayedTheme("light", "/dashboard")).toBe("light");
  });
});
