export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import bcrypt from "bcryptjs";
import type { RowDataPacket } from "mysql2/promise";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTrustedOrigin, setAuthCookies, signAuthToken } from "@lib/auth";
import { getInviteState, hashInviteToken } from "@lib/inviteToken";
import type { InviteRow } from "@lib/invites";
import { dbExecute, dbQueryOne, withTransaction } from "@lib/mysql";
import { checkRateLimit, rateLimitResponse } from "@lib/rateLimit";
import { normalizeRole } from "@lib/roles";
import { strongPasswordSchema } from "@lib/validatorsAuth";

const acceptInviteSchema = z.object({
  token: z.string().trim().min(32).max(256),
  name: z
    .string()
    .trim()
    .min(2, "Informe seu nome (mínimo de 2 caracteres).")
    .max(100, "O nome pode ter no máximo 100 caracteres."),
  password: strongPasswordSchema,
});

type IdRow = RowDataPacket & { id: number };

export async function POST(req: Request) {
  try {
    const originError = requireTrustedOrigin(req);
    if (originError) return originError;

    const rateLimit = checkRateLimit(req, "auth-accept-invite-ip", { max: 20, windowMs: 60 * 60_000 });
    if (!rateLimit.ok) return rateLimitResponse(rateLimit);

    const parsed = acceptInviteSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_FAILED", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { token, name, password } = parsed.data;
    const tokenHash = hashInviteToken(token);
    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();

    // FOR UPDATE: dois aceites simultâneos do mesmo link não criam dois usuários.
    const outcome = await withTransaction(async (connection) => {
      const invite = await dbQueryOne<InviteRow>(
        "SELECT `id`, `email`, `role`, `expiresAt`, `acceptedAt`, `revokedAt` FROM `UserInvite` WHERE `tokenHash` = ? LIMIT 1 FOR UPDATE",
        [tokenHash],
        connection
      );
      if (!invite || getInviteState(invite, now) !== "PENDING") return { error: "INVALID_INVITE" as const };

      const taken = await dbQueryOne<IdRow>(
        "SELECT `id` FROM `User` WHERE `email` = ? LIMIT 1",
        [invite.email],
        connection
      );
      if (taken) return { error: "EMAIL_TAKEN" as const };

      const role = normalizeRole(invite.role);
      const result = await dbExecute(
        "INSERT INTO `User` (`name`, `email`, `passwordHash`, `role`, `isBlocked`, `suspendedUntil`, `createdAt`) VALUES (?, ?, ?, ?, 0, NULL, ?)",
        [name, invite.email, passwordHash, role, now],
        connection
      );
      await dbExecute("UPDATE `UserInvite` SET `acceptedAt` = ? WHERE `id` = ?", [now, invite.id], connection);

      return { user: { id: result.insertId, name, email: invite.email, role } };
    });

    if ("error" in outcome) {
      const status = outcome.error === "EMAIL_TAKEN" ? 409 : 400;
      return NextResponse.json({ ok: false, error: outcome.error }, { status });
    }

    const authToken = await signAuthToken({
      sub: String(outcome.user.id),
      email: outcome.user.email,
      name: outcome.user.name,
      role: outcome.user.role,
    });
    setAuthCookies(cookies(), authToken);

    return NextResponse.json({ ok: true, user: outcome.user });
  } catch (e) {
    console.error("POST /api/auth/accept-invite error:", e);
    return NextResponse.json({ ok: false, error: "UNEXPECTED_ERROR" }, { status: 500 });
  }
}
