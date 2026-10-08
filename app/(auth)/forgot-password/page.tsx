"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { faEnvelope, faTowerBroadcast } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import AuthInput from "@components/AuthInput";
import AuthParticles from "@components/AuthParticles";
import { buildApiHeaders } from "@services/api";

type Feedback = {
  kind: "error" | "success";
  message: string;
} | null;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        body: JSON.stringify({ email }),
        headers: buildApiHeaders(undefined, "POST"),
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeedback({
          kind: "error",
          message: payload?.details?.[0]?.message || "Não foi possível processar o pedido agora.",
        });
        return;
      }

      setFeedback({
        kind: "success",
        message: "Se o e-mail informado estiver cadastrado, enviaremos um link de redefinição em instantes.",
      });
    } catch {
      setFeedback({
        kind: "error",
        message: "Não foi possível processar o pedido agora.",
      });
    } finally {
      setBusy(false);
    }
  }

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
              Recuperar acesso
            </div>
            <p className="text-sm">
              Informe o e-mail da conta para receber o link de redefinição de senha.
            </p>
          </div>
        </div>

        <div className="glass rounded-b-3xl px-6 py-8 sm:px-10">
          <form className="space-y-4" onSubmit={onSubmit}>
            <AuthInput
              autoComplete="email"
              icon={faEnvelope}
              placeholder="E-mail"
              type="email"
              value={email}
              onChange={setEmail}
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
              {busy ? "Enviando..." : "Enviar link"}
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
