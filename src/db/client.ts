import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js"; // uses postgres.js driver under the hood
import { logger } from "@/lib/logger";

declare global {
  var __DRIZZLE_SQL__: ReturnType<typeof postgres> | undefined;
  var __DRIZZLE_DB__: ReturnType<typeof drizzle> | undefined;
}

const connectionString = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === "production";

const missingDatabaseProxy = <T extends object>() =>
  new Proxy({} as T, {
    get() {
      throw new Error("DATABASE_URL is not set");
    },
    apply() {
      throw new Error("DATABASE_URL is not set");
    },
  });

if (!connectionString && !isProduction) {
  logger.warn("[db] DATABASE_URL is not set; database client is disabled.");
}

const shouldEnforceSSL =
  process.env.DATABASE_SSL === "true" ||
  process.env.DATABASE_SSL === "require" ||
  isProduction;

const rejectUnauthorized =
  process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "false" ? false : true;

const sql = connectionString
  ? globalThis.__DRIZZLE_SQL__ ??
    postgres(connectionString, {
      max: 10, // maximum number of connections your app uses
      prepare: false, // disable prepared statements (safer behind PgBouncer)
      ssl: shouldEnforceSSL ? { rejectUnauthorized } : undefined,
    })
  : missingDatabaseProxy<ReturnType<typeof postgres>>();

if (!isProduction && connectionString) {
  globalThis.__DRIZZLE_SQL__ = sql;
}

export const db = connectionString
  ? globalThis.__DRIZZLE_DB__ ?? drizzle(sql)
  : missingDatabaseProxy<ReturnType<typeof drizzle>>();

if (!isProduction && connectionString) {
  globalThis.__DRIZZLE_DB__ = db;
}
