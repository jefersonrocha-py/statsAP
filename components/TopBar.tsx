"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useThemeStore } from "@store/theme";
import { useUIStore } from "@store/ui";
import NotificationBell from "@components/NotificationBell";
import { buildApiHeaders } from "@services/api";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faRightFromBracket,
  faMagnifyingGlass,
  faRotateRight,
  faExpand,
  faCompress,
  faMoon,
  faSun,
} from "@fortawesome/free-solid-svg-icons";

/**
 * TopBar
 * - Botão ☰ (só no celular) abre a gaveta do menu
 * - Busca (Enter -> "search-antennas")
 * - Recarregar / Fullscreen do mapa (#map-root)
 * - Toggle de tema via store
 * - Sair
 */
export default function TopBar() {
  const router = useRouter();
  const { mobileMenuOpen, setMobileMenuOpen } = useUIStore();

  // ===== Busca
  const [q, setQ] = useState("");
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const term = q.trim();
      window.dispatchEvent(
        new CustomEvent("search-antennas", { detail: { q: term } }) as any
      );
    }
  };

  // ===== Fullscreen do MAPA (#map-root)
  const [isFs, setIsFs] = useState(false);

  // helper para checar se #map-root está em fullscreen
  function isElementFullscreen(el: HTMLElement | null): boolean {
    if (!el) return false;
    const current = document.fullscreenElement;
    // garante boolean puro
    return Boolean(current && (current === el || el.contains(current)));
  }

  useEffect(() => {
    const handler = () => {
      const el = document.getElementById("map-root");
      setIsFs(isElementFullscreen(el));
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = document.getElementById("map-root") as HTMLElement | null;
    if (!el) return;
    try {
      const currentlyFs = isElementFullscreen(el);
      if (!currentlyFs) {
        // entrar em fullscreen
        const anyEl = el as any;
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (anyEl.webkitRequestFullscreen) await anyEl.webkitRequestFullscreen();
        setIsFs(true);
      } else {
        // sair de fullscreen
        const anyDoc = document as any;
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (anyDoc.webkitExitFullscreen) await anyDoc.webkitExitFullscreen();
        setIsFs(false);
      }
    } catch {
      /* noop */
    }
  }, []);

  // ===== Tema
  const { resolvedTheme, toggle: toggleTheme } = useThemeStore();
  const isLight = resolvedTheme === "light";

  // ===== Logout
  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: buildApiHeaders(undefined, "POST"),
      });
    } catch {}
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-30">
      <div className="glass rounded-none border-0">
        <div className="mx-auto max-w-[1600px] px-3 sm:px-4 py-2.5">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Menu (celular): no desktop a sidebar fica sempre visível */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="surface-soft-hover grid h-9 w-9 shrink-0 place-items-center rounded-lg md:hidden"
              aria-label="Abrir menu"
              title="Abrir menu"
              aria-controls="app-mobile-menu"
              aria-expanded={mobileMenuOpen}
            >
              <FontAwesomeIcon icon={faBars} className="h-4 w-4" />
            </button>

            {/* Busca */}
            <div className="flex-1">
              <div className="relative mx-auto max-w-xl lg:max-w-2xl">
                <FontAwesomeIcon
                  icon={faMagnifyingGlass}
                  className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60 h-4 w-4"
                />
                <input
                  className="surface-field h-9 w-full rounded-lg pl-9 pr-3 outline-none focus:ring-2 focus:ring-brand3"
                  placeholder="Pesquisar antena (nome)..."
                  aria-label="Pesquisar antena"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={onKeyDown}
                />
              </div>
            </div>

            {/* Ações à direita */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Recarregar */}
              <button
                onClick={() => location.reload()}
                className="surface-soft-hover grid h-8 w-8 place-items-center rounded-lg sm:h-9 sm:w-9"
                title="Recarregar"
                aria-label="Recarregar"
              >
                <FontAwesomeIcon icon={faRotateRight} className="h-4 w-4" />
              </button>

              {/* Fullscreen do mapa */}
              <button
                onClick={toggleFullscreen}
                className="surface-soft-hover grid h-8 w-8 place-items-center rounded-lg sm:h-9 sm:w-9"
                title={isFs ? "Sair da tela cheia do mapa" : "Tela cheia do mapa"}
                aria-label="Alternar tela cheia do mapa"
              >
                <FontAwesomeIcon icon={isFs ? faCompress : faExpand} className="h-4 w-4" />
              </button>

              {/* Notificações de ocorrências */}
              <NotificationBell />

              {/* Tema */}
              <button
                onClick={toggleTheme}
                className="surface-soft-hover grid h-8 w-8 place-items-center rounded-lg sm:h-9 sm:w-9"
                title={isLight ? "Ativar tema escuro" : "Ativar tema claro"}
                aria-label="Alternar tema"
              >
                <FontAwesomeIcon icon={isLight ? faSun : faMoon} className="h-4 w-4" />
              </button>

              {/* Sair */}
              <button
                onClick={handleLogout}
                className="surface-soft-hover inline-flex h-8 items-center gap-2 rounded-lg px-2.5 sm:h-9 sm:px-3"
                title="Sair"
                aria-label="Sair"
              >
                <FontAwesomeIcon icon={faRightFromBracket} className="h-4 w-4" />
                <span className="hidden md:inline text-sm">Sair</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
