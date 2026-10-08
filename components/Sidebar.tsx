"use client";

import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChartPie,
  faChevronLeft,
  faChevronRight,
  faFilter,
  faGear,
  faLocationDot,
  faMap,
  faShieldHalved,
  faTriangleExclamation,
  faUsers,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UrlObject } from "url";
import BrandMark from "@components/BrandMark";
import { APP_VERSION_LABEL } from "@lib/version";
import { useUIStore } from "@store/ui";
import { connectSSE } from "@services/sseClient";

const SIDEBAR_BACKGROUND =
  "linear-gradient(180deg, rgba(16,78,76,1) 0%, rgba(30,41,41,1) 42%, rgba(12,129,96,0.92) 100%)";

type Role = "SUPERADMIN" | "ADMIN" | "USER";
type MeResponse =
  | { ok: true; user: { id: string | number; name: string; email: string; role: Role } }
  | { ok: false; error: string };
type StatsResponse = { ok: true; total: number; up: number; down: number } | { ok: false; error: string };

type NavLink = {
  path: string;
  href: UrlObject;
  icon: any;
  label: string;
};

type NavItemProps = {
  href: UrlObject;
  icon: any;
  label: string;
  expanded: boolean;
  active: boolean;
  onClick?: () => void;
};

type SidebarContentProps = {
  expanded: boolean;
  role: Role | null;
  userName: string;
  clockLabel: string;
  dateLabel: string;
  stats: { total: number; up: number; down: number };
  pathname: string;
  onNavigate?: () => void;
  onClose?: () => void;
};

function NavItem({ href, icon, label, expanded, active, onClick }: NavItemProps) {
  return (
    <Link
      href={href}
      title={label}
      onClick={onClick}
      prefetch={false}
      className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition ${
        expanded ? "" : "justify-center"
      } ${
        active ? "bg-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]" : ""
      } hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400`}
      aria-current={active ? "page" : undefined}
    >
      <FontAwesomeIcon className="h-4 w-4 shrink-0" icon={icon} />
      {expanded ? <span className="text-sm">{label}</span> : <span className="sr-only">{label}</span>}
    </Link>
  );
}

// Botão redondo na borda direita da sidebar do desktop: « recolhe, » expande.
function CollapseToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const label = collapsed ? "Expandir menu" : "Recolher menu";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      aria-expanded={!collapsed}
      aria-controls="app-sidebar"
      className="absolute -right-3.5 top-[18px] z-10 grid h-7 w-7 place-items-center rounded-full border border-white/25 bg-[rgb(16,78,76)] text-white shadow-[0_6px_16px_-6px_rgba(2,6,23,0.6)] transition hover:bg-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
    >
      <FontAwesomeIcon icon={collapsed ? faChevronRight : faChevronLeft} className="h-3 w-3" />
    </button>
  );
}

function WelcomePanel({
  userName,
  clockLabel,
  dateLabel,
}: {
  userName: string;
  clockLabel: string;
  dateLabel: string;
}) {
  return (
    <div className="border-b border-white/10 p-3">
      <div className="rounded-2xl border border-white/10 bg-white/8 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <div className="text-xs uppercase tracking-[0.22em] text-white/60">Bem-vindo</div>
        <div className="mt-1 text-lg font-semibold">{userName}</div>
        <div className="mt-3 rounded-2xl bg-black/20 px-4 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="font-mono text-2xl tracking-[0.16em]">{clockLabel}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.2em] text-white/60">{dateLabel}</div>
        </div>
      </div>
    </div>
  );
}

function SidebarFooterPanel({
  expanded,
  stats,
}: {
  expanded: boolean;
  stats: { total: number; up: number; down: number };
}) {
  if (!expanded) {
    return (
      <div className="space-y-2 p-2">
        <MiniStatus label="ON" value={stats.up} tone="emerald" />
        <MiniStatus label="OFF" value={stats.down} tone="rose" />
        {APP_VERSION_LABEL ? (
          <div className="text-center text-[10px] tracking-[0.12em] text-white/50">{APP_VERSION_LABEL}</div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-white/10 p-3">
      <div className="grid gap-2">
        <StatusCard label="APs ON" value={stats.up} tone="emerald" />
        <StatusCard label="APs OFF" value={stats.down} tone="rose" />
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75">
          Total monitorado: <strong className="text-white">{stats.total}</strong>
        </div>
      </div>
      {APP_VERSION_LABEL ? (
        <div className="text-center text-[11px] tracking-[0.16em] text-white/50">Stats A.P {APP_VERSION_LABEL}</div>
      ) : null}
    </div>
  );
}

function StatusCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "rose";
}) {
  const iconClasses =
    tone === "emerald"
      ? "bg-emerald-500/20 text-emerald-300"
      : "bg-rose-500/20 text-rose-300";

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <span className={`grid h-10 w-10 place-items-center rounded-2xl ${iconClasses}`}>
        <FontAwesomeIcon icon={faLocationDot} className="h-4 w-4" />
      </span>
      <div>
        <div className="text-xs uppercase tracking-[0.18em] text-white/55">{label}</div>
        <div className="text-xl font-semibold">{value}</div>
      </div>
    </div>
  );
}

function MiniStatus({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "rose";
}) {
  const iconClasses =
    tone === "emerald"
      ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
      : "border-rose-400/30 bg-rose-500/15 text-rose-300";

  return (
    <div className={`rounded-2xl border px-2 py-2 text-center text-[11px] ${iconClasses}`}>
      <div className="uppercase tracking-[0.18em]">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function SidebarContent({
  expanded,
  role,
  userName,
  clockLabel,
  dateLabel,
  stats,
  pathname,
  onNavigate,
  onClose,
}: SidebarContentProps) {
  const canManage = role === "ADMIN" || role === "SUPERADMIN";
  const links: NavLink[] = [
    { path: "/", href: { pathname: "/" }, icon: faMap, label: "Mapa" },
    { path: "/dashboard", href: { pathname: "/dashboard" }, icon: faChartPie, label: "Dashboard" },
    { path: "/clients", href: { pathname: "/clients" }, icon: faUsers, label: "Clientes" },
    {
      path: "/incidents",
      href: { pathname: "/incidents" },
      icon: faTriangleExclamation,
      label: "Ocorrências",
    },
    {
      path: "/filter-cluster",
      href: { pathname: "/filter-cluster" },
      icon: faFilter,
      label: "Filtros Cluster",
    },
    ...(canManage
      ? [{ path: "/settings", href: { pathname: "/settings" }, icon: faGear, label: "Configurações" }]
      : []),
  ];

  const isActive = (path: string) => (path === "/" ? pathname === "/" : pathname.startsWith(path));

  return (
    <div className="flex h-full flex-col">
      <div
        className={`flex min-h-[64px] items-center border-b border-white/10 px-4 py-3 ${
          expanded ? "justify-between" : "justify-center"
        }`}
      >
        <Link
          href={{ pathname: "/" }}
          prefetch={false}
          onClick={onNavigate}
          className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          title="Stats A.P"
        >
          <BrandMark variant={expanded ? "full" : "icon"} inverted />
        </Link>

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            title="Fechar menu"
            className="grid h-9 w-9 place-items-center rounded-xl text-white/80 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {expanded ? <WelcomePanel userName={userName} clockLabel={clockLabel} dateLabel={dateLabel} /> : null}

      <nav className="space-y-1 overflow-y-auto p-2" aria-label="Menu principal">
        {links.map((link) => (
          <NavItem
            key={link.path}
            href={link.href}
            icon={link.icon}
            label={link.label}
            expanded={expanded}
            active={isActive(link.path)}
            onClick={onNavigate}
          />
        ))}

        {role === "SUPERADMIN" && (
          <>
            {expanded ? (
              <div className="mt-4 px-3 text-xs uppercase tracking-[0.22em] text-white/50">Administração</div>
            ) : (
              <div className="mx-3 mt-3 border-t border-white/10" />
            )}
            <NavItem
              href={{ pathname: "/admin" }}
              icon={faShieldHalved}
              label="Painel"
              expanded={expanded}
              active={isActive("/admin")}
              onClick={onNavigate}
            />
          </>
        )}
      </nav>

      <div className="mt-auto">
        <SidebarFooterPanel expanded={expanded} stats={stats} />
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, setSidebarCollapsed, mobileMenuOpen, setMobileMenuOpen } = useUIStore();
  const [role, setRole] = useState<Role | null>(null);
  const [userName, setUserName] = useState("Usuário");
  const [stats, setStats] = useState({ total: 0, up: 0, down: 0 });
  const [now, setNow] = useState<Date | null>(null);

  // A gaveta do celular fecha ao trocar de página e com Esc.
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname, setMobileMenuOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setMobileMenuOpen]);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadSidebarData() {
      try {
        const [meResponse, statsResponse] = await Promise.all([
          fetch("/api/me", { cache: "no-store" }),
          fetch("/api/stats", { cache: "no-store" }),
        ]);

        const meJson: MeResponse = await meResponse.json();
        const statsJson: StatsResponse = await statsResponse.json();
        if (!alive) return;

        if (meJson.ok) {
          setRole(meJson.user.role);
          setUserName(meJson.user.name || "Usuário");
        } else {
          setRole(null);
          setUserName("Usuário");
        }

        if (statsJson.ok) {
          setStats({
            total: statsJson.total ?? 0,
            up: statsJson.up ?? 0,
            down: statsJson.down ?? 0,
          });
        } else {
          setStats({ total: 0, up: 0, down: 0 });
        }
      } catch {
        if (alive) {
          setRole(null);
          setUserName("Usuário");
          setStats({ total: 0, up: 0, down: 0 });
        }
      }
    }

    loadSidebarData();
    const refreshTimer = window.setInterval(loadSidebarData, 60_000);
    const disconnect = connectSSE((event) => {
      try {
        const payload = JSON.parse(event.data);
        if (
          ["antenna.created", "antenna.updated", "antenna.deleted", "status.changed"].includes(
            payload.event
          )
        ) {
          loadSidebarData();
        }
      } catch {}
    });

    return () => {
      alive = false;
      window.clearInterval(refreshTimer);
      disconnect();
    };
  }, []);

  const clockLabel = useMemo(
    () =>
      now
        ? new Intl.DateTimeFormat("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }).format(now)
        : "--:--:--",
    [now]
  );

  const dateLabel = useMemo(
    () =>
      now
        ? new Intl.DateTimeFormat("pt-BR", {
            weekday: "short",
            day: "2-digit",
            month: "short",
          }).format(now)
        : "---, -- ---",
    [now]
  );

  const firstName = useMemo(() => userName.trim().split(/\s+/)[0] || "Usuário", [userName]);

  const contentProps = {
    role,
    userName: firstName,
    clockLabel,
    dateLabel,
    stats,
    pathname,
  };

  return (
    <>
      {/* Desktop: fixa, recolhível. */}
      <aside
        id="app-sidebar"
        aria-label="Navegação"
        className={`fixed left-0 top-0 z-50 hidden h-screen flex-col text-white transition-[width] duration-300 ease-out md:flex ${
          sidebarCollapsed ? "md:w-20" : "md:w-72"
        }`}
        style={{ background: SIDEBAR_BACKGROUND }}
      >
        <SidebarContent expanded={!sidebarCollapsed} {...contentProps} />
        <CollapseToggle collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      </aside>

      {/* Celular: gaveta aberta pelo botão ☰ do topo. */}
      <div
        onClick={() => setMobileMenuOpen(false)}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] transition-opacity md:hidden ${
          mobileMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden
      />

      <aside
        id="app-mobile-menu"
        aria-label="Navegação"
        aria-hidden={!mobileMenuOpen}
        className={`fixed left-0 top-0 z-50 flex h-screen w-72 max-w-[85vw] flex-col text-white transition-[transform,visibility] duration-300 md:hidden ${
          mobileMenuOpen ? "visible translate-x-0" : "invisible -translate-x-full"
        }`}
        style={{ background: SIDEBAR_BACKGROUND }}
      >
        <SidebarContent
          expanded
          {...contentProps}
          onNavigate={() => setMobileMenuOpen(false)}
          onClose={() => setMobileMenuOpen(false)}
        />
      </aside>
    </>
  );
}
