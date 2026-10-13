import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { requireRequestAuth } from "@lib/auth";
import { mapStatusHistoryRow } from "@lib/dbMappers";
import { dbQuery } from "@lib/mysql";

type StatusHistoryRow = RowDataPacket & {
  id: number;
  antennaId: number;
  status: string;
  changedAt: Date | string;
};

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRequestAuth(req);
  if ("response" in auth) return auth.response;

  const antennaId = Number(params.id);
  if (!Number.isFinite(antennaId)) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const limitParam = Number(searchParams.get("limit") || 50);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.floor(limitParam), 1), 200) : 50;

  const items = await dbQuery<StatusHistoryRow>(
    `SELECT \`id\`, \`antennaId\`, \`status\`, \`changedAt\` FROM \`StatusHistory\` WHERE \`antennaId\` = ? ORDER BY \`changedAt\` DESC LIMIT ${limit}`,
    [antennaId]
  );

  return NextResponse.json({ ok: true, items: items.map(mapStatusHistoryRow) });
}
