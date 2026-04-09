import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let _client: ReturnType<typeof postgres> | undefined;
let _db: PostgresJsDatabase<typeof schema> | undefined;

function getDb(): PostgresJsDatabase<typeof schema> {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }
  _client = postgres(url, { max: 10 });
  _db = drizzle(_client, { schema });
  return _db;
}

/** Lazy DB — no connection until first query (safe for `next build` without Postgres). */
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_t, prop, receiver) {
    const real = getDb();
    const v = Reflect.get(real, prop, receiver);
    return typeof v === "function" ? v.bind(real) : v;
  },
});
