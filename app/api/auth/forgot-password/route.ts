export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { RowDataPacket } from "mysql2/promise";
import { NextResponse } from "next/server";
import { requireTrustedOrigin } from "@lib/auth";
import { sendMail } from "@lib/email";
import { buildPasswordResetEmail } from "@lib/emailTemplates";
import { dbExecute, dbQueryOne } from "@lib/mysql";
import { buildPasswordResetUrl, createPasswordResetToken, getPasswordResetTokenTtlMinutes } from "@lib/passwordReset";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@lib/rateLimit";
import { z } from "zod";

const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(200).toLowerCase(),
});

type UserRow = RowDataPacket & {
  id: number;
  email: string;
  name: string;
};

export async function POST(req: Request) {
  try {
    const originError = requireTrustedOrigin(req);
    if (originError) return originError;

    const ipRateLimit = checkRateLimit(req, "auth-forgot-password-ip", {
      max: 20,
      windowMs: 60 * 60_000,
    });
    if (!ipRateLimit.ok) {
      return rateLimitResponse(ipRateLimit);
    }

    const body = await req.json().catch(() => ({}));
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_FAILED", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const normalizedEmail = parsed.data.email;
    const rateLimit = checkRateLimit(req, "auth-forgot-password", {
      max: 5,
      windowMs: 60 * 60_000,
      key: `${getClientIp(req)}:${normalizedEmail}`,
    });
    if (!rateLimit.ok) {
      return rateLimitResponse(rateLimit);
    }

    const user = await dbQueryOne<UserRow>(
      "SELECT `id`, `email`, `name` FROM `User` WHERE `email` = ? LIMIT 1",
      [normalizedEmail]
    );

    if (user) {
      const { expiresAt, token, tokenHash } = createPasswordResetToken();
      const resetUrl = buildPasswordResetUrl(req, token);
      const now = new Date();

      await dbExecute(
        "UPDATE `PasswordResetToken` SET `usedAt` = ? WHERE `userId` = ? AND `usedAt` IS NULL",
        [now, user.id]
      );

      await dbExecute(
        "INSERT INTO `PasswordResetToken` (`userId`, `tokenHash`, `expiresAt`) VALUES (?, ?, ?)",
        [user.id, tokenHash, expiresAt]
      );

      try {
        await sendMail({
          to: user.email,
          ...buildPasswordResetEmail({
            name: user.name,
            resetUrl,
            ttlMinutes: getPasswordResetTokenTtlMinutes(),
          }),
        });
      } catch (emailError) {
        console.error("POST /api/auth/forgot-password sendMail error:", emailError);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/auth/forgot-password error:", error);
    return NextResponse.json({ ok: false, error: "UNEXPECTED_ERROR" }, { status: 500 });
  }
}
