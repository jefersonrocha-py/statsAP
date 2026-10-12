"use client";

import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faDesktop, faMoon, faSun } from "@fortawesome/free-solid-svg-icons";
import { useThemeStore, type ThemeMode } from "@store/theme";

const OPTIONS: { value: ThemeMode; label: string; icon: typeof faSun }[] = [
  { value: "light", label: "Claro", icon: faSun },
  { value: "dark", label: "Escuro", icon: faMoon },
  { value: "system", label: "Sistema", icon: faDesktop },
];

export default function ThemeToggle() {
  const { theme, resolvedTheme, setTheme, initialized } = useThemeStore();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const activeOption = OPTIONS.find((option) => option.value === theme) ?? OPTIONS[2];
  const icon = !initialized ? faDesktop : resolvedTheme === "light" ? faSun : faMoon;
  const resolvedThemeLabel = resolvedTheme === "light" ? "Claro" : "Escuro";

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="surface-soft-hover inline-flex h-9 items-center gap-2 rounded-lg px-3"
        title="Selecionar tema"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Selecionar tema"
      >
        <FontAwesomeIcon icon={icon} className="h-4 w-4" />
        <span className="hidden text-sm md:inline">
          {initialized ? activeOption.label : "Tema"}
        </span>
        <FontAwesomeIcon
          icon={faChevronDown}
          className={`h-3 w-3 opacity-60 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          className="surface-popover absolute right-0 z-[500] mt-2 w-52 overflow-hidden rounded-xl"
        >
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={theme === option.value}
              onClick={() => {
                setTheme(option.value);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                theme === option.value ? "bg-emerald-500/16" : "hover:bg-white/10 dark:hover:bg-white/10"
              }`}
            >
              <FontAwesomeIcon icon={option.icon} className="h-4 w-4" />
              <span className="flex-1">{option.label}</span>
              {theme === option.value ? (
                <span className="text-[11px] uppercase tracking-[0.18em] opacity-65">
                  {option.value === "system" ? resolvedThemeLabel : "Ativo"}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
