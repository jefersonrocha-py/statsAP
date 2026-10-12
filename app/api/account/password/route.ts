export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { changeAccountPassword } from "@lib/account";
import { changePasswordSchema } from "@lib/accountValidators";
import { requireRequestAuth, setAuthCookies, signAuthToken } from "@lib/auth";
import { checkRateLimit, rateLimitResponse } from "@lib/rateLimit";

// Senha atual errada responde 400, não 401: no cliente, 401 significa sessão encerrada.
const ERROR_STATUS = { INVALID_PASSWORD: 400, SAME_PASSWORD: 400, NOT_FOUND: 404 } as const;

// Troca a senha do próprio usuário. As sessões abertas antes da troca (outros dispositivos) deixam
// de valer; esta recebe um cookie novo, emitido depois do corte.
export async function POST(req: Request) {
  try {
    const auth = await requireRequestAuth(req);
    if ("response" in auth) return auth.response;

    const rateLimit = checkRateLimit(req, "account-password", {
      max: 5,
      windowMs: 15 * 60_000,
      key: auth.user.sub,
    });
    if (!rateLimit.ok) return rateLimitResponse(rateLimit);

    const parsed = changePasswordSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_FAILED", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await changeAccountPassword(Number(auth.user.sub), parsed.data);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: ERROR_STATUS[result.error] });
    }

    const { profile } = result;
    const token = await signAuthToken({
      sub: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
    });
    setAuthCookies(cookies(), token);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/account/password error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
