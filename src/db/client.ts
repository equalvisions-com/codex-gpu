import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';  // uses postgres.js driver under the hood

declare global {
  // eslint-disable-next-line no-var
  var __DRIZZLE_SQL__: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __DRIZZLE_DB__: ReturnType<typeof drizzle> | undefined;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const isProduction = process.env.NODE_ENV === "production";
const shouldEnforceSSL =
  process.env.DATABASE_SSL === "true" ||
  process.env.DATABASE_SSL === "require" ||
  isProduction;

const rejectUnauthorized =
  process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "false" ? false : true;

const sql = globalThis.__DRIZZLE_SQL__ ?? postgres(connectionString, {
  max: 10, // maximum number of connections your app uses
  prepare: false, // disable prepared statements (safer behind PgBouncer)
  ssl: shouldEnforceSSL ? { rejectUnauthorized } : undefined,
});

if (process.env.NODE_ENV !== 'production') globalThis.__DRIZZLE_SQL__ = sql;

export const db = globalThis.__DRIZZLE_DB__ ?? drizzle(sql);
if (process.env.NODE_ENV !== 'production') globalThis.__DRIZZLE_DB__ = db;
