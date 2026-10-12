export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { updateAccountProfile } from "@lib/account";
import { profileSchema } from "@lib/accountValidators";
import { requireRequestAuth } from "@lib/auth";
import { checkRateLimit, rateLimitResponse } from "@lib/rateLimit";

// Dados pessoais do próprio usuário (nome, cargo e telefone).
export async function PATCH(req: Request) {
  try {
    const auth = await requireRequestAuth(req);
    if ("response" in auth) return auth.response;

    const rateLimit = checkRateLimit(req, "account-profile", {
      max: 30,
      windowMs: 15 * 60_000,
      key: auth.user.sub,
    });
    if (!rateLimit.ok) return rateLimitResponse(rateLimit);

    const parsed = profileSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_FAILED", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const profile = await updateAccountProfile(Number(auth.user.sub), parsed.data);
    if (!profile) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    return NextResponse.json({ ok: true, user: profile });
  } catch (e) {
    console.error("PATCH /api/account error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
