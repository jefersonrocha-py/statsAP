// Bootstrap do usuário padrão: roda a cada startup do web e cria o superadmin do .env
// (SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, SUPERADMIN_NAME) só quando o banco não tem nenhum SUPERADMIN.
import bcrypt from "bcryptjs";
import { decideSuperadminBootstrap } from "./bootstrap-rules.mjs";
import { createMysqlConnection } from "./mysql-utils.mjs";

const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SUPERADMIN_PASSWORD;
const name = process.env.SUPERADMIN_NAME?.trim();

const connection = await createMysqlConnection();
try {
  const [[counts]] = await connection.execute(
    "SELECT COUNT(*) AS `total` FROM `User` WHERE `role` = 'SUPERADMIN'"
  );
  const [taken] = email
    ? await connection.execute("SELECT `id` FROM `User` WHERE `email` = ? LIMIT 1", [email])
    : [[]];

  const decision = decideSuperadminBootstrap({
    superadminCount: Number(counts.total),
    emailTaken: taken.length > 0,
    email,
    password,
    name,
  });

  if (decision === "skip") {
    console.log("Bootstrap: superadmin já existe; nada a fazer.");
  } else if (decision === "missing-credentials") {
    console.error(
      "Bootstrap: o banco não tem superadmin e faltam SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD ou SUPERADMIN_NAME no .env."
    );
  } else if (decision === "email-taken") {
    console.error(
      `Bootstrap: o banco não tem superadmin, mas ${email} já é de outra conta; nenhum usuário foi promovido automaticamente.`
    );
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    await connection.execute(
      "INSERT INTO `User` (`name`, `email`, `passwordHash`, `role`, `isBlocked`, `suspendedUntil`, `createdAt`) VALUES (?, ?, ?, 'SUPERADMIN', 0, NULL, ?)",
      [name, email, passwordHash, new Date()]
    );
    console.log("Bootstrap: superadmin inicial criado:", email);
  }
} finally {
  await connection.end();
}
