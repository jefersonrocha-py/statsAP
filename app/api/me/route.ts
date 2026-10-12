export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAccountProfile } from "@lib/account";
import { requireRequestAuth } from "@lib/auth";

export async function GET(req: Request) {
  try {
    const auth = await requireRequestAuth(req);
    if ("response" in auth) return auth.response;

    const me = auth.user;
    const profile = await getAccountProfile(Number(me.sub));

    return NextResponse.json({
      ok: true,
      user: {
        id: me.sub,
        email: me.email,
        name: me.name,
        role: me.role,
        phone: profile?.phone ?? null,
        jobTitle: profile?.jobTitle ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
      },
    });
  } catch (e) {
    console.error("GET /api/me error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
