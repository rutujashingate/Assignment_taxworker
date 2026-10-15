import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const shared = globalThis as typeof globalThis & { mirafloresPool?: pg.Pool };
export const pool = shared.mirafloresPool ??= new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? "postgresql:///miraflores_workpaper?host=/tmp",
  max: 5, idleTimeoutMillis: 10000, connectionTimeoutMillis: 5000, allowExitOnIdle: true,
});
export const db = drizzle(pool, { schema });
