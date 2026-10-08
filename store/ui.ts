import { create } from "zustand";
import { readSidebarCollapsed, writeSidebarCollapsed } from "@lib/sidebarPreference";

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

type UIState = {
  // Desktop: sidebar recolhida (só ícones). A escolha fica salva no navegador.
  sidebarCollapsed: boolean;
  // Celular: gaveta do menu aberta. Começa fechada e não é salva.
  mobileMenuOpen: boolean;
  hydrateSidebar: () => void;
  setSidebarCollapsed: (value: boolean) => void;
  setMobileMenuOpen: (value: boolean) => void;
};

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  mobileMenuOpen: false,
  hydrateSidebar: () => set({ sidebarCollapsed: readSidebarCollapsed(browserStorage()) }),
  setSidebarCollapsed: (value) => {
    writeSidebarCollapsed(value, browserStorage());
    set({ sidebarCollapsed: value });
  },
  setMobileMenuOpen: (value) => set({ mobileMenuOpen: value }),
}));
