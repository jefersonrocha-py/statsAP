export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { RowDataPacket } from "mysql2/promise";
import { NextResponse } from "next/server";
import { requireRequestAuth } from "@lib/auth";
import { mapAntennaRow } from "@lib/dbMappers";
import { mapDbError } from "@lib/dbErrors";
import { dbExecute, dbQueryOne, withTransaction } from "@lib/mysql";
import { checkRateLimit, rateLimitResponse } from "@lib/rateLimit";
import { emit, emitAll } from "@lib/sse";
import { recordStatusTransition } from "@lib/statusChanges";
import { antennaUpdateSchema } from "@lib/validators";

const patchSchema = antennaUpdateSchema.pick({
  name: true,
  description: true,
  status: true,
});

type AntennaRow = RowDataPacket & {
  id: number;
  name: string;
  description: string | null;
  lat: number;
  lon: number;
  status: string;
  gdmsApId: string | null;
  networkId: string | null;
  networkName: string | null;
  lastSyncAt: Date | string | null;
  lastStatusChange: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const auth = await requireRequestAuth(req);
  if ("response" in auth) return auth.response;

  const idNum = Number(ctx.params.id);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  const item = await dbQueryOne<AntennaRow>(
    "SELECT * FROM `Antenna` WHERE `id` = ? LIMIT 1",
    [idNum]
  );
  if (!item) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, item: mapAntennaRow(item) });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const auth = await requireRequestAuth(req, ["ADMIN", "SUPERADMIN"]);
  if ("response" in auth) return auth.response;

  const rateLimit = checkRateLimit(req, "antenna-update", {
    max: 180,
    windowMs: 15 * 60_000,
    key: auth.user.sub,
  });
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  const idNum = Number(ctx.params.id);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "VALIDATION_FAILED", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data: Record<string, string | Date> = {};
  if (typeof parsed.data.name === "string") data.name = parsed.data.name.trim();
  if (typeof parsed.data.description === "string") {
    data.description = parsed.data.description.trim();
  }
  if (parsed.data.status) data.status = parsed.data.status;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: "NOTHING_TO_UPDATE" }, { status: 400 });
  }

  const before = await dbQueryOne<AntennaRow>(
    "SELECT `id`, `status` FROM `Antenna` WHERE `id` = ? LIMIT 1",
    [idNum]
  );
  if (!before) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const statusChanged = typeof data.status === "string" && data.status !== before.status;
  const now = new Date();

  try {
    const { row: item, emits } = await withTransaction(async (connection) => {
      const assignments: string[] = [];
      const values: Array<string | Date> = [];

      if (data.name !== undefined) {
        assignments.push("`name` = ?");
        values.push(data.name);
      }
      if (data.description !== undefined) {
        assignments.push("`description` = ?");
        values.push(data.description);
      }
      if (data.status !== undefined) {
        assignments.push("`status` = ?");
        values.push(data.status);
      }
      if (statusChanged) {
        assignments.push("`lastStatusChange` = ?");
        values.push(now);
      }
      assignments.push("`updatedAt` = ?");
      values.push(now);
      values.push(String(idNum));

      await dbExecute(
        `UPDATE \`Antenna\` SET ${assignments.join(", ")} WHERE \`id\` = ?`,
        values,
        connection
      );

      const row = await dbQueryOne<AntennaRow>(
        "SELECT * FROM `Antenna` WHERE `id` = ? LIMIT 1",
        [idNum],
        connection
      );
      if (!row) {
        throw new Error("UPDATED_ANTENNA_NOT_FOUND");
      }

      const emits = statusChanged
        ? await recordStatusTransition(connection, {
            antennaId: idNum,
            antennaName: row.name,
            networkName: row.networkName,
            previousStatus: before.status,
            status: data.status as "UP" | "DOWN",
            at: now,
          })
        : [];

      return { row, emits };
    });

    if (emits.length) emitAll(emits);
    else emit("antenna.updated", { id: idNum });

    return NextResponse.json({ ok: true, item: mapAntennaRow(item) });
  } catch (e) {
    const mapped = mapDbError(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const auth = await requireRequestAuth(req, ["ADMIN", "SUPERADMIN"]);
  if ("response" in auth) return auth.response;

  const rateLimit = checkRateLimit(req, "antenna-delete", {
    max: 40,
    windowMs: 60 * 60_000,
    key: auth.user.sub,
  });
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  const idNum = Number(ctx.params.id);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  try {
    const item = await withTransaction(async (connection) => {
      const row = await dbQueryOne<AntennaRow>(
        "SELECT * FROM `Antenna` WHERE `id` = ? LIMIT 1",
        [idNum],
        connection
      );
      if (!row) return null;

      await dbExecute("DELETE FROM `StatusHistory` WHERE `antennaId` = ?", [idNum], connection);
      await dbExecute("DELETE FROM `Antenna` WHERE `id` = ?", [idNum], connection);

      return row;
    });

    if (!item) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    emit("antenna.deleted", { id: idNum });
    return NextResponse.json({ ok: true, item: mapAntennaRow(item) });
  } catch (e) {
    const mapped = mapDbError(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
