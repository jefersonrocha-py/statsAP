import { describe, expect, it } from "vitest";
import { decideSuperadminBootstrap } from "../../scripts/bootstrap-rules.mjs";

const creds = { email: "root@exemplo.com", password: "Senha#Forte2026", name: "Root" };

describe("decideSuperadminBootstrap", () => {
  it("banco novo, sem nenhum SUPERADMIN: cria o usuário padrão do .env", () => {
    expect(decideSuperadminBootstrap({ superadminCount: 0, emailTaken: false, ...creds })).toBe("create");
  });

  it("já existe SUPERADMIN: não mexe em nada (nem senha, nem e-mail trocado em Minha Conta)", () => {
    expect(decideSuperadminBootstrap({ superadminCount: 1, emailTaken: false, ...creds })).toBe("skip");
    expect(decideSuperadminBootstrap({ superadminCount: 2, emailTaken: true, ...creds })).toBe("skip");
  });

  it("sem SUPERADMIN e sem credenciais no .env: avisa em vez de criar", () => {
    expect(decideSuperadminBootstrap({ superadminCount: 0, emailTaken: false, email: "", password: "x", name: "Root" })).toBe(
      "missing-credentials"
    );
    expect(decideSuperadminBootstrap({ superadminCount: 0, emailTaken: false, email: "a@b.com", password: "", name: "Root" })).toBe(
      "missing-credentials"
    );
  });

  it("sem SUPERADMIN, mas o e-mail já é de outra conta: não promove ninguém sozinho", () => {
    expect(decideSuperadminBootstrap({ superadminCount: 0, emailTaken: true, ...creds })).toBe("email-taken");
  });
});
