import bcrypt from "bcryptjs";
import { createMysqlConnection } from "./mysql-utils.mjs";

const email = process.env.SUPERADMIN_EMAIL?.toLowerCase();
const password = process.env.SUPERADMIN_PASSWORD;
const name = process.env.SUPERADMIN_NAME || "Super Admin";
const promoteIfExists = process.env.SUPERADMIN_PROMOTE_IF_EXISTS === "true";
const syncPasswordIfExists = process.env.SUPERADMIN_SYNC_PASSWORD_IF_EXISTS === "true";

if (!email || !password) {
  console.log("SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD não definidos. Seed ignorado.");
  process.exit(0);
}

(async () => {
  const connection = await createMysqlConnection();

  try {
    const [rows] = await connection.execute(
      "SELECT `id`, `role` FROM `User` WHERE `email` = ? LIMIT 1",
      [email]
    );
    const exists = rows[0];
    const passwordHash = await bcrypt.hash(password, 12);

    if (exists?.id) {
      // O nome só vale na criação: depois disso, quem manda é o que o usuário salvou em Minha Conta.
      const assignments = [];
      const values = [];

      if (exists.role !== "SUPERADMIN") {
        if (promoteIfExists) {
          assignments.push("`role` = 'SUPERADMIN'");
        } else {
          console.log("Usuário existente não foi promovido automaticamente. Use SUPERADMIN_PROMOTE_IF_EXISTS=true se isso for intencional.");
        }
      }

      if (exists.role === "SUPERADMIN" || promoteIfExists) {
        assignments.push("`isBlocked` = 0", "`suspendedUntil` = NULL");
        if (syncPasswordIfExists) {
          assignments.push("`passwordHash` = ?");
          values.push(passwordHash);
        }
      }

      if (assignments.length) {
        values.push(exists.id);
        await connection.execute(
          `UPDATE \`User\` SET ${assignments.join(", ")} WHERE \`id\` = ?`,
          values
        );
      }

      if (exists.role !== "SUPERADMIN" && promoteIfExists) {
        console.log("Usuário promovido para SUPERADMIN:", email);
      } else {
        console.log("Superadmin já existe:", email);
      }
    } else {
      await connection.execute(
        "INSERT INTO `User` (`name`, `email`, `passwordHash`, `role`, `isBlocked`, `suspendedUntil`, `createdAt`) VALUES (?, ?, ?, 'SUPERADMIN', 0, NULL, ?)",
        [name, email, passwordHash, new Date()]
      );
      console.log("Superadmin criado:", email);
    }
  } catch (error) {
    console.error("Seed superadmin falhou:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
})();
