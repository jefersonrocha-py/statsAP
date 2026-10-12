export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import bcrypt from "bcryptjs";
import type { RowDataPacket } from "mysql2/promise";
import { NextResponse } from "next/server";
import { requireTrustedOrigin } from "@lib/auth";
import { dbExecute, dbQueryOne, withTransaction } from "@lib/mysql";
import { hashPasswordResetToken } from "@lib/passwordReset";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@lib/rateLimit";
import { sessionCutoff } from "@lib/sessionRules";
import { strongPasswordSchema } from "@lib/validatorsAuth";
import { z } from "zod";

const resetPasswordSchema = z.object({
  password: strongPasswordSchema,
  token: z.string().trim().min(32).max(256),
});

type PasswordResetTokenRow = RowDataPacket & {
  id: number;
  userId: number;
  expiresAt: Date | string;
  usedAt: Date | string | null;
};

function isValidResetToken(row: PasswordResetTokenRow | null) {
  if (!row) return false;
  if (row.usedAt) return false;
  const expiresAt = row.expiresAt instanceof Date ? row.expiresAt : new Date(String(row.expiresAt));
  if (Number.isNaN(expiresAt.getTime())) return false;
  return expiresAt.getTime() > Date.now();
}

export async function POST(req: Request) {
  try {
    const originError = requireTrustedOrigin(req);
    if (originError) return originError;

    const ipRateLimit = checkRateLimit(req, "auth-reset-password-ip", {
      max: 20,
      windowMs: 60 * 60_000,
    });
    if (!ipRateLimit.ok) {
      return rateLimitResponse(ipRateLimit);
    }

    const body = await req.json().catch(() => ({}));
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_FAILED", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const tokenHash = hashPasswordResetToken(parsed.data.token);
    const rateLimit = checkRateLimit(req, "auth-reset-password", {
      max: 10,
      windowMs: 60 * 60_000,
      key: `${getClientIp(req)}:${tokenHash}`,
    });
    if (!rateLimit.ok) {
      return rateLimitResponse(rateLimit);
    }

    const resetToken = await dbQueryOne<PasswordResetTokenRow>(
      "SELECT `id`, `userId`, `expiresAt`, `usedAt` FROM `PasswordResetToken` WHERE `tokenHash` = ? LIMIT 1",
      [tokenHash]
    );

    if (!isValidResetToken(resetToken)) {
      return NextResponse.json({ ok: false, error: "INVALID_RESET_TOKEN" }, { status: 400 });
    }
    if (!resetToken) {
      return NextResponse.json({ ok: false, error: "INVALID_RESET_TOKEN" }, { status: 400 });
    }

    const activeResetToken = resetToken;
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const now = new Date();

    await withTransaction(async (connection) => {
      await dbExecute(
        // Quem redefine a senha encerra as sessões abertas antes (ver lib/sessionRules.ts).
        "UPDATE `User` SET `passwordHash` = ?, `passwordChangedAt` = ? WHERE `id` = ?",
        [passwordHash, sessionCutoff(now.getTime()), activeResetToken.userId],
        connection
      );
      await dbExecute(
        "UPDATE `PasswordResetToken` SET `usedAt` = ? WHERE `id` = ?",
        [now, activeResetToken.id],
        connection
      );
      await dbExecute(
        "UPDATE `PasswordResetToken` SET `usedAt` = ? WHERE `userId` = ? AND `usedAt` IS NULL AND `id` <> ?",
        [now, activeResetToken.userId, activeResetToken.id],
        connection
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/auth/reset-password error:", error);
    return NextResponse.json({ ok: false, error: "UNEXPECTED_ERROR" }, { status: 500 });
  }
}
