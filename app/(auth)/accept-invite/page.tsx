"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { faKey, faTowerBroadcast, faUser } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import AuthInput from "@components/AuthInput";
import AuthParticles from "@components/AuthParticles";
import PasswordInput from "@components/PasswordInput";
import { formatDateTimeBR } from "@lib/dateFormat";
import { roleLabel } from "@lib/roles";
import { PASSWORD_POLICY_HINT } from "@lib/validatorsAuth";
import { buildApiHeaders } from "@services/api";

type InviteInfo = { email: string; role: string; expiresAt: string | null };
type Feedback = { kind: "error" | "success"; message: string } | null;

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() || "", [searchParams]);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    let alive = true;
    if (!token) {
      setInvalid(true);
      return;
    }

    (async () => {
      try {
        const response = await fetch(`/api/auth/invite?token=${encodeURIComponent(token)}`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!alive) return;
        if (response.ok && payload?.ok) {
          setInvite({ email: payload.email, role: payload.role, expiresAt: payload.expiresAt ?? null });
        } else {
          setInvalid(true);
        }
      } catch {
        if (alive) setInvalid(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, [token]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !invite) return;

    if (password !== confirmPassword) {
      setFeedback({ kind: "error", message: "As senhas informadas não coincidem." });
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/auth/accept-invite", {
        body: JSON.stringify({ token, name, password }),
        headers: buildApiHeaders(undefined, "POST"),
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const detail = payload?.details?.[0]?.message;
        setFeedback({
          kind: "error",
          message:
            (typeof detail === "string" && detail) ||
            (payload?.error === "INVALID_INVITE"
              ? "Este convite é inválido, já foi usado ou expirou. Peça um novo convite ao administrador."
              : payload?.error === "EMAIL_TAKEN"
                ? "Já existe uma conta com este e-mail. Use “Esqueceu a senha?” na tela de login."
                : "Não foi possível criar o acesso agora."),
        });
        if (payload?.error === "INVALID_INVITE") setInvalid(true);
        return;
      }

      setFeedback({ kind: "success", message: "Acesso criado. Entrando..." });
      router.replace("/");
    } catch {
      setFeedback({ kind: "error", message: "Não foi possível criar o acesso agora." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass rounded-b-3xl px-6 py-8 sm:px-10">
      {invalid ? (
        <div className="space-y-4 text-center text-sm">
          <p>Este convite é inválido, já foi usado ou expirou.</p>
          <p className="text-muted">Peça um novo convite ao administrador do Stats A.P.</p>
          <Link href="/login" className="inline-block underline underline-offset-4">
            Ir para o login
          </Link>
        </div>
      ) : !invite ? (
        <p className="text-center text-sm text-muted">Validando convite...</p>
      ) : (
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="surface-soft rounded-xl px-3 py-2 text-xs text-muted">
            <div>
              E-mail: <strong>{invite.email}</strong>
            </div>
            <div>Perfil de acesso: {roleLabel(invite.role)}</div>
            {invite.expiresAt ? <div>Convite válido até {formatDateTimeBR(invite.expiresAt)}</div> : null}
          </div>

          <AuthInput icon={faUser} placeholder="Seu nome" value={name} onChange={setName} autoComplete="name" />

          <div className="surface-soft rounded-xl px-3 py-2 text-xs text-muted">
            <div className="mb-1 flex items-center gap-2 font-medium">
              <FontAwesomeIcon icon={faKey} className="h-3.5 w-3.5" />
              Política de senha
            </div>
            <div>{PASSWORD_POLICY_HINT}</div>
          </div>

          <PasswordInput autoComplete="new-password" placeholder="Senha" value={password} onChange={setPassword} />
          <PasswordInput
            autoComplete="new-password"
            placeholder="Confirmar senha"
            value={confirmPassword}
            onChange={setConfirmPassword}
          />

          {feedback && (
            <div
              role="status"
              className={`rounded-xl border p-3 text-xs ${
                feedback.kind === "error"
                  ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {feedback.message}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn-shine h-11 w-full rounded-xl bg-slate-950 text-white shadow-soft transition hover:bg-slate-800 active:scale-[.995] disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
          >
            {busy ? "Criando acesso..." : "Criar meu acesso"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="relative isolate flex min-h-[100dvh] items-center justify-center px-4 py-8">
      <div className="absolute inset-0 -z-10">
        <AuthParticles />
      </div>

      <motion.div
        className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl shadow-[0_10px_45px_-18px_rgba(16,185,129,0.5)] ring-1 ring-white/10"
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 160, damping: 18 }}
      >
        <div className="relative bg-gradient-to-b from-emerald-300/90 via-emerald-400/80 to-emerald-500/60 px-6 py-7 backdrop-blur sm:px-10">
          <div className="flex flex-col items-center gap-4 text-center text-muted">
            <div className="surface-soft inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium">
              <FontAwesomeIcon icon={faTowerBroadcast} className="h-4 w-4" />
              Convite de acesso
            </div>
            <p className="text-sm">Crie sua senha para começar a usar o Stats A.P.</p>
          </div>
        </div>

        <Suspense fallback={<div className="glass rounded-b-3xl px-6 py-8 text-center text-sm">Carregando...</div>}>
          <AcceptInviteForm />
        </Suspense>
      </motion.div>
    </div>
  );
}
