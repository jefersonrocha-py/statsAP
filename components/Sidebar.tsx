"use client";

import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChartPie,
  faFilter,
  faGear,
  faLocationDot,
  faMap,
  faShieldHalved,
  faTriangleExclamation,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UrlObject } from "url";
import { useUIStore } from "@store/ui";
import { connectSSE } from "@services/sseClient";

const ETHERIUM_LOGO = {
  src: "/logo_etherium.png",
  alt: "Etheriumtech",
  width: 346,
  height: 369,
} as const;

const SIDEBAR_VERSION = "V.1.1.0";

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
  open: boolean;
  active: boolean;
  onClick?: () => void;
};

type SidebarContentProps = {
  open: boolean;
  role: Role | null;
  userName: string;
  clockLabel: string;
  dateLabel: string;
  stats: { total: number; up: number; down: number };
  pathname: string;
  onNavigate?: () => void;
  mobile?: boolean;
};

function NavItem({ href, icon, label, open, active, onClick }: NavItemProps) {
  return (
    <Link
      href={href}
      title={label}
      onClick={onClick}
      prefetch={false}
      className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition ${
        active ? "bg-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]" : ""
      } hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400`}
      aria-current={active ? "page" : undefined}
    >
      <FontAwesomeIcon className="h-4 w-4 shrink-0" icon={icon} />
      {open ? <span className="text-sm">{label}</span> : <span className="sr-only">{label}</span>}
    </Link>
  );
}

function Hamburger({
  open,
  onClick,
  title,
}: {
  open: boolean;
  onClick: () => void;
  title?: string;
}) {
  const barBase = "absolute block h-[2px] w-5 rounded-full bg-current";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={title || "Menu"}
      aria-expanded={open}
      aria-controls="app-sidebar"
      aria-pressed={open}
      title={title || "Menu"}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-black/5 transition-[background,transform] duration-200 active:scale-[0.98] hover:bg-black/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:bg-white/10 dark:hover:bg-white/20"
    >
      <span
        aria-hidden
        className={`absolute inset-0 rounded-xl transition-shadow duration-300 ${
          open ? "shadow-[0_0_0_8px_rgba(16,185,129,.10)]" : "shadow-none"
        }`}
      />
      <span
        className={`${barBase} -translate-y-1.5`}
      />
      <span className={barBase} />
      <span className={`${barBase} translate-y-1.5`} />
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
  open,
  stats,
}: {
  open: boolean;
  stats: { total: number; up: number; down: number };
}) {
  if (!open) {
    return (
      <div className="space-y-2 p-2">
        <MiniStatus label="ON" value={stats.up} tone="emerald" />
        <MiniStatus label="OFF" value={stats.down} tone="rose" />
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
  open,
  role,
  userName,
  clockLabel,
  dateLabel,
  stats,
  pathname,
  onNavigate,
  mobile = false,
}: SidebarContentProps) {
  const canManage = role === "ADMIN" || role === "SUPERADMIN";
  const navClick = mobile ? onNavigate : undefined;
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
      <div className="flex min-h-[64px] items-center gap-2 border-b border-white/10 p-3">
        {open ? (
          <>
            <div className="rounded-2xl border border-black/10 bg-white/95 px-3 py-2 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.7)]">
              <Image
                src={ETHERIUM_LOGO.src}
                alt={ETHERIUM_LOGO.alt}
                width={ETHERIUM_LOGO.width}
                height={ETHERIUM_LOGO.height}
                className="h-10 w-auto"
                priority
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="rounded-full border border-white/10 bg-black/15 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/65">
                {SIDEBAR_VERSION}
              </span>
              <Hamburger
                open={open}
                onClick={onNavigate || (() => undefined)}
                title={mobile ? "Fechar menu" : "Expandir ou recolher"}
              />
            </div>
          </>
        ) : (
          <>
            <Hamburger
              open={open}
              onClick={onNavigate || (() => undefined)}
              title={mobile ? "Fechar menu" : "Expandir ou recolher"}
            />
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-black/10 bg-white/95 p-2 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.7)]">
              <Image
                src={ETHERIUM_LOGO.src}
                alt={ETHERIUM_LOGO.alt}
                width={ETHERIUM_LOGO.width}
                height={ETHERIUM_LOGO.height}
                className="h-full w-auto max-w-full object-contain"
                priority
              />
            </div>
          </>
        )}
      </div>

      {open ? (
        <WelcomePanel
          userName={userName}
          clockLabel={clockLabel}
          dateLabel={dateLabel}
        />
      ) : null}

      <nav className="space-y-1 overflow-y-auto p-2">
        {links.map((link) => (
          <NavItem
            key={link.path}
            href={link.href}
            icon={link.icon}
            label={link.label}
            open={open}
            active={isActive(link.path)}
            onClick={navClick}
          />
        ))}

        {role === "SUPERADMIN" && (
          <>
            {open ? (
              <div className="mt-4 px-3 text-xs uppercase tracking-[0.22em] text-white/50">
                Administração
              </div>
            ) : (
              <div className="mt-3" />
            )}
            <NavItem
              href={{ pathname: "/admin" }}
              icon={faShieldHalved}
              label="Painel"
              open={open}
              active={isActive("/admin")}
              onClick={navClick}
            />
          </>
        )}
      </nav>

      <div className="mt-auto">
        <SidebarFooterPanel
          open={open}
          stats={stats}
        />
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const [role, setRole] = useState<Role | null>(null);
  const [userName, setUserName] = useState("Usuario");
  const [stats, setStats] = useState({ total: 0, up: 0, down: 0 });
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setSidebarOpen]);

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
          setUserName(meJson.user.name || "Usuario");
        } else {
          setRole(null);
          setUserName("Usuario");
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
          setUserName("Usuario");
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

  const firstName = useMemo(() => userName.trim().split(/\s+/)[0] || "Usuario", [userName]);

  return (
    <>
      <div
        onClick={() => setSidebarOpen(false)}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] transition-opacity md:hidden ${
          sidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!sidebarOpen}
      />

      <aside
        id="app-sidebar"
        className={`fixed left-0 top-0 z-50 hidden h-screen flex-col text-white transition-all duration-300 ease-out md:flex ${
          sidebarOpen ? "md:w-72" : "md:w-20"
        }`}
        style={{
          background:
            "linear-gradient(180deg, rgba(16,78,76,1) 0%, rgba(30,41,41,1) 42%, rgba(12,129,96,0.92) 100%)",
        }}
      >
        <SidebarContent
          open={sidebarOpen}
          role={role}
          userName={firstName}
          clockLabel={clockLabel}
          dateLabel={dateLabel}
          stats={stats}
          pathname={pathname}
          onNavigate={() => setSidebarOpen(!sidebarOpen)}
        />
      </aside>

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-80 flex-col text-white transition-transform duration-300 md:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background:
            "linear-gradient(180deg, rgba(16,78,76,1) 0%, rgba(30,41,41,1) 42%, rgba(12,129,96,0.92) 100%)",
        }}
        aria-hidden={!sidebarOpen}
      >
        <SidebarContent
          open={true}
          role={role}
          userName={firstName}
          clockLabel={clockLabel}
          dateLabel={dateLabel}
          stats={stats}
          pathname={pathname}
          onNavigate={() => setSidebarOpen(false)}
          mobile
        />
      </aside>

      <div
        aria-hidden
        className={`hidden transition-[width] duration-300 md:block ${sidebarOpen ? "w-72" : "w-20"}`}
      />
    </>
  );
}
