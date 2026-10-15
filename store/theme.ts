import { create } from "zustand";
import { displayedTheme } from "@lib/themeScope";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "theme";

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !("matchMedia" in window)) {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(theme: ThemeMode): ResolvedTheme {
  return theme === "system" ? getSystemTheme() : theme;
}

// A preferência vale para o app; as telas de autenticação ficam sempre escuras (lib/themeScope.ts).
function applyTheme(theme: ThemeMode) {
  const resolvedTheme = resolveTheme(theme);

  if (typeof window !== "undefined") {
    const root = document.documentElement;
    const shown = displayedTheme(resolvedTheme, window.location.pathname);
    root.classList.toggle("dark", shown === "dark");
    root.style.colorScheme = shown;
    root.dataset.theme = theme;

    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
  }

  return resolvedTheme;
}

function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";

  try {
    const savedTheme = localStorage.getItem(STORAGE_KEY);
    return isThemeMode(savedTheme) ? savedTheme : "system";
  } catch {
    return "system";
  }
}

type ThemeState = {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  initialized: boolean;
  initialize: () => void;
  setTheme: (theme: ThemeMode) => void;
  toggle: () => void;
  syncSystemTheme: () => void;
  reapply: () => void;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "system",
  resolvedTheme: "light",
  initialized: false,
  initialize: () => {
    const theme = getStoredTheme();
    const resolvedTheme = applyTheme(theme);
    set({ theme, resolvedTheme, initialized: true });
  },
  setTheme: (theme) => {
    const resolvedTheme = applyTheme(theme);
    set({ theme, resolvedTheme, initialized: true });
  },
  toggle: () => {
    const nextTheme: ThemeMode = get().resolvedTheme === "dark" ? "light" : "dark";
    get().setTheme(nextTheme);
  },
  syncSystemTheme: () => {
    if (get().theme !== "system") return;
    const resolvedTheme = applyTheme("system");
    set({ resolvedTheme, initialized: true });
  },
  // Reaplica ao trocar de tela: entrar ou sair do login muda o que deve aparecer.
  reapply: () => {
    if (!get().initialized) return;
    applyTheme(get().theme);
  },
}));

export function initThemeFromStorage() {
  useThemeStore.getState().initialize();
}

export function watchSystemTheme() {
  if (typeof window === "undefined" || !("matchMedia" in window)) {
    return () => undefined;
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = () => useThemeStore.getState().syncSystemTheme();

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }

  mediaQuery.addListener(handleChange);
  return () => mediaQuery.removeListener(handleChange);
}
