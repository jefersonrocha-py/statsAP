import "server-only";

import crypto from "node:crypto";
import { buildPublicUrl } from "@lib/publicUrl";

export function getPasswordResetTokenTtlMinutes() {
  const raw = Number(process.env.PASSWORD_RESET_TOKEN_MINUTES ?? 60);
  return Number.isFinite(raw) && raw >= 15 && raw <= 24 * 60 ? Math.floor(raw) : 60;
}

export function hashPasswordResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createPasswordResetToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return {
    expiresAt: new Date(Date.now() + getPasswordResetTokenTtlMinutes() * 60_000),
    token,
    tokenHash: hashPasswordResetToken(token),
  };
}

export function buildPasswordResetUrl(req: Request, token: string) {
  return buildPublicUrl(req, "/reset-password", { token }, process.env.PASSWORD_RESET_BASE_URL);
}
