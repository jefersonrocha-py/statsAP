import "server-only";

import type { RowDataPacket } from "mysql2/promise";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  getJwtExpiresDays,
  verifyAuthToken,
  type JwtPayload,
  type UserRole,
} from "@lib/jwt";
import { dbQueryOne } from "@lib/mysql";
import {
  getCookieValue,
  isUnsafeMethod,
  requireCsrfToken,
  requireTrustedOrigin as requestRequiresTrustedOrigin,
} from "@lib/requestSecurity";
import { normalizeRole } from "@lib/roles";
import { getUserAccountStatus } from "@lib/userStatus";

export {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  getJwtExpiresDays,
  signAuthToken,
  verifyAuthToken,
} from "@lib/jwt";
export type { JwtPayload, UserRole } from "@lib/jwt";

type CookieStoreLike = {
  set: (options: {
    name: string;
    value: string;
    httpOnly?: boolean;
    sameSite?: "strict" | "lax" | "none";
    secure?: boolean;
    path?: string;
    maxAge?: number;
    priority?: "low" | "medium" | "high";
  }) => unknown;
};

type SessionUserRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  role: string;
  isBlocked: number | boolean;
  suspendedUntil: Date | string | null;
};

export function shouldUseSecureCookies() {
  if (process.env.NODE_ENV === "production") return true;
  if (process.env.COOKIE_SECURE) return process.env.COOKIE_SECURE === "true";
  return false;
}

export function isAdminRole(role: UserRole | null | undefined) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

function buildBaseCookieOptions(maxAge: number) {
  return {
    sameSite: "strict" as const,
    secure: shouldUseSecureCookies(),
    path: "/",
    maxAge,
    priority: "high" as const,
  };
}

function createCsrfToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function setAuthCookies(cookieStore: CookieStoreLike, authToken: string) {
  const maxAge = 60 * 60 * 24 * getJwtExpiresDays();
  const baseOptions = buildBaseCookieOptions(maxAge);

  cookieStore.set({
    name: AUTH_COOKIE_NAME,
    value: authToken,
    httpOnly: true,
    ...baseOptions,
  });

  cookieStore.set({
    name: CSRF_COOKIE_NAME,
    value: createCsrfToken(),
    httpOnly: false,
    ...baseOptions,
  });
}

export function clearAuthCookies(cookieStore: CookieStoreLike) {
  const baseOptions = buildBaseCookieOptions(0);

  cookieStore.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    ...baseOptions,
  });

  cookieStore.set({
    name: CSRF_COOKIE_NAME,
    value: "",
    httpOnly: false,
    ...baseOptions,
  });
}

function getAuthTokenRecordFromRequest(req: Request) {
  const bearer = req.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) {
    return { token: bearer.slice("Bearer ".length).trim(), source: "bearer" as const };
  }

  const authCookie = getCookieValue(req, AUTH_COOKIE_NAME);
  if (authCookie) {
    return { token: authCookie, source: "cookie" as const };
  }

  return { token: null, source: null };
}

export function getAuthTokenFromRequest(req: Request) {
  return getAuthTokenRecordFromRequest(req).token;
}

export function requireTrustedOrigin(req: Request) {
  return requestRequiresTrustedOrigin(req);
}

export function requireCookieMutationProtection(req: Request) {
  if (!isUnsafeMethod(req.method)) return null;
  return requireCsrfToken(req, CSRF_COOKIE_NAME);
}

function deny(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

// Sessão revogada (usuário excluído, bloqueado ou suspenso): apaga os cookies para o
// middleware não devolver o usuário de /login para / em laço.
function revokedSessionResponse() {
  const response = deny(401, "SESSION_REVOKED");
  clearAuthCookies(response.cookies);
  return response;
}

function constantTimeEqual(a: string, b: string) {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);

  if (left.length !== right.length) return false;

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index];
  }

  return diff === 0;
}

export async function loadSessionUser(userId: string): Promise<JwtPayload | null> {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) return null;

  const row = await dbQueryOne<SessionUserRow>(
    "SELECT `id`, `name`, `email`, `role`, `isBlocked`, `suspendedUntil` FROM `User` WHERE `id` = ? LIMIT 1",
    [id]
  );
  if (!row) return null;
  if (getUserAccountStatus(row).status !== "ACTIVE") return null;

  return {
    sub: String(row.id),
    email: row.email,
    name: row.name ?? "",
    role: normalizeRole(row.role),
  };
}

export async function requireRequestAuth(req: Request, roles?: UserRole[]) {
  const { token, source } = getAuthTokenRecordFromRequest(req);
  if (!token) return { response: deny(401, "UNAUTHORIZED") };

  if (source === "cookie" && isUnsafeMethod(req.method)) {
    const csrfError = requireCookieMutationProtection(req);
    if (csrfError) return { response: csrfError };
  }

  let tokenUser: JwtPayload;
  try {
    tokenUser = await verifyAuthToken(token);
  } catch {
    return { response: deny(401, "UNAUTHORIZED") };
  }

  const user = await loadSessionUser(tokenUser.sub);
  if (!user) return { response: revokedSessionResponse() };

  if (roles?.length && !roles.includes(user.role)) {
    return { response: deny(403, "FORBIDDEN") };
  }
  return { user };
}

export function hasInternalApiKey(req: Request) {
  const expected = process.env.INTERNAL_API_KEY?.trim();
  if (!expected) return false;
  if (expected.length < 24) return false;

  const received = req.headers.get("x-internal-api-key")?.trim();
  if (!received) return false;
  return constantTimeEqual(received, expected);
}

export async function requireRequestAuthOrInternal(req: Request, roles?: UserRole[]) {
  if (hasInternalApiKey(req)) return { internal: true as const };
  return requireRequestAuth(req, roles);
}
