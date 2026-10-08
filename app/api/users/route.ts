export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { RowDataPacket } from "mysql2/promise";
import { NextResponse } from "next/server";
import { requireRequestAuth } from "@lib/auth";
import { mapUserRow } from "@lib/dbMappers";
import { dbQuery } from "@lib/mysql";

type UserRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: Date | string;
  isBlocked: number | boolean;
  suspendedUntil: Date | string | null;
};

// A criação de usuários passou a ser só por convite (POST /api/users/invites).
export async function GET(req: Request) {
  try {
    const auth = await requireRequestAuth(req, ["SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    const raw = await dbQuery<UserRow>(
      "SELECT `id`, `name`, `email`, `role`, `createdAt`, `isBlocked`, `suspendedUntil` FROM `User` ORDER BY `id` ASC"
    );

    return NextResponse.json({ ok: true, total: raw.length, items: raw.map(mapUserRow) });
  } catch (e) {
    console.error("GET /api/users error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
