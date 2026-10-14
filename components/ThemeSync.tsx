"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { initThemeFromStorage, useThemeStore, watchSystemTheme } from "@store/theme";

// No navegador, aplica antes da pintura para não piscar o tema errado ao trocar de tela.
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function ThemeSync() {
  const pathname = usePathname();

  useEffect(() => {
    initThemeFromStorage();
    return watchSystemTheme();
  }, []);

  useBeforePaint(() => {
    useThemeStore.getState().reapply();
  }, [pathname]);

  return null;
}
