export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRequestAuth } from "@lib/auth";
import { applyIncidentAction } from "@lib/incidents";
import { INCIDENT_MESSAGE_MAX } from "@lib/incidentRules";
import { checkRateLimit, rateLimitResponse } from "@lib/rateLimit";

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });
const bodySchema = z.object({
  action: z.enum(["START", "COMMENT", "RESOLVE"]),
  message: z.string().max(INCIDENT_MESSAGE_MAX + 100).nullish(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRequestAuth(req, ["ADMIN", "SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    const rateLimit = checkRateLimit(req, "incident-action", {
      max: 120,
      windowMs: 15 * 60_000,
      key: auth.user.sub,
    });
    if (!rateLimit.ok) return rateLimitResponse(rateLimit);

    const parsedParams = paramsSchema.safeParse(params);
    if (!parsedParams.success) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    const parsedBody = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsedBody.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_FAILED", details: parsedBody.error.issues },
        { status: 400 }
      );
    }

    const result = await applyIncidentAction({
      incidentId: parsedParams.data.id,
      action: parsedBody.data.action,
      message: parsedBody.data.message,
      actor: { id: Number(auth.user.sub), name: auth.user.name },
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true, item: result.item });
  } catch (e) {
    console.error("POST /api/incidents/[id]/actions error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
