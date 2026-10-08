import fs from "node:fs/promises";
import path from "node:path";
import { createMysqlConnection } from "./mysql-utils.mjs";

const schemaPath = path.resolve(process.cwd(), "db", "schema.sql");

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.execute(
    `
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName]
  );

  return Array.isArray(rows) && rows.length > 0;
}

async function ensureColumn(connection, tableName, columnName, ddl) {
  if (await columnExists(connection, tableName, columnName)) return;
  await connection.query(ddl);
  console.log(`Added ${tableName}.${columnName} column.`);
}

// Migrações de dados executadas uma única vez (registradas em SchemaMigration).
// Cada comando também é idempotente, para o caso de o processo cair no meio.
async function runOnce(connection, name, statements) {
  const [rows] = await connection.execute("SELECT 1 FROM `SchemaMigration` WHERE `name` = ? LIMIT 1", [name]);
  if (Array.isArray(rows) && rows.length > 0) return;

  for (const statement of statements) {
    await connection.query(statement);
  }
  await connection.execute("INSERT INTO `SchemaMigration` (`name`, `appliedAt`) VALUES (?, UTC_TIMESTAMP())", [name]);
  console.log(`Migration applied: ${name}`);
}

// APs que já estavam offline na implantação ganham ocorrência com alertas suprimidos:
// nenhum e-mail de queda nem de normalização, e a tela não finge que houve alerta.
const INCIDENT_BACKFILL_V1 = [
  `INSERT INTO \`Incident\` (\`antennaId\`, \`antennaName\`, \`networkName\`, \`status\`, \`wentDownAt\`, \`lastDownAt\`, \`alertsSuppressed\`, \`createdAt\`, \`updatedAt\`)
   SELECT a.\`id\`, LEFT(a.\`name\`, 80), a.\`networkName\`, 'OPEN',
          COALESCE(a.\`lastStatusChange\`, UTC_TIMESTAMP()), COALESCE(a.\`lastStatusChange\`, UTC_TIMESTAMP()),
          1, UTC_TIMESTAMP(), UTC_TIMESTAMP()
   FROM \`Antenna\` a
   WHERE a.\`gdmsApId\` IS NOT NULL
     AND a.\`status\` = 'DOWN'
     AND NOT EXISTS (
       SELECT 1 FROM \`Incident\` i WHERE i.\`antennaId\` = a.\`id\` AND i.\`status\` <> 'RESOLVED'
     )`,
  `INSERT INTO \`IncidentEvent\` (\`incidentId\`, \`type\`, \`message\`, \`toStatus\`, \`createdAt\`)
   SELECT i.\`id\`, 'OPENED', 'Ocorrência criada na implantação (o AP já estava offline).', 'OPEN', UTC_TIMESTAMP()
   FROM \`Incident\` i
   WHERE NOT EXISTS (SELECT 1 FROM \`IncidentEvent\` e WHERE e.\`incidentId\` = i.\`id\`)`,
];

(async () => {
  const connection = await createMysqlConnection({ multipleStatements: true });
  try {
    const sql = await fs.readFile(schemaPath, "utf8");
    await connection.query(sql);
    await ensureColumn(
      connection,
      "User",
      "suspendedUntil",
      "ALTER TABLE `User` ADD COLUMN `suspendedUntil` DATETIME NULL AFTER `isBlocked`"
    );
    await ensureColumn(
      connection,
      "User",
      "notificationsSeenAt",
      "ALTER TABLE `User` ADD COLUMN `notificationsSeenAt` DATETIME NULL"
    );
    await ensureColumn(
      connection,
      "Incident",
      "alertsSuppressed",
      "ALTER TABLE `Incident` ADD COLUMN `alertsSuppressed` TINYINT(1) NOT NULL DEFAULT 0 AFTER `recoveryAlertSentAt`"
    );
    await runOnce(connection, "incident_backfill_v1", INCIDENT_BACKFILL_V1);
    console.log("Database schema is ready.");
  } catch (error) {
    console.error("Database initialization failed:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
})();
