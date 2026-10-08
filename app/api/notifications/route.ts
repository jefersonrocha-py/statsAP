export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireRequestAuth } from "@lib/auth";
import { getNotificationSummary } from "@lib/incidents";

export async function GET(req: Request) {
  try {
    const auth = await requireRequestAuth(req);
    if ("response" in auth) return auth.response;

    return NextResponse.json({ ok: true, ...(await getNotificationSummary(Number(auth.user.sub))) });
  } catch (e) {
    console.error("GET /api/notifications error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
