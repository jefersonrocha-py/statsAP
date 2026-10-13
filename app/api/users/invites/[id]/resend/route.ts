export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { RowDataPacket } from "mysql2/promise";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRequestAuth } from "@lib/auth";
import { createInviteToken, getInviteState } from "@lib/inviteToken";
import { INVITE_SELECT, mapInviteRow, sendInviteEmail, type InviteRow } from "@lib/invites";
import { dbExecute, dbQueryOne } from "@lib/mysql";
import { checkRateLimit, rateLimitResponse } from "@lib/rateLimit";

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

type IdRow = RowDataPacket & { id: number };

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRequestAuth(req, ["SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    const rateLimit = checkRateLimit(req, "admin-invite-user", {
      max: 20,
      windowMs: 60 * 60_000,
      key: auth.user.sub,
    });
    if (!rateLimit.ok) return rateLimitResponse(rateLimit);

    const parsed = paramsSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "INVITE_NOT_FOUND" }, { status: 404 });
    }

    const row = await dbQueryOne<InviteRow>(`${INVITE_SELECT} WHERE i.\`id\` = ? LIMIT 1`, [parsed.data.id]);
    if (!row) return NextResponse.json({ ok: false, error: "INVITE_NOT_FOUND" }, { status: 404 });

    // Convite expirado pode ser reenviado (ganha nova validade); aceito ou revogado, não.
    const state = getInviteState(row);
    if (state === "ACCEPTED" || state === "REVOKED") {
      return NextResponse.json({ ok: false, error: "INVITE_NOT_PENDING" }, { status: 409 });
    }

    const existingUser = await dbQueryOne<IdRow>("SELECT `id` FROM `User` WHERE `email` = ? LIMIT 1", [row.email]);
    if (existingUser) {
      return NextResponse.json({ ok: false, error: "EMAIL_TAKEN" }, { status: 409 });
    }

    const now = new Date();
    const { token, tokenHash, expiresAt } = createInviteToken(now);
    await dbExecute("UPDATE `UserInvite` SET `tokenHash` = ?, `expiresAt` = ? WHERE `id` = ?", [
      tokenHash,
      expiresAt,
      row.id,
    ]);

    const item = mapInviteRow({ ...row, tokenHash, expiresAt } as InviteRow, now);

    try {
      await sendInviteEmail({ email: row.email, role: row.role, token, expiresAt, inviterName: auth.user.name });
    } catch (emailError) {
      console.error("POST /api/users/invites/[id]/resend sendMail error:", emailError);
      return NextResponse.json({ ok: false, error: "INVITE_EMAIL_FAILED", item }, { status: 502 });
    }

    return NextResponse.json({ ok: true, item });
  } catch (e) {
    console.error("POST /api/users/invites/[id]/resend error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
