export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRequestAuth } from "@lib/auth";
import { getInviteState } from "@lib/inviteToken";
import { INVITE_SELECT, type InviteRow } from "@lib/invites";
import { dbExecute, dbQueryOne } from "@lib/mysql";

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRequestAuth(req, ["SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    const parsed = paramsSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "INVITE_NOT_FOUND" }, { status: 404 });
    }

    const row = await dbQueryOne<InviteRow>(`${INVITE_SELECT} WHERE i.\`id\` = ? LIMIT 1`, [parsed.data.id]);
    if (!row) return NextResponse.json({ ok: false, error: "INVITE_NOT_FOUND" }, { status: 404 });
    if (getInviteState(row) !== "PENDING") {
      return NextResponse.json({ ok: false, error: "INVITE_NOT_PENDING" }, { status: 409 });
    }

    await dbExecute("UPDATE `UserInvite` SET `revokedAt` = ? WHERE `id` = ?", [new Date(), parsed.data.id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/users/invites/[id] error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
