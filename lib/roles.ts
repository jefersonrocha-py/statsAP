import type { UserRole } from "@lib/jwt";

export const ROLE_OPTIONS: Array<{ value: UserRole; label: string; description: string }> = [
  { value: "USER", label: "Usuário", description: "Somente visualização" },
  { value: "ADMIN", label: "Administrador", description: "Gerencia APs, sincronização e ocorrências" },
  { value: "SUPERADMIN", label: "Superadministrador", description: "Acesso total, inclusive usuários" },
];

export function normalizeRole(raw: unknown): UserRole {
  return raw === "SUPERADMIN" || raw === "ADMIN" ? raw : "USER";
}

export function roleLabel(role: string): string {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}
