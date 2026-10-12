export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { changeAccountEmail } from "@lib/account";
import { changeEmailSchema } from "@lib/accountValidators";
import { requireRequestAuth, setAuthCookies, signAuthToken } from "@lib/auth";
import { sendMail } from "@lib/email";
import { buildEmailChangedNotice } from "@lib/emailTemplates";
import { checkRateLimit, rateLimitResponse } from "@lib/rateLimit";

// Senha atual errada responde 400, não 401: no cliente, 401 significa sessão encerrada.
const ERROR_STATUS = { INVALID_PASSWORD: 400, SAME_EMAIL: 400, EMAIL_TAKEN: 409, NOT_FOUND: 404 } as const;

// Troca o e-mail de acesso (login) do próprio usuário, confirmada pela senha atual.
export async function POST(req: Request) {
  try {
    const auth = await requireRequestAuth(req);
    if ("response" in auth) return auth.response;

    const rateLimit = checkRateLimit(req, "account-email", {
      max: 5,
      windowMs: 15 * 60_000,
      key: auth.user.sub,
    });
    if (!rateLimit.ok) return rateLimitResponse(rateLimit);

    const parsed = changeEmailSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_FAILED", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await changeAccountEmail(Number(auth.user.sub), parsed.data);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: ERROR_STATUS[result.error] });
    }

    const { profile, previousEmail } = result;
    const token = await signAuthToken({
      sub: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
    });
    setAuthCookies(cookies(), token);

    // O aviso ao endereço antigo não pode impedir a troca: se o SMTP falhar, fica só o log.
    try {
      await sendMail({
        to: previousEmail,
        ...buildEmailChangedNotice({ name: profile.name, newEmail: profile.email }),
      });
    } catch (mailError) {
      console.error("POST /api/account/email: falha ao avisar o e-mail anterior:", mailError);
    }

    return NextResponse.json({ ok: true, user: profile });
  } catch (e) {
    console.error("POST /api/account/email error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
