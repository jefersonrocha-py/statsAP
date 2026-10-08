"use client";

import { useCallback, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { formatDateTimeBR } from "@lib/dateFormat";
import {
  formatDuration,
  INCIDENT_EVENT_LABELS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUS_STYLES,
  RESOLUTION_LABELS,
} from "@lib/incidentFormat";
import { api, ApiError, type IncidentDetail } from "@services/api";
import { connectSSE } from "@services/sseClient";

type Action = "START" | "COMMENT" | "RESOLVE";

type Props = {
  incidentId: number;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
};

function describeActionError(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "MESSAGE_REQUIRED":
        return "Descreva o que foi feito: pelo menos 3 caracteres para comentar e 5 para resolver.";
      case "MESSAGE_TOO_LONG":
        return "O texto pode ter no máximo 2000 caracteres.";
      case "INVALID_TRANSITION":
        return "Esta ação não é permitida no status atual da ocorrência. Atualize a página.";
      case "FORBIDDEN":
        return "Apenas administradores podem tratar ocorrências.";
      case "NOT_FOUND":
        return "Ocorrência não encontrada.";
      default:
        break;
    }
  }
  return "Não foi possível registrar a ação.";
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-soft rounded-xl px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.16em] opacity-60">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}

export default function IncidentDetailPanel({ incidentId, canManage, onClose, onChanged }: Props) {
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<Action | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await api<{ ok: boolean; item: IncidentDetail }>(`/api/incidents/${incidentId}`);
      setDetail(response.item);
      setLoadError(null);
    } catch (error) {
      setLoadError(
        error instanceof ApiError && error.status === 404
          ? "Ocorrência não encontrada."
          : "Não foi possível carregar a ocorrência."
      );
    }
  }, [incidentId]);

  useEffect(() => {
    setDetail(null);
    setMessage("");
    setActionError(null);
    void load();
  }, [load]);

  useEffect(
    () =>
      connectSSE((event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.event === "incident.updated" && Number(payload.id) === incidentId) void load();
        } catch {}
      }),
    [incidentId, load]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function runAction(action: Action) {
    setBusy(action);
    setActionError(null);
    try {
      const response = await api<{ ok: boolean; item: IncidentDetail }>(`/api/incidents/${incidentId}/actions`, {
        method: "POST",
        body: JSON.stringify({ action, message }),
      });
      setDetail(response.item);
      setMessage("");
      onChanged();
    } catch (error) {
      setActionError(describeActionError(error));
    } finally {
      setBusy(null);
    }
  }

  const isResolved = detail?.status === "RESOLVED";

  return (
    <div className="fixed inset-0 z-[1100] flex justify-end bg-black/40 backdrop-blur-[1px]" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes da ocorrência"
        className="surface-overlay flex h-full w-full max-w-xl flex-col overflow-hidden backdrop-blur-md"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-black/10 p-4 dark:border-white/10">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] opacity-60">Ocorrência #{incidentId}</div>
            <h2 className="mt-1 break-words text-lg font-semibold">{detail?.antennaName ?? "Carregando..."}</h2>
            {detail?.networkName ? <div className="text-sm opacity-75">{detail.networkName}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="surface-soft-hover grid h-9 w-9 shrink-0 place-items-center rounded-lg"
            aria-label="Fechar detalhes"
            title="Fechar"
          >
            <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {loadError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
              {loadError}
            </div>
          )}

          {detail && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${INCIDENT_STATUS_STYLES[detail.status]}`}
                >
                  {INCIDENT_STATUS_LABELS[detail.status]}
                </span>
                {detail.resolution ? (
                  <span className="text-xs opacity-70">{RESOLUTION_LABELS[detail.resolution] ?? detail.resolution}</span>
                ) : null}
                {detail.antennaId === null ? (
                  <span className="text-xs opacity-70">AP removido do sistema</span>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Caiu em" value={formatDateTimeBR(detail.wentDownAt)} />
                <Field label="Última queda" value={formatDateTimeBR(detail.lastDownAt)} />
                <Field label="Voltou em" value={detail.recoveredAt ? formatDateTimeBR(detail.recoveredAt) : "Ainda offline"} />
                <Field label="Tempo offline" value={formatDuration(detail.offlineSeconds)} />
                <Field label="Quedas" value={String(detail.downCount)} />
                <Field label="Alerta por e-mail" value={detail.alertSentAt ? formatDateTimeBR(detail.alertSentAt) : "Não enviado"} />
              </div>

              <section aria-label="Linha do tempo">
                <h3 className="mb-2 text-sm font-semibold">Linha do tempo (auditoria)</h3>
                <ol className="space-y-2">
                  {detail.events.map((item) => (
                    <li key={item.id} className="surface-soft rounded-xl px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium">{INCIDENT_EVENT_LABELS[item.type] ?? item.type}</span>
                        <span className="text-xs opacity-70">{formatDateTimeBR(item.createdAt)}</span>
                      </div>
                      {item.message ? <p className="mt-1 whitespace-pre-wrap break-words">{item.message}</p> : null}
                      <div className="mt-1 text-xs opacity-60">por {item.actorName}</div>
                    </li>
                  ))}
                </ol>
              </section>
            </>
          )}
        </div>

        {detail && canManage && (
          <footer className="space-y-2 border-t border-black/10 p-4 dark:border-white/10">
            <label className="block text-sm font-medium" htmlFor="incident-message">
              {isResolved ? "Adicionar comentário" : "O que foi feito?"}
            </label>
            <textarea
              id="incident-message"
              className="surface-field w-full rounded-xl px-3 py-2 text-sm"
              rows={3}
              maxLength={2000}
              placeholder="Ex.: técnico no local, PoE reiniciado, cabo substituído..."
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            {actionError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                {actionError}
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              {detail.status === "OPEN" && (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void runAction("START")}
                  className="rounded-xl border border-amber-500/40 px-3 py-2 text-sm text-amber-700 disabled:opacity-50 dark:text-amber-300"
                >
                  {busy === "START" ? "Salvando..." : "Assumir tratativa"}
                </button>
              )}
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void runAction("COMMENT")}
                className="surface-button rounded-xl px-3 py-2 text-sm disabled:opacity-50"
              >
                {busy === "COMMENT" ? "Salvando..." : "Comentar"}
              </button>
              {!isResolved && (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void runAction("RESOLVE")}
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {busy === "RESOLVE" ? "Salvando..." : "Resolver"}
                </button>
              )}
            </div>
          </footer>
        )}
      </aside>
    </div>
  );
}
