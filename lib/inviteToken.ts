import crypto from "node:crypto";

export type InviteState = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";

const DEFAULT_TTL_HOURS = 72;

export function getInviteTtlHours(raw = process.env.INVITE_TOKEN_HOURS): number {
  const value = Number(raw ?? DEFAULT_TTL_HOURS);
  return Number.isFinite(value) && value >= 1 && value <= 336 ? Math.floor(value) : DEFAULT_TTL_HOURS;
}

export function hashInviteToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createInviteToken(now = new Date(), ttlHours = getInviteTtlHours()) {
  const token = crypto.randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: hashInviteToken(token),
    expiresAt: new Date(now.getTime() + ttlHours * 3_600_000),
  };
}

function isSet(value: Date | string | null) {
  return value !== null && value !== "";
}

export function getInviteState(
  invite: { acceptedAt: Date | string | null; revokedAt: Date | string | null; expiresAt: Date | string },
  now = new Date()
): InviteState {
  if (isSet(invite.acceptedAt)) return "ACCEPTED";
  if (isSet(invite.revokedAt)) return "REVOKED";
  const expiresAt = invite.expiresAt instanceof Date ? invite.expiresAt : new Date(invite.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) return "EXPIRED";
  return "PENDING";
}
