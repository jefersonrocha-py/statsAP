"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDateTimeBR } from "@lib/dateFormat";
import { ROLE_OPTIONS, roleLabel } from "@lib/roles";
import { api, ApiError } from "@services/api";

type UserRole = "SUPERADMIN" | "ADMIN" | "USER";
type UserStatus = "ACTIVE" | "BLOCKED" | "SUSPENDED";

type User = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  isBlocked: boolean;
  suspendedUntil: string | null;
  createdAt: string;
};

type Invite = {
  id: number;
  email: string;
  role: UserRole;
  invitedByName: string | null;
  expiresAt: string | null;
  createdAt: string | null;
};

type Feedback = { kind: "error" | "success"; message: string } | null;

const EMPTY_INVITE = { email: "", role: "USER" as UserRole };

function describeError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const detail = error.payload?.details?.[0]?.message;
    if (typeof detail === "string" && detail.trim()) return detail;

    switch (error.code) {
      case "EMAIL_TAKEN":
        return "Já existe um usuário com este e-mail.";
      case "INVITE_EMAIL_FAILED":
        return "O convite foi criado, mas o e-mail não pôde ser enviado. Use “Reenviar” em instantes.";
      case "INVITE_NOT_FOUND":
        return "Convite não encontrado.";
      case "INVITE_NOT_PENDING":
        return "Este convite não está mais pendente.";
      case "CANNOT_MUTATE_SELF":
        return "Não é permitido bloquear ou suspender o próprio usuário.";
      case "CANNOT_DELETE_SELF":
        return "Não é permitido excluir o próprio usuário.";
      case "LAST_ACTIVE_SUPERADMIN":
        return "É preciso manter ao menos um superadministrador ativo.";
      case "USER_NOT_FOUND":
        return "Usuário não encontrado.";
      case "FORBIDDEN":
        return "Apenas superadministradores podem administrar usuários.";
      case "RATE_LIMITED":
        return "Muitas solicitações em sequência. Aguarde alguns minutos.";
      default:
        break;
    }
  }
  return fallback;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDateTimeLocalValue(date: Date) {
  return (
    [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join("-") +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function getDefaultSuspensionValue() {
  return toDateTimeLocalValue(new Date(Date.now() + 24 * 60 * 60_000));
}

function getStatusBadge(user: User) {
  if (user.status === "BLOCKED") {
    return { className: "bg-rose-500/15 text-rose-700 dark:text-rose-300", label: "Bloqueado" };
  }
  if (user.status === "SUSPENDED") {
    return { className: "bg-amber-500/15 text-amber-700 dark:text-amber-300", label: "Suspenso" };
  }
  return { className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", label: "Ativo" };
}

const STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: "ativo",
  BLOCKED: "bloqueado",
  SUSPENDED: "suspenso",
};

export default function AdminPage() {
  const [items, setItems] = useState<User[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [suspendDrafts, setSuspendDrafts] = useState<Record<number, string>>({});
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE);

  const load = useCallback(async () => {
    try {
      const [users, pending] = await Promise.all([
        api<{ items: User[] }>("/api/users"),
        api<{ items: Invite[] }>("/api/users/invites"),
      ]);
      setItems(users.items ?? []);
      setInvites(pending.items ?? []);
    } catch (error) {
      setFeedback({ kind: "error", message: describeError(error, "Não foi possível carregar os usuários.") });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return items.filter((user) =>
      [user.name, user.email, user.role, roleLabel(user.role), STATUS_LABELS[user.status]]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [items, q]);

  async function sendInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setFeedback(null);
    try {
      await api("/api/users/invites", { method: "POST", body: JSON.stringify(inviteForm) });
      setFeedback({ kind: "success", message: `Convite enviado para ${inviteForm.email}.` });
      setInviteForm(EMPTY_INVITE);
    } catch (error) {
      setFeedback({ kind: "error", message: describeError(error, "Não foi possível enviar o convite.") });
    } finally {
      setBusy(false);
      await load();
    }
  }

  async function runRowAction(key: string, action: () => Promise<unknown>, success: string, fallback: string) {
    setRowBusyId(key);
    setFeedback(null);
    try {
      await action();
      setFeedback({ kind: "success", message: success });
    } catch (error) {
      setFeedback({ kind: "error", message: describeError(error, fallback) });
    } finally {
      setRowBusyId(null);
      await load();
    }
  }

  function resendInvite(invite: Invite) {
    return runRowAction(
      `invite-${invite.id}`,
      () => api(`/api/users/invites/${invite.id}/resend`, { method: "POST" }),
      `Convite reenviado para ${invite.email}.`,
      "Não foi possível reenviar o convite."
    );
  }

  function revokeInvite(invite: Invite) {
    if (!window.confirm(`Revogar o convite de ${invite.email}? O link enviado deixará de funcionar.`)) return;
    return runRowAction(
      `invite-${invite.id}`,
      () => api(`/api/users/invites/${invite.id}`, { method: "DELETE" }),
      "Convite revogado.",
      "Não foi possível revogar o convite."
    );
  }

  function patchUser(user: User, body: Record<string, unknown>, success: string, fallback: string) {
    return runRowAction(
      `user-${user.id}`,
      () => api(`/api/users/${user.id}`, { method: "PATCH", body: JSON.stringify(body) }),
      success,
      fallback
    );
  }

  function handleActivate(user: User) {
    return patchUser(user, { action: "ACTIVATE" }, "Usuário reativado.", "Não foi possível reativar o usuário.");
  }

  function handleBlock(user: User) {
    if (!window.confirm(`Bloquear o acesso de ${user.email}?`)) return;
    return patchUser(user, { action: "BLOCK" }, "Usuário bloqueado.", "Não foi possível bloquear o usuário.");
  }

  function handleSuspend(user: User) {
    const draft = suspendDrafts[user.id] ?? getDefaultSuspensionValue();
    const suspensionDate = new Date(draft);
    if (Number.isNaN(suspensionDate.getTime())) {
      setFeedback({ kind: "error", message: "Informe uma data de suspensão válida." });
      return;
    }
    return patchUser(
      user,
      { action: "SUSPEND", suspendedUntil: suspensionDate.toISOString() },
      "Usuário suspenso.",
      "Não foi possível suspender o usuário."
    );
  }

  function handleDelete(user: User) {
    if (!window.confirm(`Excluir permanentemente o usuário ${user.email}?`)) return;
    return runRowAction(
      `user-${user.id}`,
      () => api(`/api/users/${user.id}`, { method: "DELETE" }),
      "Usuário excluído.",
      "Não foi possível excluir o usuário."
    );
  }

  const selectedRole = ROLE_OPTIONS.find((option) => option.value === inviteForm.role);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Painel do administrador</h1>
        <p className="text-sm opacity-75">
          Convide usuários por e-mail e gerencie bloqueio, suspensão temporária e exclusão de contas.
        </p>
      </div>

      {feedback && (
        <div
          role="status"
          className={`rounded-2xl border px-4 py-3 text-sm ${
            feedback.kind === "error"
              ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <section className="glass space-y-3 rounded-2xl p-4">
        <h2 className="text-base font-semibold">Convidar usuário</h2>
        <form onSubmit={sendInvite} className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <input
            className="surface-field w-full rounded-xl px-3 py-2"
            placeholder="E-mail do convidado"
            type="email"
            aria-label="E-mail do convidado"
            value={inviteForm.email}
            onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })}
            required
          />
          <select
            className="surface-field w-full rounded-xl py-2 pl-3 pr-10"
            aria-label="Perfil de acesso"
            value={inviteForm.role}
            onChange={(event) => setInviteForm({ ...inviteForm, role: event.target.value as UserRole })}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            className="rounded-xl bg-brand1 px-4 py-2 text-white hover:opacity-90 disabled:opacity-60"
            disabled={busy}
            type="submit"
          >
            {busy ? "Enviando..." : "Enviar convite"}
          </button>
        </form>
        <p className="text-xs opacity-70">
          {selectedRole ? `Perfil ${selectedRole.label}: ${selectedRole.description.charAt(0).toLowerCase()}${selectedRole.description.slice(1)}. ` : ""}
          O convidado recebe um link por e-mail, válido por tempo limitado e de uso único,
          para definir nome e senha.
        </p>
      </section>

      <section className="glass space-y-3 rounded-2xl p-4">
        <h2 className="text-base font-semibold">Convites pendentes</h2>
        <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-black/5 dark:bg-white/10">
              <tr>
                <th className="p-2 text-left">E-mail</th>
                <th className="p-2 text-left">Perfil</th>
                <th className="p-2 text-left">Convidado por</th>
                <th className="p-2 text-left">Expira em</th>
                <th className="p-2 text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => {
                const rowBusy = rowBusyId === `invite-${invite.id}`;
                return (
                  <tr key={invite.id} className="border-t border-black/10 dark:border-white/10">
                    <td className="p-2">{invite.email}</td>
                    <td className="p-2">{roleLabel(invite.role)}</td>
                    <td className="p-2">{invite.invitedByName ?? "-"}</td>
                    <td className="p-2 text-xs opacity-80">{formatDateTimeBR(invite.expiresAt)}</td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-700 disabled:opacity-50 dark:text-emerald-300"
                          disabled={rowBusy}
                          onClick={() => void resendInvite(invite)}
                        >
                          Reenviar
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs text-rose-700 disabled:opacity-50 dark:text-rose-300"
                          disabled={rowBusy}
                          onClick={() => void revokeInvite(invite)}
                        >
                          Revogar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {invites.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center opacity-60">
                    Nenhum convite pendente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass space-y-3 rounded-2xl p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <input
            placeholder="Buscar por nome, e-mail, perfil ou situação..."
            aria-label="Buscar usuários"
            className="surface-field w-full rounded-xl px-3 py-2 md:w-96"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
          <div className="text-xs opacity-70">
            {filtered.length} {filtered.length === 1 ? "usuário" : "usuários"}
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-black/5 dark:bg-white/10">
              <tr>
                <th className="p-2 text-left">Nome</th>
                <th className="p-2 text-left">E-mail</th>
                <th className="p-2 text-left">Perfil</th>
                <th className="p-2 text-left">Situação</th>
                <th className="p-2 text-left">Suspenso até</th>
                <th className="p-2 text-left">Criado em</th>
                <th className="p-2 text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => {
                const badge = getStatusBadge(user);
                const busyRow = rowBusyId === `user-${user.id}`;
                const suspensionValue = suspendDrafts[user.id] ?? getDefaultSuspensionValue();

                return (
                  <tr key={user.id} className="border-t border-black/10 align-top dark:border-white/10">
                    <td className="p-2 font-medium">{user.name}</td>
                    <td className="p-2">{user.email}</td>
                    <td className="p-2">{roleLabel(user.role)}</td>
                    <td className="p-2">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="p-2 text-xs opacity-80">{formatDateTimeBR(user.suspendedUntil)}</td>
                    <td className="p-2 text-xs opacity-70">{formatDateTimeBR(user.createdAt)}</td>
                    <td className="p-2">
                      <div className="flex min-w-[360px] flex-col gap-2">
                        <div className="flex flex-wrap gap-2">
                          {user.status === "ACTIVE" ? (
                            <>
                              <button
                                type="button"
                                className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs text-rose-700 disabled:opacity-50 dark:text-rose-300"
                                disabled={busyRow}
                                onClick={() => void handleBlock(user)}
                              >
                                Bloquear
                              </button>
                              <button
                                type="button"
                                className="rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs text-amber-700 disabled:opacity-50 dark:text-amber-300"
                                disabled={busyRow}
                                onClick={() => void handleSuspend(user)}
                              >
                                Suspender
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="rounded-lg border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-700 disabled:opacity-50 dark:text-emerald-300"
                              disabled={busyRow}
                              onClick={() => void handleActivate(user)}
                            >
                              Reativar
                            </button>
                          )}

                          <button
                            type="button"
                            className="rounded-lg border border-black/15 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-white/15"
                            disabled={busyRow}
                            onClick={() => void handleDelete(user)}
                          >
                            Excluir
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            className="surface-field rounded-lg px-3 py-1.5 text-xs"
                            type="datetime-local"
                            aria-label={`Fim da suspensão de ${user.email}`}
                            value={suspensionValue}
                            onChange={(event) =>
                              setSuspendDrafts((current) => ({
                                ...current,
                                [user.id]: event.target.value,
                              }))
                            }
                          />
                          <span className="text-xs opacity-60">Defina quando a suspensão temporária termina.</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center opacity-60">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
