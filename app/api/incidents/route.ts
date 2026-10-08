export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRequestAuth } from "@lib/auth";
import { listIncidents } from "@lib/incidents";

const querySchema = z.object({
  status: z.enum(["ACTIVE", "OPEN", "IN_PROGRESS", "RESOLVED", "ALL"]).catch("ACTIVE"),
  network: z.string().trim().max(255).catch(""),
  q: z.string().trim().max(100).catch(""),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(100).catch(25),
});

export async function GET(req: Request) {
  try {
    const auth = await requireRequestAuth(req);
    if ("response" in auth) return auth.response;

    const searchParams = new URL(req.url).searchParams;
    const filters = querySchema.parse({
      status: searchParams.get("status") ?? undefined,
      network: searchParams.get("network") ?? undefined,
      q: searchParams.get("q") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    });

    return NextResponse.json({ ok: true, ...(await listIncidents(filters)) });
  } catch (e) {
    console.error("GET /api/incidents error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
