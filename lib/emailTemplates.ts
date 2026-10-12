import { formatDateTimeBR } from "@lib/dateFormat";
import { formatDuration, secondsBetween } from "@lib/incidentFormat";
import { roleLabel } from "@lib/roles";

// Layout único dos e-mails. Todo texto recebido é tratado como texto puro e escapado no HTML.

const BRAND = "Stats A.P · Etheriumtech";

export type EmailContent = { subject: string; html: string; text: string };

export type EmailLayout = {
  subject: string;
  heading: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  table?: { columns: string[]; rows: string[][] };
  footnote?: string;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderEmail(layout: EmailLayout): EmailContent {
  const html: string[] = [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#0f172a;max-width:640px">',
    `<h2 style="margin:0 0 12px;font-size:18px">${escapeHtml(layout.heading)}</h2>`,
    ...layout.paragraphs.map((paragraph) => `<p style="margin:0 0 12px">${escapeHtml(paragraph)}</p>`),
  ];
  const text: string[] = [layout.heading, "", ...layout.paragraphs];

  if (layout.table && layout.table.rows.length) {
    const header = layout.table.columns
      .map((column) => `<th align="left" style="border-bottom:1px solid #cbd5e1">${escapeHtml(column)}</th>`)
      .join("");
    const rows = layout.table.rows
      .map(
        (row) =>
          `<tr>${row.map((cell) => `<td style="border-bottom:1px solid #e2e8f0">${escapeHtml(cell)}</td>`).join("")}</tr>`
      )
      .join("");
    html.push(
      `<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;margin:0 0 12px;width:100%"><tr>${header}</tr>${rows}</table>`
    );
    text.push("", ...layout.table.rows.map((row) => `- ${row.join(" | ")}`));
  }

  if (layout.action) {
    const url = escapeHtml(layout.action.url);
    html.push(
      `<p style="margin:16px 0"><a href="${url}" style="background:#047857;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">${escapeHtml(layout.action.label)}</a></p>`,
      `<p style="margin:0 0 12px;font-size:12px;color:#475569">Se o botão não funcionar, copie e cole este endereço no navegador: ${url}</p>`
    );
    text.push("", `${layout.action.label}: ${layout.action.url}`);
  }

  if (layout.footnote) {
    html.push(`<p style="margin:12px 0 0;font-size:12px;color:#475569">${escapeHtml(layout.footnote)}</p>`);
    text.push("", layout.footnote);
  }

  html.push(`<p style="margin:16px 0 0;font-size:12px;color:#94a3b8">${escapeHtml(BRAND)}</p>`, "</div>");
  text.push("", BRAND);

  return { subject: layout.subject, html: html.join(""), text: text.join("\n") };
}

export function buildPasswordResetEmail(input: { name: string; resetUrl: string; ttlMinutes: number }): EmailContent {
  return renderEmail({
    subject: "Redefinição de senha",
    heading: `Olá, ${input.name || "usuário"}`,
    paragraphs: ["Recebemos uma solicitação para redefinir a sua senha no Stats A.P."],
    action: { label: "Criar uma nova senha", url: input.resetUrl },
    footnote: `Este link expira em ${input.ttlMinutes} minutos. Se você não solicitou a alteração, ignore este e-mail.`,
  });
}

export function buildInviteEmail(input: {
  acceptUrl: string;
  role: string;
  expiresAt: Date;
  inviterName: string;
}): EmailContent {
  return renderEmail({
    subject: "Convite para acessar o Stats A.P",
    heading: "Você foi convidado",
    paragraphs: [
      `${input.inviterName || "Um administrador"} convidou você para acessar o Stats A.P, a plataforma de monitoramento dos APs da Etheriumtech.`,
      `Perfil de acesso: ${roleLabel(input.role)}.`,
      `O link é pessoal, pode ser usado uma única vez e vale até ${formatDateTimeBR(input.expiresAt)} (horário de Brasília).`,
    ],
    action: { label: "Criar meu acesso", url: input.acceptUrl },
    footnote: "Se você não esperava este convite, ignore este e-mail.",
  });
}

// Enviado ao endereço antigo: se a troca não foi feita pelo dono da conta, é assim que ele fica sabendo.
export function buildEmailChangedNotice(input: { name: string; newEmail: string }): EmailContent {
  return renderEmail({
    subject: "Seu e-mail de acesso ao Stats A.P foi alterado",
    heading: `Olá, ${input.name || "usuário"}`,
    paragraphs: [
      `O e-mail de acesso da sua conta no Stats A.P foi alterado para ${input.newEmail}.`,
      "A partir de agora, o login e os avisos da plataforma usam o novo endereço.",
    ],
    footnote: "Se não foi você, avise um administrador do Stats A.P imediatamente.",
  });
}

export type IncidentDigestItem = {
  antennaName: string;
  networkName: string | null;
  since: Date;
  until?: Date;
};

const DIGEST_MAX_ITEMS = 100;
const DIGEST_FOOTNOTE = "Você recebe este aviso por ser administrador do Stats A.P.";

function digestAction(appUrl: string | null) {
  return appUrl ? { label: "Abrir ocorrências", url: `${appUrl.replace(/\/+$/, "")}/incidents` } : undefined;
}

export function buildIncidentDownDigest(
  items: IncidentDigestItem[],
  opts: { now: Date; appUrl: string | null; minMinutes: number; maxItems?: number }
): EmailContent {
  const max = opts.maxItems ?? DIGEST_MAX_ITEMS;
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  const paragraphs = [`${items.length} AP(s) estão offline há mais de ${opts.minMinutes} minuto(s).`];
  if (rest > 0) paragraphs.push(`A lista abaixo mostra os ${shown.length} primeiros, e mais ${rest} AP(s) offline.`);

  return renderEmail({
    subject: `[Stats A.P] ${items.length} AP(s) offline`,
    heading: "APs offline",
    paragraphs,
    table: {
      columns: ["AP", "Rede", "Offline desde", "Duração"],
      rows: shown.map((item) => [
        item.antennaName,
        item.networkName ?? "-",
        formatDateTimeBR(item.since),
        formatDuration(secondsBetween(item.since, opts.now)),
      ]),
    },
    action: digestAction(opts.appUrl),
    footnote: DIGEST_FOOTNOTE,
  });
}

export function buildIncidentRecoveryDigest(
  items: IncidentDigestItem[],
  opts: { appUrl: string | null; maxItems?: number }
): EmailContent {
  const max = opts.maxItems ?? DIGEST_MAX_ITEMS;
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  const paragraphs = [`${items.length} AP(s) que estavam offline voltaram a ficar online.`];
  if (rest > 0) paragraphs.push(`A lista abaixo mostra os ${shown.length} primeiros, e mais ${rest} AP(s).`);

  return renderEmail({
    subject: `[Stats A.P] ${items.length} AP(s) normalizado(s)`,
    heading: "APs normalizados",
    paragraphs,
    table: {
      columns: ["AP", "Rede", "Ficou offline por"],
      rows: shown.map((item) => [
        item.antennaName,
        item.networkName ?? "-",
        formatDuration(secondsBetween(item.since, item.until ?? item.since)),
      ]),
    },
    action: digestAction(opts.appUrl),
    footnote: DIGEST_FOOTNOTE,
  });
}
