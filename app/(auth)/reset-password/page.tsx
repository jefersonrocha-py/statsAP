"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { faKey, faTowerBroadcast } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import AuthParticles from "@components/AuthParticles";
import PasswordInput from "@components/PasswordInput";
import { PASSWORD_POLICY_HINT } from "@lib/validatorsAuth";
import { buildApiHeaders } from "@services/api";

type Feedback = {
  kind: "error" | "success";
  message: string;
} | null;

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() || "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    if (!token) {
      setFeedback({ kind: "error", message: "Link de redefinição ausente ou inválido." });
      return;
    }

    if (password !== confirmPassword) {
      setFeedback({ kind: "error", message: "As senhas informadas não coincidem." });
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/auth/reset-password", {
        body: JSON.stringify({ password, token }),
        headers: buildApiHeaders(undefined, "POST"),
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeedback({
          kind: "error",
          message:
            payload?.details?.[0]?.message ||
            (payload?.error === "INVALID_RESET_TOKEN"
              ? "O link de redefinição é inválido ou expirou."
              : "Não foi possível redefinir a senha."),
        });
        return;
      }

      setFeedback({ kind: "success", message: "Senha redefinida com sucesso. Você já pode entrar." });
      setPassword("");
      setConfirmPassword("");
      window.setTimeout(() => router.push("/login"), 1200);
    } catch {
      setFeedback({ kind: "error", message: "Não foi possível redefinir a senha." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative isolate flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-8">
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
              Nova senha
            </div>
            <p className="text-sm">
              Defina uma nova senha para concluir a recuperação de acesso.
            </p>
          </div>
        </div>

        <div className="glass rounded-b-3xl px-6 py-8 sm:px-10">
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="surface-soft rounded-xl px-3 py-2 text-xs text-muted">
              <div className="mb-1 flex items-center gap-2 font-medium">
                <FontAwesomeIcon icon={faKey} className="h-3.5 w-3.5" />
                Política de senha
              </div>
              <div>{PASSWORD_POLICY_HINT}</div>
            </div>

            <PasswordInput
              autoComplete="new-password"
              placeholder="Nova senha"
              value={password}
              onChange={setPassword}
            />
            <PasswordInput
              autoComplete="new-password"
              placeholder="Confirmar nova senha"
              value={confirmPassword}
              onChange={setConfirmPassword}
            />

            {feedback && (
              <div
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
              {busy ? "Salvando..." : "Redefinir senha"}
            </button>

            <div className="text-muted text-center text-xs">
              <Link href="/login" className="underline underline-offset-4">
                Voltar para o login
              </Link>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
