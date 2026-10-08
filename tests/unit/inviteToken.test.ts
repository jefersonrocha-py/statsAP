import { describe, expect, it } from "vitest";
import { createInviteToken, getInviteState, getInviteTtlHours, hashInviteToken } from "@lib/inviteToken";

describe("createInviteToken", () => {
  it("gera token de 64 hex, guarda só o hash e calcula a validade", () => {
    const now = new Date("2026-10-08T12:00:00Z");
    const invite = createInviteToken(now, 72);

    expect(invite.token).toMatch(/^[0-9a-f]{64}$/);
    expect(invite.tokenHash).toBe(hashInviteToken(invite.token));
    expect(invite.tokenHash).not.toBe(invite.token);
    expect(invite.expiresAt.toISOString()).toBe("2026-10-11T12:00:00.000Z");
  });

  it("gera tokens diferentes a cada chamada", () => {
    expect(createInviteToken().token).not.toBe(createInviteToken().token);
  });
});

describe("getInviteTtlHours", () => {
  it("usa 72 h como padrão e respeita a faixa de 1 a 336 h", () => {
    expect(getInviteTtlHours(undefined)).toBe(72);
    expect(getInviteTtlHours("24")).toBe(24);
    expect(getInviteTtlHours("0")).toBe(72);
    expect(getInviteTtlHours("400")).toBe(72);
    expect(getInviteTtlHours("abc")).toBe(72);
  });
});

describe("getInviteState", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  const future = "2026-10-09T12:00:00Z";
  const past = "2026-10-07T12:00:00Z";

  it("pendente quando não aceito, não revogado e dentro da validade", () => {
    expect(getInviteState({ acceptedAt: null, revokedAt: null, expiresAt: future }, now)).toBe("PENDING");
  });

  it("aceito tem prioridade sobre os outros estados (link reutilizado)", () => {
    expect(getInviteState({ acceptedAt: past, revokedAt: past, expiresAt: past }, now)).toBe("ACCEPTED");
  });

  it("revogado e expirado", () => {
    expect(getInviteState({ acceptedAt: null, revokedAt: past, expiresAt: future }, now)).toBe("REVOKED");
    expect(getInviteState({ acceptedAt: null, revokedAt: null, expiresAt: past }, now)).toBe("EXPIRED");
  });
});
