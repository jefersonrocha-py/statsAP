import { describe, expect, it } from "vitest";
import { isTokenRevokedByPasswordChange, sessionCutoff } from "@lib/sessionRules";

const changedAt = new Date("2026-10-12T15:00:00.000Z");
const seconds = (date: Date) => Math.floor(date.getTime() / 1000);

describe("isTokenRevokedByPasswordChange", () => {
  it("não revoga quando a senha nunca foi trocada", () => {
    expect(isTokenRevokedByPasswordChange(seconds(changedAt), null)).toBe(false);
    expect(isTokenRevokedByPasswordChange(undefined, undefined)).toBe(false);
  });

  it("revoga token emitido antes da troca", () => {
    expect(isTokenRevokedByPasswordChange(seconds(changedAt) - 1, changedAt)).toBe(true);
  });

  it("mantém o token emitido na troca ou depois dela", () => {
    expect(isTokenRevokedByPasswordChange(seconds(changedAt), changedAt)).toBe(false);
    expect(isTokenRevokedByPasswordChange(seconds(changedAt) + 30, changedAt)).toBe(false);
  });

  it("revoga token sem data de emissão quando houve troca", () => {
    expect(isTokenRevokedByPasswordChange(undefined, changedAt)).toBe(true);
  });
});

describe("sessionCutoff", () => {
  it("trunca para o segundo: o DATETIME do MySQL arredondaria e derrubaria a sessão recém-renovada", () => {
    expect(sessionCutoff(Date.parse("2026-10-12T15:00:00.900Z")).toISOString()).toBe("2026-10-12T15:00:00.000Z");
  });
});
