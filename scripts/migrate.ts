import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pool } from "../src/lib/db/client";

export async function migrate() {
  const connection = await pool.connect();
  try {
    await connection.query("SELECT pg_advisory_lock(20417, 1)");
    await connection.query("CREATE TABLE IF NOT EXISTS schema_migration (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
    for (const name of (await readdir(resolve("db/migrations"))).filter(n => n.endsWith(".sql")).sort()) {
      const contents = await readFile(resolve("db/migrations", name), "utf8");
      const checksum = createHash("sha256").update(contents).digest("hex");
      const existing = await connection.query<{ checksum: string }>("SELECT checksum FROM schema_migration WHERE name=$1", [name]);
      if (existing.rows.length) {
        if (existing.rows[0].checksum !== checksum) throw new Error(`Applied migration changed: ${name}`);
        continue;
      }
      await connection.query("BEGIN");
      try {
        await connection.query(contents);
        await connection.query("INSERT INTO schema_migration(name,checksum) VALUES ($1,$2)", [name, checksum]);
        await connection.query("COMMIT");
        console.log(`Applied ${name}`);
      } catch (error) { await connection.query("ROLLBACK"); throw error; }
    }
  } finally { await connection.query("SELECT pg_advisory_unlock(20417, 1)"); connection.release(); }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve("scripts/migrate.ts")) {
  try { await migrate(); } finally { await pool.end(); }
}
