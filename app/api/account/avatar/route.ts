export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getAvatarKey, replaceAvatarKey } from "@lib/account";
import { requireRequestAuth } from "@lib/auth";
import { AVATAR_MAX_BYTES, avatarContentType, avatarUrl, buildAvatarKey, isAvatarKeyOf } from "@lib/avatarKey";
import { detectImageType } from "@lib/imageType";
import { checkRateLimit, rateLimitResponse } from "@lib/rateLimit";
import { getStoredObject, putStoredObject, removeStoredObject, StorageUnavailableError } from "@lib/storage";

// Foto de perfil do próprio usuário. O arquivo fica no MinIO (bucket privado) e sai sempre por aqui.

function fail(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

function handleError(label: string, error: unknown) {
  console.error(`${label} error:`, error);
  if (error instanceof StorageUnavailableError) return fail(503, "STORAGE_UNAVAILABLE");
  return fail(500, "INTERNAL_ERROR");
}

async function removeQuietly(key: string | null) {
  if (!key) return;
  try {
    await removeStoredObject(key);
  } catch (error) {
    console.error("avatar: falha ao apagar a foto anterior:", key, error);
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requireRequestAuth(req);
    if ("response" in auth) return auth.response;

    const userId = Number(auth.user.sub);
    const key = await getAvatarKey(userId);
    if (!isAvatarKeyOf(key, userId)) return fail(404, "NOT_FOUND");

    const body = await getStoredObject(key);
    if (!body) return fail(404, "NOT_FOUND");

    // O endereço traz ?v=<identificador da foto>: quando bate com a foto atual, pode ficar em cache.
    const requested = new URL(req.url).searchParams.get("v");
    const isCurrent = avatarUrl(key) === `/api/account/avatar?v=${requested}`;

    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": avatarContentType(key),
        "Content-Length": String(body.length),
        "Cache-Control": isCurrent ? "private, max-age=31536000, immutable" : "private, no-cache",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
      },
    });
  } catch (e) {
    return handleError("GET /api/account/avatar", e);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireRequestAuth(req);
    if ("response" in auth) return auth.response;

    const rateLimit = checkRateLimit(req, "account-avatar", {
      max: 20,
      windowMs: 60 * 60_000,
      key: auth.user.sub,
    });
    if (!rateLimit.ok) return rateLimitResponse(rateLimit);

    const declaredLength = Number(req.headers.get("content-length") ?? 0);
    if (declaredLength > AVATAR_MAX_BYTES) return fail(413, "FILE_TOO_LARGE");

    const body = Buffer.from(await req.arrayBuffer());
    if (body.length === 0) return fail(400, "EMPTY_FILE");
    if (body.length > AVATAR_MAX_BYTES) return fail(413, "FILE_TOO_LARGE");

    // O tipo vem do conteúdo do arquivo, não do que o navegador declarou.
    const type = detectImageType(body);
    if (!type) return fail(415, "UNSUPPORTED_IMAGE");

    const userId = Number(auth.user.sub);
    const key = buildAvatarKey(userId, type.ext, randomBytes(16).toString("hex"));
    await putStoredObject(key, body, type.mime);

    let previous: string | null;
    try {
      previous = await replaceAvatarKey(userId, key);
    } catch (dbError) {
      await removeQuietly(key);
      throw dbError;
    }
    if (previous !== key && isAvatarKeyOf(previous, userId)) await removeQuietly(previous);

    return NextResponse.json({ ok: true, avatarUrl: avatarUrl(key) });
  } catch (e) {
    return handleError("POST /api/account/avatar", e);
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireRequestAuth(req);
    if ("response" in auth) return auth.response;

    const userId = Number(auth.user.sub);
    const previous = await replaceAvatarKey(userId, null);
    if (isAvatarKeyOf(previous, userId)) await removeQuietly(previous);

    return NextResponse.json({ ok: true, avatarUrl: null });
  } catch (e) {
    return handleError("DELETE /api/account/avatar", e);
  }
}
