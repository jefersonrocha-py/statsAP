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
