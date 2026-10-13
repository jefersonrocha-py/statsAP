export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { RowDataPacket } from "mysql2/promise";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRequestAuth } from "@lib/auth";
import { createInviteToken } from "@lib/inviteToken";
import { INVITE_SELECT, mapInviteRow, sendInviteEmail, type InviteRow } from "@lib/invites";
import { dbExecute, dbQuery, dbQueryOne, withTransaction } from "@lib/mysql";
import { checkRateLimit, rateLimitResponse } from "@lib/rateLimit";

const createInviteSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Informe um e-mail válido.")
    .max(200, "O e-mail pode ter no máximo 200 caracteres.")
    .transform((value) => value.toLowerCase()),
  role: z.enum(["USER", "ADMIN", "SUPERADMIN"]).default("USER"),
});

type IdRow = RowDataPacket & { id: number };

export async function GET(req: Request) {
  try {
    const auth = await requireRequestAuth(req, ["SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    const now = new Date();
    const rows = await dbQuery<InviteRow>(
      `${INVITE_SELECT} WHERE i.\`acceptedAt\` IS NULL AND i.\`revokedAt\` IS NULL AND i.\`expiresAt\` > ? ORDER BY i.\`createdAt\` DESC`,
      [now]
    );

    return NextResponse.json({ ok: true, items: rows.map((row) => mapInviteRow(row, now)) });
  } catch (e) {
    console.error("GET /api/users/invites error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireRequestAuth(req, ["SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    const rateLimit = checkRateLimit(req, "admin-invite-user", {
      max: 20,
      windowMs: 60 * 60_000,
      key: auth.user.sub,
    });
    if (!rateLimit.ok) return rateLimitResponse(rateLimit);

    const parsed = createInviteSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_FAILED", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { email, role } = parsed.data;
    const existingUser = await dbQueryOne<IdRow>("SELECT `id` FROM `User` WHERE `email` = ? LIMIT 1", [email]);
    if (existingUser) {
      return NextResponse.json({ ok: false, error: "EMAIL_TAKEN" }, { status: 409 });
    }

    const now = new Date();
    const { token, tokenHash, expiresAt } = createInviteToken(now);

    // Um convite pendente por e-mail: o novo substitui o anterior.
    const inviteId = await withTransaction(async (connection) => {
      await dbExecute(
        "UPDATE `UserInvite` SET `revokedAt` = ? WHERE `email` = ? AND `acceptedAt` IS NULL AND `revokedAt` IS NULL",
        [now, email],
        connection
      );
      const result = await dbExecute(
        "INSERT INTO `UserInvite` (`email`, `role`, `tokenHash`, `invitedById`, `expiresAt`, `createdAt`) VALUES (?, ?, ?, ?, ?, ?)",
        [email, role, tokenHash, Number(auth.user.sub), expiresAt, now],
        connection
      );
      return result.insertId;
    });

    const row = await dbQueryOne<InviteRow>(`${INVITE_SELECT} WHERE i.\`id\` = ? LIMIT 1`, [inviteId]);
    const item = row ? mapInviteRow(row, now) : null;

    try {
      await sendInviteEmail({ email, role, token, expiresAt, inviterName: auth.user.name });
    } catch (emailError) {
      console.error("POST /api/users/invites sendMail error:", emailError);
      return NextResponse.json({ ok: false, error: "INVITE_EMAIL_FAILED", item }, { status: 502 });
    }

    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (e) {
    console.error("POST /api/users/invites error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
