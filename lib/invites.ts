import "server-only";

import type { RowDataPacket } from "mysql2/promise";
import { toIso } from "@lib/dbMappers";
import { sendMail } from "@lib/email";
import { buildInviteEmail } from "@lib/emailTemplates";
import { getInviteState, type InviteState } from "@lib/inviteToken";
import { buildPublicUrl } from "@lib/publicUrl";

export type InviteRow = RowDataPacket & {
  id: number;
  email: string;
  role: string;
  tokenHash: string;
  invitedById: number | null;
  invitedByName?: string | null;
  expiresAt: Date | string;
  acceptedAt: Date | string | null;
  revokedAt: Date | string | null;
  createdAt: Date | string;
};

export type InviteItem = {
  id: number;
  email: string;
  role: string;
  invitedByName: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  state: InviteState;
};

export const INVITE_SELECT =
  "SELECT i.`id`, i.`email`, i.`role`, i.`tokenHash`, i.`invitedById`, u.`name` AS `invitedByName`, i.`expiresAt`, i.`acceptedAt`, i.`revokedAt`, i.`createdAt` FROM `UserInvite` i LEFT JOIN `User` u ON u.`id` = i.`invitedById`";

export function mapInviteRow(row: InviteRow, now = new Date()): InviteItem {
  return {
    id: Number(row.id),
    email: row.email,
    role: row.role,
    invitedByName: row.invitedByName ?? null,
    expiresAt: toIso(row.expiresAt),
    createdAt: toIso(row.createdAt),
    state: getInviteState(row, now),
  };
}

export async function sendInviteEmail(input: {
  email: string;
  role: string;
  token: string;
  expiresAt: Date;
  inviterName: string;
}) {
  const acceptUrl = buildPublicUrl("/accept-invite", { token: input.token });
  await sendMail({
    to: input.email,
    ...buildInviteEmail({
      acceptUrl,
      role: input.role,
      expiresAt: input.expiresAt,
      inviterName: input.inviterName,
    }),
  });
}
