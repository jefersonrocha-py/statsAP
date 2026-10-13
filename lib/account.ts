import "server-only";

import bcrypt from "bcryptjs";
import type { RowDataPacket } from "mysql2/promise";
import type { ChangeEmailInput, ChangePasswordInput, ProfileInput } from "@lib/accountValidators";
import { avatarUrl } from "@lib/avatarKey";
import type { UserRole } from "@lib/jwt";
import { dbExecute, dbQueryOne, withTransaction } from "@lib/mysql";
import { normalizeRole } from "@lib/roles";
import { sessionCutoff } from "@lib/sessionRules";

// O que o próprio usuário altera em Minha Conta: dados pessoais, e-mail de acesso, senha e foto.

type AccountRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  role: string;
  passwordHash: string;
  phone: string | null;
  jobTitle: string | null;
  avatarKey: string | null;
};
type IdRow = RowDataPacket & { id: number };
type AvatarKeyRow = RowDataPacket & { avatarKey: string | null };

export type AccountProfile = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
};

type AccountFailure<E extends string> = { ok: false; error: E | "NOT_FOUND" };

export type ChangeEmailResult =
  | { ok: true; previousEmail: string; profile: AccountProfile }
  | AccountFailure<"INVALID_PASSWORD" | "SAME_EMAIL" | "EMAIL_TAKEN">;

export type ChangePasswordResult =
  | { ok: true; profile: AccountProfile }
  | AccountFailure<"INVALID_PASSWORD" | "SAME_PASSWORD">;

const ACCOUNT_SELECT =
  "SELECT `id`, `name`, `email`, `role`, `passwordHash`, `phone`, `jobTitle`, `avatarKey` FROM `User` WHERE `id` = ? LIMIT 1";

function toProfile(row: AccountRow): AccountProfile {
  return {
    id: String(row.id),
    name: row.name ?? "",
    email: row.email,
    role: normalizeRole(row.role),
    phone: row.phone ?? null,
    jobTitle: row.jobTitle ?? null,
    avatarUrl: avatarUrl(row.avatarKey),
  };
}

// Com SUPERADMIN_PROMOTE_IF_EXISTS, o seed promove a SUPERADMIN quem tiver o e-mail SUPERADMIN_EMAIL.
// Por isso esse endereço é reservado: só quem já é SUPERADMIN pode assumi-lo.
export function isReservedSuperadminEmail(email: string) {
  const reserved = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(reserved) && email.trim().toLowerCase() === reserved;
}

function isDuplicateEntry(error: unknown) {
  return (error as { code?: string } | null)?.code === "ER_DUP_ENTRY";
}

export async function getAccountProfile(userId: number): Promise<AccountProfile | null> {
  const row = await dbQueryOne<AccountRow>(ACCOUNT_SELECT, [userId]);
  return row ? toProfile(row) : null;
}

export async function updateAccountProfile(userId: number, input: ProfileInput): Promise<AccountProfile | null> {
  await dbExecute("UPDATE `User` SET `name` = ?, `jobTitle` = ?, `phone` = ? WHERE `id` = ?", [
    input.name,
    input.jobTitle,
    input.phone,
    userId,
  ]);
  return getAccountProfile(userId);
}

export async function changeAccountEmail(userId: number, input: ChangeEmailInput): Promise<ChangeEmailResult> {
  try {
    return await withTransaction<ChangeEmailResult>(async (connection) => {
      const row = await dbQueryOne<AccountRow>(`${ACCOUNT_SELECT} FOR UPDATE`, [userId], connection);
      if (!row) return { ok: false, error: "NOT_FOUND" };

      const passwordOk = await bcrypt.compare(input.currentPassword, row.passwordHash);
      if (!passwordOk) return { ok: false, error: "INVALID_PASSWORD" };
      if (input.newEmail === row.email.toLowerCase()) return { ok: false, error: "SAME_EMAIL" };
      if (isReservedSuperadminEmail(input.newEmail) && normalizeRole(row.role) !== "SUPERADMIN") {
        return { ok: false, error: "EMAIL_TAKEN" };
      }

      const taken = await dbQueryOne<IdRow>(
        "SELECT `id` FROM `User` WHERE `email` = ? AND `id` <> ? LIMIT 1",
        [input.newEmail, userId],
        connection
      );
      if (taken) return { ok: false, error: "EMAIL_TAKEN" };

      await dbExecute("UPDATE `User` SET `email` = ? WHERE `id` = ?", [input.newEmail, userId], connection);
      return { ok: true, previousEmail: row.email, profile: toProfile({ ...row, email: input.newEmail }) };
    });
  } catch (error) {
    // Dois pedidos simultâneos para o mesmo e-mail: o índice único decide.
    if (isDuplicateEntry(error)) return { ok: false, error: "EMAIL_TAKEN" };
    throw error;
  }
}

export async function changeAccountPassword(
  userId: number,
  input: ChangePasswordInput,
  nowMs: number = Date.now()
): Promise<ChangePasswordResult> {
  return withTransaction<ChangePasswordResult>(async (connection) => {
    const row = await dbQueryOne<AccountRow>(`${ACCOUNT_SELECT} FOR UPDATE`, [userId], connection);
    if (!row) return { ok: false, error: "NOT_FOUND" };

    const passwordOk = await bcrypt.compare(input.currentPassword, row.passwordHash);
    if (!passwordOk) return { ok: false, error: "INVALID_PASSWORD" };
    if (input.newPassword === input.currentPassword) return { ok: false, error: "SAME_PASSWORD" };

    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    // Sessões criadas antes deste momento deixam de valer (ver lib/sessionRules.ts).
    const changedAt = sessionCutoff(nowMs);

    await dbExecute(
      "UPDATE `User` SET `passwordHash` = ?, `passwordChangedAt` = ? WHERE `id` = ?",
      [passwordHash, changedAt, userId],
      connection
    );
    await dbExecute(
      "UPDATE `PasswordResetToken` SET `usedAt` = ? WHERE `userId` = ? AND `usedAt` IS NULL",
      [changedAt, userId],
      connection
    );

    return { ok: true, profile: toProfile(row) };
  });
}

export async function getAvatarKey(userId: number): Promise<string | null> {
  const row = await dbQueryOne<AvatarKeyRow>("SELECT `avatarKey` FROM `User` WHERE `id` = ? LIMIT 1", [userId]);
  return row?.avatarKey ?? null;
}

// Devolve a chave anterior para quem chamou apagar a foto antiga do armazenamento.
export async function replaceAvatarKey(userId: number, key: string | null): Promise<string | null> {
  const previous = await getAvatarKey(userId);
  await dbExecute("UPDATE `User` SET `avatarKey` = ? WHERE `id` = ?", [key, userId]);
  return previous;
}
