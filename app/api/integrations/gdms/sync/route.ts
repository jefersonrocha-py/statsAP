import { NextResponse } from "next/server";
import { requireRequestAuthOrInternal } from "@lib/auth";
import { runGdmsSync, SyncInProgressError, type SyncMode } from "@lib/gdmsSync";
import { checkRateLimit, rateLimitResponse } from "@lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const auth = await requireRequestAuthOrInternal(req, ["ADMIN", "SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    // Chamadas internas (worker a cada 5 min) não passam pelo limite; usuários sim.
    if ("user" in auth) {
      const rateLimit = checkRateLimit(req, "gdms-sync", {
        max: 4,
        windowMs: 15 * 60_000,
        key: auth.user.sub,
      });
      if (!rateLimit.ok) return rateLimitResponse(rateLimit);
    }

    const mode: SyncMode = new URL(req.url).searchParams.get("mode") === "status" ? "status" : "full";
    const summary = await runGdmsSync(mode);

    return NextResponse.json({ ...summary, errors: summary.errors.slice(0, 50) });
  } catch (e) {
    if (e instanceof SyncInProgressError) {
      return NextResponse.json({ ok: false, error: "SYNC_IN_PROGRESS" }, { status: 409 });
    }
    console.error("POST /api/integrations/gdms/sync error:", e);
    return NextResponse.json({ ok: false, error: "GDMS_SYNC_FAILED" }, { status: 500 });
  }
}
