import mysql from "mysql2/promise";

function getRequiredDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing required environment variable: DATABASE_URL");
  }
  return databaseUrl;
}

function parseDatabaseUrl() {
  const url = new URL(getRequiredDatabaseUrl());
  if (url.protocol !== "mysql:") {
    throw new Error("DATABASE_URL must use the mysql protocol.");
  }

  const database = url.pathname.replace(/^\//, "");
  if (!database) {
    throw new Error("DATABASE_URL must include a database name.");
  }
  if (!url.port) {
    throw new Error("DATABASE_URL must include the port (MYSQL_PORT).");
  }

  return {
    host: url.hostname,
    port: Number(url.port),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
  };
}

export async function createMysqlConnection(extraOptions = {}) {
  return mysql.createConnection({
    ...parseDatabaseUrl(),
    charset: "utf8mb4",
    timezone: "Z",
    decimalNumbers: true,
    ...extraOptions,
  });
}
