"use client";

import { useEffect, useRef, useState } from "react";
import UserAvatar from "@components/UserAvatar";
import { accountErrorMessage } from "@lib/accountMessages";
import { PROFILE_JOB_TITLE_MAX, PROFILE_NAME_MAX, PROFILE_PHONE_MAX } from "@lib/accountValidators";
import { AVATAR_ACCEPT, AVATAR_SOURCE_MAX_BYTES, prepareAvatarBlob } from "@lib/avatarImage";
import { roleLabel } from "@lib/roles";
import { PASSWORD_POLICY_ITEMS } from "@lib/validatorsAuth";
import { api, ApiError, type MeResponse } from "@services/api";
import { useProfileStore, type UserProfile } from "@store/profile";

type Feedback = { kind: "success" | "error"; message: string } | null;
type ProfileResponse = { ok: boolean; user: UserProfile };
type AvatarResponse = { ok: boolean; avatarUrl: string | null };

const FIELD = "surface-field w-full rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/40";
const LABEL = "text-xs uppercase tracking-[0.18em] opacity-65";
const PRIMARY_BUTTON =
  "rounded-xl bg-brand1 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60";
const SECONDARY_BUTTON = "surface-button rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-60";

function errorMessage(error: unknown) {
  return error instanceof ApiError ? accountErrorMessage(error.code, error.payload) : accountErrorMessage(null);
}

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  const tone =
    feedback.kind === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";

  return (
    <p role={feedback.kind === "error" ? "alert" : "status"} className={`rounded-xl border px-3 py-2 text-sm ${tone}`}>
      {feedback.message}
    </p>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="glass space-y-4 rounded-3xl p-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm opacity-75">{description}</p>
      </div>
      {children}
    </section>
  );
}

function AvatarSection({ profile }: { profile: UserProfile }) {
  const patchProfile = useProfileStore((state) => state.patchProfile);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function onFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;

    if (file.size > AVATAR_SOURCE_MAX_BYTES) {
      setFeedback({ kind: "error", message: "A imagem é grande demais. Escolha um arquivo de até 15 MB." });
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      let blob: Blob;
      try {
        blob = await prepareAvatarBlob(file);
      } catch {
        setFeedback({ kind: "error", message: "Não foi possível ler esta imagem. Envie um PNG, JPEG ou WebP." });
        return;
      }

      const response = await api<AvatarResponse>("/api/account/avatar", {
        method: "POST",
        body: blob,
        headers: { "Content-Type": blob.type || "application/octet-stream" },
      });
      patchProfile({ avatarUrl: response.avatarUrl });
      setFeedback({ kind: "success", message: "Foto atualizada." });
    } catch (error) {
      setFeedback({ kind: "error", message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function removeAvatar() {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      await api<AvatarResponse>("/api/account/avatar", { method: "DELETE" });
      patchProfile({ avatarUrl: null });
      setFeedback({ kind: "success", message: "Foto removida." });
    } catch (error) {
      setFeedback({ kind: "error", message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="Foto de perfil"
      description="Opcional. A imagem é recortada em quadrado e reduzida antes do envio; sem foto, aparecem as suas iniciais."
    >
      <div className="flex flex-wrap items-center gap-4">
        <UserAvatar name={profile.name} avatarUrl={profile.avatarUrl} size={96} />
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={AVATAR_ACCEPT}
            className="hidden"
            onChange={onFileChosen}
            aria-label="Escolher foto de perfil"
          />
          <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? "Enviando..." : profile.avatarUrl ? "Trocar foto" : "Enviar foto"}
          </button>
          {profile.avatarUrl ? (
            <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={removeAvatar}>
              Remover foto
            </button>
          ) : null}
        </div>
      </div>
      <p className="text-xs opacity-65">Formatos aceitos: PNG, JPEG ou WebP.</p>
      <FeedbackLine feedback={feedback} />
    </Section>
  );
}

function ProfileSection({ profile }: { profile: UserProfile }) {
  const setProfile = useProfileStore((state) => state.setProfile);
  const [name, setName] = useState(profile.name);
  const [jobTitle, setJobTitle] = useState(profile.jobTitle ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const response = await api<ProfileResponse>("/api/account", {
        method: "PATCH",
        body: JSON.stringify({ name, jobTitle, phone }),
      });
      setProfile(response.user);
      setName(response.user.name);
      setJobTitle(response.user.jobTitle ?? "");
      setPhone(response.user.phone ?? "");
      setFeedback({ kind: "success", message: "Dados salvos." });
    } catch (error) {
      setFeedback({ kind: "error", message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Dados pessoais" description="O nome aparece na sidebar e nas ações que você registra nas ocorrências.">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="space-y-1 md:col-span-2">
            <span className={LABEL}>Nome</span>
            <input
              className={FIELD}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              maxLength={PROFILE_NAME_MAX}
              required
            />
          </label>
          <label className="space-y-1">
            <span className={LABEL}>Cargo</span>
            <input
              className={FIELD}
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
              autoComplete="organization-title"
              maxLength={PROFILE_JOB_TITLE_MAX}
              placeholder="Ex.: Analista de Redes"
            />
          </label>
          <label className="space-y-1">
            <span className={LABEL}>Telefone</span>
            <input
              className={FIELD}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              type="tel"
              autoComplete="tel"
              maxLength={PROFILE_PHONE_MAX}
              placeholder="Ex.: (11) 98888-7777"
            />
          </label>
        </div>
        <FeedbackLine feedback={feedback} />
        <button type="submit" className={PRIMARY_BUTTON} disabled={busy}>
          {busy ? "Salvando..." : "Salvar dados"}
        </button>
      </form>
    </Section>
  );
}

function EmailSection({ profile }: { profile: UserProfile }) {
  const setProfile = useProfileStore((state) => state.setProfile);
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const response = await api<ProfileResponse>("/api/account/email", {
        method: "POST",
        body: JSON.stringify({ newEmail, currentPassword }),
      });
      setProfile(response.user);
      setNewEmail("");
      setCurrentPassword("");
      setFeedback({
        kind: "success",
        message: "E-mail alterado. Use o novo endereço no próximo login; avisamos o endereço anterior.",
      });
    } catch (error) {
      setFeedback({ kind: "error", message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="E-mail de acesso"
      description="É o e-mail usado no login e nos avisos da plataforma. A troca pede a sua senha atual."
    >
      <div className="surface-soft rounded-xl px-3 py-2 text-sm">
        E-mail atual: <strong className="break-all">{profile.email}</strong>
      </div>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className={LABEL}>Novo e-mail</span>
            <input
              className={FIELD}
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              autoComplete="email"
              maxLength={200}
              required
            />
          </label>
          <label className="space-y-1">
            <span className={LABEL}>Senha atual</span>
            <input
              className={FIELD}
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              maxLength={72}
              required
            />
          </label>
        </div>
        <FeedbackLine feedback={feedback} />
        <button type="submit" className={PRIMARY_BUTTON} disabled={busy}>
          {busy ? "Alterando..." : "Alterar e-mail"}
        </button>
      </form>
    </Section>
  );
}

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    if (newPassword !== confirmPassword) {
      setFeedback({ kind: "error", message: "A nova senha e a confirmação não coincidem." });
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      await api<{ ok: boolean }>("/api/account/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFeedback({ kind: "success", message: "Senha alterada. Os outros dispositivos foram desconectados." });
    } catch (error) {
      setFeedback({ kind: "error", message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  const type = show ? "text" : "password";

  return (
    <Section
      title="Senha"
      description="Ao trocar a senha, as sessões abertas em outros dispositivos são encerradas. Esta continua ativa."
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className={LABEL}>Senha atual</span>
            <input
              className={FIELD}
              type={type}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              maxLength={72}
              required
            />
          </label>
          <label className="space-y-1">
            <span className={LABEL}>Nova senha</span>
            <input
              className={FIELD}
              type={type}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              maxLength={72}
              required
            />
          </label>
          <label className="space-y-1">
            <span className={LABEL}>Confirmar nova senha</span>
            <input
              className={FIELD}
              type={type}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              maxLength={72}
              required
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="rounded border-black/20 dark:border-white/20"
            checked={show}
            onChange={(event) => setShow(event.target.checked)}
          />
          Mostrar senhas
        </label>

        <ul className="surface-soft list-disc space-y-0.5 rounded-xl py-2 pl-7 pr-3 text-xs opacity-80">
          {PASSWORD_POLICY_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <FeedbackLine feedback={feedback} />
        <button type="submit" className={PRIMARY_BUTTON} disabled={busy}>
          {busy ? "Alterando..." : "Alterar senha"}
        </button>
      </form>
    </Section>
  );
}

export default function AccountPage() {
  const profile = useProfileStore((state) => state.profile);
  const setProfile = useProfileStore((state) => state.setProfile);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const response = await api<MeResponse>("/api/me");
        if (alive && response.user) setProfile(response.user);
      } catch {
        if (alive) setLoadError(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [setProfile]);

  if (!profile) {
    return (
      <div className="glass rounded-3xl p-5 text-sm opacity-75">
        {loadError ? "Não foi possível carregar os dados da sua conta." : "Carregando sua conta..."}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <section className="glass flex flex-wrap items-center gap-4 rounded-3xl p-5">
        <UserAvatar name={profile.name} avatarUrl={profile.avatarUrl} size={64} />
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">Minha Conta</h1>
          <p className="break-words text-sm opacity-75">
            {profile.name} · {roleLabel(profile.role)}
            {profile.jobTitle ? ` · ${profile.jobTitle}` : ""}
          </p>
        </div>
      </section>

      <AvatarSection profile={profile} />
      {/* A chave recria o formulário quando o usuário carregado muda. */}
      <ProfileSection key={profile.id} profile={profile} />
      <EmailSection profile={profile} />
      <PasswordSection />
    </div>
  );
}
