"use client";

import TopBar from "@components/TopBar";
import Footer from "@components/Footer";
import AntennaStatusNotifications from "@components/AntennaStatusNotifications";
import { useUIStore } from "@store/ui";
import { useEffect } from "react";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed, hydrateSidebar } = useUIStore();

  // Lê a preferência salva só no navegador; o servidor sempre renderiza a sidebar expandida.
  useEffect(() => {
    hydrateSidebar();
  }, [hydrateSidebar]);

  // A margem só existe no desktop; no celular a sidebar é uma gaveta sobreposta.
  const ml = sidebarCollapsed ? "md:ml-20" : "md:ml-72";

  return (
    <div className={`relative flex min-h-screen flex-col transition-[margin] duration-300 ${ml}`}>
      <TopBar />
      <AntennaStatusNotifications />
      <main className="flex-1 p-4 md:p-6">{children}</main>
      <Footer />
    </div>
  );
}
