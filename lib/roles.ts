import type { UserRole } from "@lib/jwt";

export function normalizeRole(raw: unknown): UserRole {
  return raw === "SUPERADMIN" || raw === "ADMIN" ? raw : "USER";
}
