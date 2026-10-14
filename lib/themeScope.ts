// As telas de autenticação têm visual fixo (claro): o tema escolhido dentro do app não vale para elas.

export const FIXED_THEME_PATHS = ["/login", "/forgot-password", "/reset-password", "/accept-invite"] as const;

export function hasFixedTheme(pathname: string): boolean {
  return FIXED_THEME_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function displayedTheme(resolved: "light" | "dark", pathname: string): "light" | "dark" {
  return hasFixedTheme(pathname) ? "light" : resolved;
}
