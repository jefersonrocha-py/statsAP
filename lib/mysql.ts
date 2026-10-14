import "server-only";

import mysql from "mysql2/promise";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

type QueryParam = string | number | boolean | Date | null;
type Queryable = Pool | PoolConnection;

const globalForMysql = global as unknown as { mysqlPool?: Pool };

function getRequiredDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing required environment variable: DATABASE_URL");
  }
  return databaseUrl;
}

function createMysqlPool() {
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

  const poolSize = Number(process.env.MYSQL_POOL_SIZE ?? 10);
  const connectionLimit =
    Number.isFinite(poolSize) && poolSize >= 1 && poolSize <= 50 ? Math.floor(poolSize) : 10;

  return mysql.createPool({
    host: url.hostname,
    port: Number(url.port),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    waitForConnections: true,
    connectionLimit,
    queueLimit: 100,
    charset: "utf8mb4",
    timezone: "Z",
    decimalNumbers: true,
    enableKeepAlive: true,
    connectTimeout: 10_000,
    multipleStatements: false,
  });
}

function getPool() {
  if (!globalForMysql.mysqlPool) {
    globalForMysql.mysqlPool = createMysqlPool();
  }
  return globalForMysql.mysqlPool;
}

export async function dbQuery<T extends RowDataPacket>(
  sql: string,
  params: QueryParam[] = [],
  client?: Queryable
): Promise<T[]> {
  const executor = client ?? getPool();
  const [rows] = await executor.execute<T[]>(sql, params);
  return rows;
}

export async function dbQueryOne<T extends RowDataPacket>(
  sql: string,
  params: QueryParam[] = [],
  client?: Queryable
): Promise<T | null> {
  const rows = await dbQuery<T>(sql, params, client);
  return rows[0] ?? null;
}

export async function dbExecute(
  sql: string,
  params: QueryParam[] = [],
  client?: Queryable
): Promise<ResultSetHeader> {
  const executor = client ?? getPool();
  const [result] = await executor.execute<ResultSetHeader>(sql, params);
  return result;
}

export async function withTransaction<T>(callback: (connection: PoolConnection) => Promise<T>) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function pingDb() {
  await dbQuery<RowDataPacket>("SELECT 1 AS ok");
}
