import { describe, expect, it } from "vitest";
import { buildPasswordResetEmail, escapeHtml, renderEmail } from "@lib/emailTemplates";

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
