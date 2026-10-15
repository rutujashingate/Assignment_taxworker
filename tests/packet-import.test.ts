import { beforeAll, describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { db, pool } from "../src/lib/db/client";
import { packetImports } from "../src/lib/db/schema";
import { importPacket } from "../src/lib/packet/import";
import { PACKET_SHA256 } from "../src/lib/packet/schema";
import { setupDatabase } from "./helpers";

beforeAll(setupDatabase);
describe("immutable import contract", () => {
  test("imports twice without duplicating source projections", async () => {
    expect((await importPacket()).imported).toBe(false);
    expect((await importPacket()).imported).toBe(false);
    const expected = { packet_import: 1, engagement: 1, source_document: 74, source_value: 3012, engine_version: 3, engine_line: 1877, demo_identity: 8, engagement_access: 8, packet_auxiliary: 13 };
    for (const [table, count] of Object.entries(expected)) {
      const result = await pool.query(`SELECT count(*)::int AS count FROM ${table}`);
      expect(result.rows[0].count, table).toBe(count);
    }
  });
  test("preserves exact original bytes in PostgreSQL", async () => {
    const original = await readFile("data/okafor_lindqvist_2025_packet.json");
    const [stored] = await db.select().from(packetImports);
    expect(stored.rawBytes.equals(original)).toBe(true);
    expect(createHash("sha256").update(stored.rawBytes).digest("hex")).toBe(PACKET_SHA256);
    // JSONB normalizes -0 to 0; exact lexical fidelity is guaranteed by rawBytes.
    expect(stored.rawJson).toEqual(JSON.parse(JSON.stringify(JSON.parse(original.toString("utf8")))));
  });
  test("rejects changed bytes before writing any rows", async () => {
    const directory = await mkdtemp(join(tmpdir(), "miraflores-test-"));
    try {
      const path = join(directory, "changed.json");
      await writeFile(path, Buffer.concat([await readFile("data/okafor_lindqvist_2025_packet.json"), Buffer.from("\n")]));
      await expect(importPacket(path)).rejects.toThrow("SHA-256 mismatch");
      expect((await pool.query("SELECT count(*)::int AS count FROM packet_import")).rows[0].count).toBe(1);
    } finally { await rm(directory, { recursive: true }); }
  });
  test("database rejects source updates, deletes, and truncation", async () => {
    await expect(pool.query("UPDATE engine_line SET record=record WHERE line_key='F1040.2b'")).rejects.toThrow("immutable");
    await expect(pool.query("DELETE FROM source_value WHERE value_id='ev-0492'")).rejects.toThrow("immutable");
    await expect(pool.query("TRUNCATE source_value")).rejects.toThrow("immutable");
  });
});
