import { describe, expect, it, vi } from "vitest";

vi.mock("@lib/email", () => ({ sendMail: vi.fn(async () => undefined) }));

import { sendMail } from "@lib/email";
import { mapInviteRow, sendInviteEmail } from "@lib/invites";

describe("mapInviteRow", () => {
  it("converte a linha do banco no item da API com o estado calculado", () => {
    const item = mapInviteRow(
      {
        id: 4,
        email: "novo@exemplo.com",
        role: "USER",
        tokenHash: "x".repeat(64),
        invitedById: 1,
        invitedByName: "Root",
        expiresAt: new Date("2026-10-11T12:00:00Z"),
        acceptedAt: null,
        revokedAt: null,
        createdAt: new Date("2026-10-08T12:00:00Z"),
      } as never,
      new Date("2026-10-08T13:00:00Z")
    );

    expect(item).toEqual({
      id: 4,
      email: "novo@exemplo.com",
      role: "USER",
      invitedByName: "Root",
      expiresAt: "2026-10-11T12:00:00.000Z",
      createdAt: "2026-10-08T12:00:00.000Z",
      state: "PENDING",
    });
    expect(item).not.toHaveProperty("tokenHash");
  });
});

describe("sendInviteEmail", () => {
  it("envia o link público /accept-invite com o token", async () => {
    process.env.APP_URL = "https://stats.exemplo.com";

    await sendInviteEmail({
      email: "novo@exemplo.com",
      role: "ADMIN",
      token: "abc123",
      expiresAt: new Date("2026-10-11T12:00:00Z"),
      inviterName: "Root",
    });

    const payload = vi.mocked(sendMail).mock.calls[0][0];
    expect(payload.to).toBe("novo@exemplo.com");
    expect(payload.text).toContain("https://stats.exemplo.com/accept-invite?token=abc123");
  });
});
