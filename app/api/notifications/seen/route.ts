export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireRequestAuth } from "@lib/auth";
import { markNotificationsSeen } from "@lib/incidents";

export async function POST(req: Request) {
  try {
    const auth = await requireRequestAuth(req);
    if ("response" in auth) return auth.response;

    await markNotificationsSeen(Number(auth.user.sub));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/notifications/seen error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
