export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { isReservedSuperadminEmail } from "@lib/account";
import { requireTrustedOrigin } from "@lib/auth";
import { mapDbError } from "@lib/dbErrors";
import { dbExecute } from "@lib/mysql";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@lib/rateLimit";
import { registerSchema } from "@lib/validatorsAuth";

const ALLOW = process.env.ALLOW_SELF_REGISTER === "true";

export async function POST(req: Request) {
  if (!ALLOW) {
    return NextResponse.json({ ok: false, error: "REGISTER_DISABLED" }, { status: 405 });
  }

  try {
    const originError = requireTrustedOrigin(req);
    if (originError) return originError;

    const ipRateLimit = checkRateLimit(req, "auth-register-ip", {
      max: 10,
      windowMs: 60 * 60_000,
    });
    if (!ipRateLimit.ok) {
      return rateLimitResponse(ipRateLimit);
    }

    const body = await req.json().catch(() => ({}));
    const { name, email, password } = registerSchema.parse(body);
    const normalizedEmail = email.toLowerCase();
    const rateLimit = checkRateLimit(req, "auth-register", {
      max: 4,
      windowMs: 60 * 60_000,
      key: `${getClientIp(req)}:${normalizedEmail}`,
    });
    if (!rateLimit.ok) {
      return rateLimitResponse(rateLimit);
    }

    if (isReservedSuperadminEmail(normalizedEmail)) {
      return NextResponse.json({ ok: false, error: "UNIQUE_CONSTRAINT", field: "email" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await dbExecute(
      "INSERT INTO `User` (`name`, `email`, `passwordHash`, `role`, `isBlocked`, `createdAt`) VALUES (?, ?, ?, 'USER', 0, ?)",
      [name, normalizedEmail, passwordHash, new Date()]
    );

    return NextResponse.json(
      { ok: true, user: { id: result.insertId, name, email: normalizedEmail } },
      { status: 201 }
    );
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_FAILED", details: e.errors },
        { status: 400 }
      );
    }

    const mapped = mapDbError(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
