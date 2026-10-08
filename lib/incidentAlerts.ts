import "server-only";

import type { RowDataPacket } from "mysql2/promise";
import { toDate } from "@lib/dateFormat";
import { sendMail } from "@lib/email";
import { buildIncidentDownDigest, buildIncidentRecoveryDigest } from "@lib/emailTemplates";
import { getIncidentAlertConfig } from "@lib/incidentRules";
import { dbExecute, dbQuery } from "@lib/mysql";
import { getConfiguredPublicOrigin } from "@lib/publicUrl";

type RecipientRow = RowDataPacket & { email: string };
type AlertRow = RowDataPacket & {
  id: number;
  antennaName: string;
  networkName: string | null;
  lastDownAt: Date | string;
  recoveredAt?: Date | string | null;
};

export type IncidentAlertResult = { downSent: number; recoverySent: number };

const MAX_INCIDENTS_PER_DIGEST_QUERY = 500;

function placeholders(count: number) {
  return Array.from({ length: count }, () => "?").join(", ");
}

async function markSent(
  column: "alertSentAt" | "recoveryAlertSentAt",
  eventType: "ALERT_SENT" | "RECOVERY_ALERT_SENT",
  ids: number[],
  recipientCount: number,
  now: Date
) {
  await dbExecute(
    `UPDATE \`Incident\` SET \`${column}\` = ?, \`updatedAt\` = ? WHERE \`id\` IN (${placeholders(ids.length)})`,
    [now, now, ...ids]
  );

  const message = `Aviso enviado por e-mail para ${recipientCount} destinatário(s).`;
  await dbExecute(
    `INSERT INTO \`IncidentEvent\` (\`incidentId\`, \`type\`, \`message\`, \`createdAt\`) VALUES ${ids
      .map(() => "(?, ?, ?, ?)")
      .join(", ")}`,
    ids.flatMap((id) => [id, eventType, message, now])
  );
}

// Roda no fim de cada sync (a cada 5 min pelo worker). Um único e-mail-resumo por tipo e ciclo.
// Se o envio falhar, nada é marcado e o próximo ciclo tenta de novo.
export async function processIncidentAlerts(now = new Date()): Promise<IncidentAlertResult> {
  const result: IncidentAlertResult = { downSent: 0, recoverySent: 0 };
  const config = getIncidentAlertConfig(process.env);
  if (!config.enabled) return result;

  const recipients = await dbQuery<RecipientRow>(
    "SELECT `email` FROM `User` WHERE `role` IN ('ADMIN', 'SUPERADMIN') AND `isBlocked` = 0 AND (`suspendedUntil` IS NULL OR `suspendedUntil` <= ?)",
    [now]
  );
  if (!recipients.length) return result;

  const to = recipients.map((row) => row.email).join(", ");
  const appUrl = getConfiguredPublicOrigin();
  const threshold = new Date(now.getTime() - config.minMinutes * 60_000);

  const down = await dbQuery<AlertRow>(
    `SELECT \`id\`, \`antennaName\`, \`networkName\`, \`lastDownAt\` FROM \`Incident\` WHERE \`status\` <> 'RESOLVED' AND \`recoveredAt\` IS NULL AND \`alertSentAt\` IS NULL AND \`alertsSuppressed\` = 0 AND \`lastDownAt\` <= ? ORDER BY \`lastDownAt\` ASC LIMIT ${MAX_INCIDENTS_PER_DIGEST_QUERY}`,
    [threshold]
  );
  if (down.length) {
    try {
      await sendMail({
        to,
        ...buildIncidentDownDigest(
          down.map((row) => ({ antennaName: row.antennaName, networkName: row.networkName, since: toDate(row.lastDownAt) })),
          { now, appUrl, minMinutes: config.minMinutes }
        ),
      });
      await markSent("alertSentAt", "ALERT_SENT", down.map((row) => Number(row.id)), recipients.length, now);
      result.downSent = down.length;
    } catch (error) {
      console.error("processIncidentAlerts: falha ao enviar o alerta de queda:", error);
    }
  }

  const recovered = await dbQuery<AlertRow>(
    `SELECT \`id\`, \`antennaName\`, \`networkName\`, \`lastDownAt\`, \`recoveredAt\` FROM \`Incident\` WHERE \`alertSentAt\` IS NOT NULL AND \`recoveredAt\` IS NOT NULL AND \`recoveryAlertSentAt\` IS NULL ORDER BY \`recoveredAt\` ASC LIMIT ${MAX_INCIDENTS_PER_DIGEST_QUERY}`
  );
  if (recovered.length) {
    try {
      await sendMail({
        to,
        ...buildIncidentRecoveryDigest(
          recovered.map((row) => ({
            antennaName: row.antennaName,
            networkName: row.networkName,
            since: toDate(row.lastDownAt),
            until: toDate(row.recoveredAt ?? row.lastDownAt),
          })),
          { appUrl }
        ),
      });
      await markSent(
        "recoveryAlertSentAt",
        "RECOVERY_ALERT_SENT",
        recovered.map((row) => Number(row.id)),
        recipients.length,
        now
      );
      result.recoverySent = recovered.length;
    } catch (error) {
      console.error("processIncidentAlerts: falha ao enviar o aviso de normalização:", error);
    }
  }

  return result;
}
