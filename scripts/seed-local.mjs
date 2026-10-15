import bcrypt from "bcryptjs";
import { createMysqlConnection } from "./mysql-utils.mjs";

const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SUPERADMIN_PASSWORD;
if (!email || !password) {
  console.error("Defina SUPERADMIN_EMAIL e SUPERADMIN_PASSWORD no .env.");
  process.exit(1);
}
const name = process.env.SUPERADMIN_NAME || "Super Admin";

(async () => {
  const connection = await createMysqlConnection();

  try {
    const [rows] = await connection.execute(
      "SELECT `id` FROM `User` WHERE `email` = ? LIMIT 1",
      [email]
    );
    const exists = rows[0];
    const passwordHash = await bcrypt.hash(password, 12);

    if (exists?.id) {
      await connection.execute(
        "UPDATE `User` SET `role` = 'SUPERADMIN', `passwordHash` = ?, `name` = ?, `isBlocked` = 0 WHERE `id` = ?",
        [passwordHash, name, exists.id]
      );
      console.log("SUPERADMIN atualizado:", email);
    } else {
      await connection.execute(
        "INSERT INTO `User` (`name`, `email`, `role`, `passwordHash`, `isBlocked`, `createdAt`) VALUES (?, ?, 'SUPERADMIN', ?, 0, ?)",
        [name, email, passwordHash, new Date()]
      );
      console.log("SUPERADMIN criado:", email);
    }

    console.log("Credenciais:");
    console.log("  Email:", email);
    console.log("  Senha:", password);
  } catch (error) {
    console.error("Seed falhou:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
})();
