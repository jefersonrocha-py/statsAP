export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { toIso } from "@lib/dbMappers";
import { getInviteState, hashInviteToken } from "@lib/inviteToken";
import type { InviteRow } from "@lib/invites";
import { dbQueryOne } from "@lib/mysql";
import { checkRateLimit, rateLimitResponse } from "@lib/rateLimit";

function invalidInvite() {
  return NextResponse.json({ ok: false, error: "INVALID_INVITE" }, { status: 400 });
}

export async function GET(req: Request) {
  try {
    const rateLimit = checkRateLimit(req, "auth-invite-check", { max: 30, windowMs: 10 * 60_000 });
    if (!rateLimit.ok) return rateLimitResponse(rateLimit);

    const token = new URL(req.url).searchParams.get("token")?.trim() ?? "";
    if (token.length < 32 || token.length > 256) return invalidInvite();

    const row = await dbQueryOne<InviteRow>(
      "SELECT `id`, `email`, `role`, `expiresAt`, `acceptedAt`, `revokedAt` FROM `UserInvite` WHERE `tokenHash` = ? LIMIT 1",
      [hashInviteToken(token)]
    );
    if (!row || getInviteState(row) !== "PENDING") return invalidInvite();

    return NextResponse.json({ ok: true, email: row.email, role: row.role, expiresAt: toIso(row.expiresAt) });
  } catch (e) {
    console.error("GET /api/auth/invite error:", e);
    return NextResponse.json({ ok: false, error: "UNEXPECTED_ERROR" }, { status: 500 });
  }
}
