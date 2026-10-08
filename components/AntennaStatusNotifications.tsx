"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faCircleExclamation,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { connectSSE } from "@services/sseClient";

type AntennaStatus = "UP" | "DOWN";

type ToastItem = {
  id: string;
  antennaId: number | string;
  name: string;
  networkName: string | null;
  previousStatus: AntennaStatus | null;
  status: AntennaStatus;
};

const MAX_TOASTS = 4;
const AUTO_DISMISS_MS = 6500;

function normalizeStatus(value: unknown): AntennaStatus | null {
  return value === "UP" || value === "DOWN" ? value : null;
}

function buildToast(payload: Record<string, unknown>) {
  const status = normalizeStatus(payload.status);
  if (!status) return null;

  const previousStatus = normalizeStatus(payload.previousStatus);
  const rawAntennaId = payload.id ?? payload.antennaId;
  const antennaId =
    typeof rawAntennaId === "number" || typeof rawAntennaId === "string"
      ? rawAntennaId
      : String(Date.now());
  const name =
    typeof payload.name === "string" && payload.name.trim()
      ? payload.name.trim()
      : `AP ${String(antennaId)}`;
  const networkName =
    typeof payload.networkName === "string" && payload.networkName.trim()
      ? payload.networkName.trim()
      : null;
  const at = typeof payload.at === "string" && payload.at.trim() ? payload.at.trim() : Date.now();

  return {
    id: `${String(antennaId)}-${String(at)}-${status}`,
    antennaId,
    name,
    networkName,
    previousStatus,
    status,
  } satisfies ToastItem;
}

export default function AntennaStatusNotifications() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Record<string, number>>({});

  const removeToast = useCallback((id: string) => {
    const timerId = timersRef.current[id];
    if (timerId) {
      window.clearTimeout(timerId);
      delete timersRef.current[id];
    }

    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    const disconnect = connectSSE((event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.event !== "status.changed" || !payload || typeof payload !== "object") {
          return;
        }

        const nextToast = buildToast(payload as Record<string, unknown>);
        if (!nextToast) return;

        setToasts((current) => {
          const deduped = current.filter(
            (toast) =>
              !(
                toast.antennaId === nextToast.antennaId &&
                toast.status === nextToast.status &&
                toast.previousStatus === nextToast.previousStatus
              )
          );

          return [nextToast, ...deduped].slice(0, MAX_TOASTS);
        });

        const timerId = window.setTimeout(() => removeToast(nextToast.id), AUTO_DISMISS_MS);
        timersRef.current[nextToast.id] = timerId;
      } catch {}
    });

    return () => {
      disconnect();
      Object.values(timersRef.current).forEach((timerId) => window.clearTimeout(timerId));
      timersRef.current = {};
    };
  }, [removeToast]);

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[1200] flex w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-3">
      {toasts.map((toast) => {
        const isOffline = toast.status === "DOWN";

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-md ${
              isOffline
                ? "border-rose-500/30 bg-rose-500/12 text-rose-950 dark:text-rose-100"
                : "border-emerald-500/30 bg-emerald-500/12 text-emerald-950 dark:text-emerald-100"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full ${
                  isOffline
                    ? "bg-rose-500/18 text-rose-700 dark:text-rose-200"
                    : "bg-emerald-500/18 text-emerald-700 dark:text-emerald-200"
                }`}
              >
                <FontAwesomeIcon
                  icon={isOffline ? faCircleExclamation : faCheckCircle}
                  className="h-4 w-4"
                />
              </span>

              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">
                  {isOffline ? "AP offline" : "AP online novamente"}
                </div>
                <div className="mt-0.5 text-sm">
                  <strong>{toast.name}</strong>{" "}
                  <span className="opacity-90">
                    {isOffline ? "ficou offline." : "voltou a ficar online."}
                  </span>
                </div>
                {toast.networkName ? (
                  <div className="mt-1 text-xs opacity-75">{toast.networkName}</div>
                ) : null}
                {isOffline ? (
                  <Link
                    href="/incidents"
                    onClick={() => removeToast(toast.id)}
                    className="mt-1 inline-block text-xs font-medium underline underline-offset-4"
                  >
                    Ver ocorrências
                  </Link>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Fechar notificação"
                title="Fechar notificação"
              >
                <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
