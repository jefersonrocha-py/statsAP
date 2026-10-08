import { SignJWT, jwtVerify } from "jose";

// Seguro para o middleware (edge): só JWT e nomes de cookie, sem banco.

const issuer = "etherium";
const audience = "etherium-users";

export const AUTH_COOKIE_NAME = "auth";
export const CSRF_COOKIE_NAME = "csrf";

export type UserRole = "SUPERADMIN" | "ADMIN" | "USER";

export type JwtPayload = {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
};

function getSecret() {
  const value = process.env.JWT_SECRET?.trim();
  if (!value) throw new Error("Missing required environment variable: JWT_SECRET");
  if (value.length < 32) {
    throw new Error("Environment variable JWT_SECRET must be at least 32 characters long.");
  }
  return new TextEncoder().encode(value);
}

export function getJwtExpiresDays() {
  const raw = Number(process.env.JWT_EXPIRES_DAYS ?? 7);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 7;
}

export async function signAuthToken(payload: JwtPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(audience)
    .setExpirationTime(`${getJwtExpiresDays()}d`)
    .sign(getSecret());
}

export async function verifyAuthToken(token: string) {
  const { payload } = await jwtVerify(token, getSecret(), { issuer, audience });
  return payload as unknown as JwtPayload;
}
