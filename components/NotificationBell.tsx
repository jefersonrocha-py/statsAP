"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell } from "@fortawesome/free-solid-svg-icons";
import { formatDateTimeBR } from "@lib/dateFormat";
import { INCIDENT_STATUS_LABELS, INCIDENT_STATUS_STYLES } from "@lib/incidentFormat";
import { api, type NotificationSummary } from "@services/api";
import { connectSSE } from "@services/sseClient";

const REFRESH_MS = 60_000;

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<NotificationSummary | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      setSummary(await api<NotificationSummary>("/api/notifications"));
    } catch {}
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(load, REFRESH_MS);
    const disconnect = connectSSE((event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === "incident.opened" || payload.event === "incident.updated") void load();
      } catch {}
    });
    return () => {
      window.clearInterval(timer);
      disconnect();
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function markAllRead() {
    try {
      await api("/api/notifications/seen", { method: "POST" });
      await load();
    } catch {}
  }

  function openIncident(id: number) {
    setOpen(false);
    router.push(`/incidents?id=${id}`);
  }

  const unread = summary?.unread ?? 0;
  const badge = unread > 99 ? "99+" : String(unread);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="surface-soft-hover relative grid h-8 w-8 place-items-center rounded-lg sm:h-9 sm:w-9"
        title="Notificações"
        aria-label={unread ? `Notificações: ${unread} não lida(s)` : "Notificações"}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <FontAwesomeIcon icon={faBell} className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-rose-600 px-1 text-center text-[10px] font-semibold leading-[18px] text-white">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notificações de ocorrências"
          className="surface-popover absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl p-3"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">Ocorrências</div>
              <div className="text-xs opacity-70">{summary?.openCount ?? 0} em aberto</div>
            </div>
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={unread === 0}
              className="rounded-lg px-2 py-1 text-xs underline-offset-4 hover:underline disabled:opacity-40"
            >
              Marcar como lidas
            </button>
          </div>

          <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
            {(summary?.items ?? []).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => openIncident(item.id)}
                  className="surface-soft-hover w-full rounded-xl px-3 py-2 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      {item.isUnread ? (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" aria-label="Não lida" />
                      ) : null}
                      <span className="truncate text-sm font-medium">{item.antennaName}</span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${INCIDENT_STATUS_STYLES[item.status]}`}
                    >
                      {INCIDENT_STATUS_LABELS[item.status]}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs opacity-70">
                    {item.networkName ? `${item.networkName} · ` : ""}
                    {formatDateTimeBR(item.lastDownAt)}
                  </div>
                </button>
              </li>
            ))}
            {summary && summary.items.length === 0 && (
              <li className="px-3 py-4 text-center text-sm opacity-70">Nenhuma ocorrência registrada.</li>
            )}
          </ul>

          <Link
            href="/incidents"
            onClick={() => setOpen(false)}
            className="mt-2 block rounded-xl px-3 py-2 text-center text-sm font-medium underline-offset-4 hover:underline"
          >
            Ver todas as ocorrências
          </Link>
        </div>
      )}
    </div>
  );
}
