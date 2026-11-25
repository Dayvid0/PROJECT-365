import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

export type AppDatabase = LibSQLDatabase<typeof schema>;
export type AppTransaction = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];
export type DbExecutor = AppDatabase | AppTransaction;

export interface DbClientOptions {
  url?: string;
  authToken?: string;
}

export function createDbConnection(options: DbClientOptions = {}) {
  const url = options.url ?? process.env.TURSO_DATABASE_URL ?? "file:local.db";
  const authToken = (options.authToken ?? process.env.TURSO_AUTH_TOKEN) || undefined;
  const client: Client = createClient({
    url,
    ...(authToken ? { authToken } : {}),
  });
  const db = drizzle(client, { schema });

  const enableForeignKeys = async () => {
    await client.execute("PRAGMA foreign_keys = ON;");
    if (url.startsWith("file:")) {
      await client.execute("PRAGMA journal_mode = WAL;");
    }
  };

  if (url.startsWith("file:") || url === ":memory:") {
    void enableForeignKeys().catch(() => {
      // Surface on first real query instead of failing module import.
    });
  }

  return { client, db, enableForeignKeys };
}

const globalForDb = globalThis as unknown as {
  __project365DbConnection?: ReturnType<typeof createDbConnection>;
};

function getSingletonConnection() {
  if (!globalForDb.__project365DbConnection) {
    globalForDb.__project365DbConnection = createDbConnection();
  }
  return globalForDb.__project365DbConnection;
}

export const dbConnection = getSingletonConnection();
export const libsqlClient = dbConnection.client;
export const db: AppDatabase = dbConnection.db;
