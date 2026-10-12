import { describe, expect, it } from "vitest";
import {
  buildEmailChangedNotice,
  buildIncidentDownDigest,
  buildIncidentRecoveryDigest,
  buildInviteEmail,
  buildPasswordResetEmail,
  escapeHtml,
  renderEmail,
} from "@lib/emailTemplates";

describe("escapeHtml", () => {
  it("escapa os caracteres especiais de HTML", () => {
    expect(escapeHtml(`<b>"Tom" & 'Ana'</b>`)).toBe("&lt;b&gt;&quot;Tom&quot; &amp; &#39;Ana&#39;&lt;/b&gt;");
  });
});

describe("renderEmail", () => {
  it("escapa textos, tabela e link", () => {
    const email = renderEmail({
      subject: "Assunto",
      heading: "<h1>",
      paragraphs: ["a < b"],
      table: { columns: ["AP"], rows: [["<script>"]] },
      action: { label: "Abrir", url: "https://x.test/?a=1&b=2" },
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain('href="https://x.test/?a=1&amp;b=2"');
    expect(email.text).toContain("https://x.test/?a=1&b=2");
    expect(email.text).toContain("- <script>");
  });
});

describe("buildPasswordResetEmail", () => {
  it("monta o e-mail de redefinição em PT-BR sem injetar o nome", () => {
    const email = buildPasswordResetEmail({
      name: "<img src=x>",
      resetUrl: "https://stats.test/reset-password?token=abc",
      ttlMinutes: 60,
    });
    expect(email.subject).toBe("Redefinição de senha");
    expect(email.html).not.toContain("<img");
    expect(email.text).toContain("Este link expira em 60 minutos.");
    expect(email.text).toContain("https://stats.test/reset-password?token=abc");
  });
});

describe("buildInviteEmail", () => {
  it("informa quem convidou, o papel, a validade em horário de Brasília e o link", () => {
    const email = buildInviteEmail({
      acceptUrl: "https://stats.test/accept-invite?token=abc",
      role: "ADMIN",
      expiresAt: new Date("2026-10-11T15:00:00Z"),
      inviterName: "Jeferson",
    });

    expect(email.subject).toBe("Convite para acessar o Stats A.P");
    expect(email.text).toContain("Jeferson convidou você");
    expect(email.text).toContain("Perfil de acesso: Administrador.");
    expect(email.text).toMatch(/vale até 11\/10\/2026,? 12:00/);
    expect(email.text).toContain("https://stats.test/accept-invite?token=abc");
  });
});

describe("resumos de ocorrência", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  const item = (index: number) => ({
    antennaName: `AP ${index}`,
    networkName: "Rede A",
    since: new Date("2026-10-08T11:30:00Z"),
  });

  it("queda em massa vira um único e-mail com no máximo 100 linhas e 'e mais N'", () => {
    const items = Array.from({ length: 130 }, (_, index) => item(index + 1));

    const email = buildIncidentDownDigest(items, { now, appUrl: "https://stats.test", minMinutes: 10 });

    expect(email.subject).toBe("[Stats A.P] 130 AP(s) offline");
    expect(email.text.split("\n").filter((line) => line.startsWith("- AP "))).toHaveLength(100);
    expect(email.text).toContain("e mais 30 AP(s) offline");
    expect(email.text).toContain("AP 1 | Rede A");
    expect(email.text).toContain("30 min");
    expect(email.text).toContain("https://stats.test/incidents");
  });

  it("resumo de normalização mostra quanto tempo cada AP ficou offline", () => {
    const email = buildIncidentRecoveryDigest(
      [{ ...item(1), until: new Date("2026-10-08T13:35:00Z") }],
      { appUrl: null }
    );

    expect(email.subject).toBe("[Stats A.P] 1 AP(s) normalizado(s)");
    expect(email.text).toContain("AP 1 | Rede A | 2 h 05 min");
    expect(email.html).not.toContain("href=");
  });
});

describe("buildEmailChangedNotice", () => {
  it("avisa o endereço antigo, mostra o novo e orienta o que fazer se não foi a pessoa", () => {
    const email = buildEmailChangedNotice({ name: "<b>Ana</b>", newEmail: "nova@exemplo.com" });

    expect(email.subject).toBe("Seu e-mail de acesso ao Stats A.P foi alterado");
    expect(email.text).toContain("nova@exemplo.com");
    expect(email.text).toContain("Se não foi você");
    expect(email.html).toContain("&lt;b&gt;Ana&lt;/b&gt;");
    expect(email.html).not.toContain("href=");
  });
});
