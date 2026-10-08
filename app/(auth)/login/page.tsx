"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEnvelope, faTowerBroadcast } from "@fortawesome/free-solid-svg-icons";
import AuthInput from "@components/AuthInput";
import AuthParticles from "@components/AuthParticles";
import PasswordInput from "@components/PasswordInput";
import { buildApiHeaders } from "@services/api";

const ETHERIUM_LOGO = {
  src: "/logo_etherium.png",
  alt: "Etheriumtech",
  width: 346,
  height: 369,
} as const;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        headers: buildApiHeaders(undefined, "POST"),
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const apiError = String(payload?.error || "");
        if (apiError === "INVALID_CREDENTIALS") setError("E-mail ou senha incorretos.");
        else if (apiError === "ACCOUNT_BLOCKED") setError("Sua conta está bloqueada. Procure um administrador.");
        else if (apiError === "ACCOUNT_SUSPENDED") {
          setError("Sua conta está suspensa temporariamente. Aguarde a liberação ou fale com um administrador.");
        } else if (apiError === "ORIGIN_MISMATCH" || apiError === "ORIGIN_REQUIRED") {
          setError("Falha de origem da requisição. Recarregue a página e tente novamente.");
        } else if (apiError === "CSRF_INVALID") {
          setError("Sessão de segurança inválida. Recarregue a página e tente novamente.");
        } else {
          setError("Não foi possível entrar agora.");
        }
        return;
      }

      router.push("/");
    } catch {
      setError("Não foi possível entrar agora.");
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
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 -z-10 h-72 w-72 rounded-full bg-gradient-to-br from-emerald-400/35 via-emerald-600/25 to-transparent blur-3xl"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2 }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -right-16 -z-10 h-80 w-80 rounded-full bg-gradient-to-tr from-emerald-300/25 via-emerald-500/20 to-transparent blur-3xl"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.4, delay: 0.1 }}
      />

      <motion.div
        className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl shadow-[0_10px_45px_-18px_rgba(16,185,129,0.5)] ring-1 ring-white/10"
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 160, damping: 18 }}
      >
        <div className="relative bg-gradient-to-b from-emerald-300/90 via-emerald-400/80 to-emerald-500/60 px-6 py-7 backdrop-blur sm:px-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="rounded-[28px] border border-black/10 bg-[#F9F9F9] px-4 py-3 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.45)]">
              <Image
                src={ETHERIUM_LOGO.src}
                alt={ETHERIUM_LOGO.alt}
                width={ETHERIUM_LOGO.width}
                height={ETHERIUM_LOGO.height}
                className="h-16 w-auto sm:h-20"
                priority
              />
            </div>
            <div className="surface-soft inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-muted">
              <FontAwesomeIcon icon={faTowerBroadcast} className="h-4 w-4" />
              Stats A.P
            </div>
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

            <PasswordInput
              autoComplete="current-password"
              placeholder="Senha"
              value={password}
              onChange={setPassword}
            />

            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="btn-shine h-11 w-full rounded-xl bg-slate-950 text-white shadow-soft transition hover:bg-slate-800 active:scale-[.995] disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
            >
              {busy ? "Entrando..." : "LOGIN"}
            </button>

            <div className="text-muted flex items-center justify-between gap-3 text-xs">
              <Link href="/forgot-password" className="underline underline-offset-4 hover:opacity-100">
                Esqueceu a senha?
              </Link>
              <span>Solicite o acesso a um administrador.</span>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
