export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { RowDataPacket } from "mysql2/promise";
import { NextResponse } from "next/server";
import { getAvatarKey } from "@lib/account";
import { requireRequestAuth } from "@lib/auth";
import { isAvatarKeyOf } from "@lib/avatarKey";
import { mapUserRow } from "@lib/dbMappers";
import { mapDbError } from "@lib/dbErrors";
import { dbExecute, dbQueryOne } from "@lib/mysql";
import { checkRateLimit, rateLimitResponse } from "@lib/rateLimit";
import { removeStoredObject } from "@lib/storage";
import { z } from "zod";

type UserRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  role: "SUPERADMIN" | "ADMIN" | "USER";
  createdAt: Date | string;
  isBlocked: number | boolean;
  suspendedUntil: Date | string | null;
};

type CountRow = RowDataPacket & {
  total: number;
};

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const suspendUntilSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value, ctx) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe uma data de suspensão válida.",
      });
      return z.NEVER;
    }
    if (parsed.getTime() <= Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A suspensão deve terminar no futuro.",
      });
      return z.NEVER;
    }
    return parsed;
  });

const updateUserSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ACTIVATE") }),
  z.object({ action: z.literal("BLOCK") }),
  z.object({
    action: z.literal("SUSPEND"),
    suspendedUntil: suspendUntilSchema,
  }),
]);

async function getTargetUser(userId: number) {
  return dbQueryOne<UserRow>(
    "SELECT `id`, `name`, `email`, `role`, `createdAt`, `isBlocked`, `suspendedUntil` FROM `User` WHERE `id` = ? LIMIT 1",
    [userId]
  );
}

async function ensureAnotherActiveSuperadminExists(userId: number) {
  const now = new Date();
  const row = await dbQueryOne<CountRow>(
    "SELECT COUNT(*) AS `total` FROM `User` WHERE `role` = 'SUPERADMIN' AND `id` <> ? AND `isBlocked` = 0 AND (`suspendedUntil` IS NULL OR `suspendedUntil` <= ?)",
    [userId, now]
  );

  return Number(row?.total ?? 0) > 0;
}

async function guardSensitiveSuperadminMutation(user: UserRow) {
  if (user.role !== "SUPERADMIN") return null;
  const hasAnotherSuperadmin = await ensureAnotherActiveSuperadminExists(user.id);
  if (hasAnotherSuperadmin) return null;
  return NextResponse.json(
    { ok: false, error: "LAST_ACTIVE_SUPERADMIN" },
    { status: 409 }
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireRequestAuth(req, ["SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    const rateLimit = checkRateLimit(req, "admin-update-user", {
      max: 60,
      windowMs: 60 * 60_000,
      key: auth.user.sub,
    });
    if (!rateLimit.ok) {
      return rateLimitResponse(rateLimit);
    }

    const parsedParams = paramsSchema.safeParse(params);
    if (!parsedParams.success) {
      return NextResponse.json(
        { ok: false, error: "INVALID_USER_ID", details: parsedParams.error.issues },
        { status: 400 }
      );
    }

    const userId = parsedParams.data.id;
    if (String(userId) === auth.user.sub) {
      return NextResponse.json({ ok: false, error: "CANNOT_MUTATE_SELF" }, { status: 400 });
    }

    const targetUser = await getTargetUser(userId);
    if (!targetUser) {
      return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
    }

    const payload = await req.json().catch(() => ({}));
    const parsedBody = updateUserSchema.safeParse(payload);
    if (!parsedBody.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_FAILED", details: parsedBody.error.issues },
        { status: 400 }
      );
    }

    if (parsedBody.data.action === "BLOCK" || parsedBody.data.action === "SUSPEND") {
      const guard = await guardSensitiveSuperadminMutation(targetUser);
      if (guard) return guard;
    }

    if (parsedBody.data.action === "ACTIVATE") {
      await dbExecute(
        "UPDATE `User` SET `isBlocked` = 0, `suspendedUntil` = NULL WHERE `id` = ?",
        [userId]
      );
    }

    if (parsedBody.data.action === "BLOCK") {
      await dbExecute(
        "UPDATE `User` SET `isBlocked` = 1, `suspendedUntil` = NULL WHERE `id` = ?",
        [userId]
      );
    }

    if (parsedBody.data.action === "SUSPEND") {
      await dbExecute(
        "UPDATE `User` SET `isBlocked` = 0, `suspendedUntil` = ? WHERE `id` = ?",
        [parsedBody.data.suspendedUntil, userId]
      );
    }

    const updated = await getTargetUser(userId);
    return NextResponse.json({ ok: true, item: updated ? mapUserRow(updated) : null });
  } catch (error) {
    console.error("PATCH /api/users/[id] error:", error);
    const mapped = mapDbError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireRequestAuth(req, ["SUPERADMIN"]);
    if ("response" in auth) return auth.response;

    const rateLimit = checkRateLimit(req, "admin-delete-user", {
      max: 20,
      windowMs: 60 * 60_000,
      key: auth.user.sub,
    });
    if (!rateLimit.ok) {
      return rateLimitResponse(rateLimit);
    }

    const parsedParams = paramsSchema.safeParse(params);
    if (!parsedParams.success) {
      return NextResponse.json(
        { ok: false, error: "INVALID_USER_ID", details: parsedParams.error.issues },
        { status: 400 }
      );
    }

    const userId = parsedParams.data.id;
    if (String(userId) === auth.user.sub) {
      return NextResponse.json({ ok: false, error: "CANNOT_DELETE_SELF" }, { status: 400 });
    }

    const targetUser = await getTargetUser(userId);
    if (!targetUser) {
      return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
    }

    const guard = await guardSensitiveSuperadminMutation(targetUser);
    if (guard) return guard;

    const avatarKey = await getAvatarKey(userId);
    await dbExecute("DELETE FROM `User` WHERE `id` = ? LIMIT 1", [userId]);

    // A foto de perfil sai junto com a conta. Se o MinIO estiver fora, a exclusão vale mesmo assim.
    if (isAvatarKeyOf(avatarKey, userId)) {
      try {
        await removeStoredObject(avatarKey);
      } catch (storageError) {
        console.error("DELETE /api/users/[id]: falha ao apagar a foto do usuário excluído:", avatarKey, storageError);
      }
    }

    return NextResponse.json({ ok: true, id: userId });
  } catch (error) {
    console.error("DELETE /api/users/[id] error:", error);
    const mapped = mapDbError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
