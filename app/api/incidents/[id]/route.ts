export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRequestAuth } from "@lib/auth";
import { getIncidentDetail } from "@lib/incidents";

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRequestAuth(req);
    if ("response" in auth) return auth.response;

    const parsed = paramsSchema.safeParse(params);
    if (!parsed.success) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    const item = await getIncidentDetail(parsed.data.id);
    if (!item) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    return NextResponse.json({ ok: true, item });
  } catch (e) {
    console.error("GET /api/incidents/[id] error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
