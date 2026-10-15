import { eq } from "drizzle-orm";
import { migrate } from "../scripts/migrate";
import { importPacket } from "../src/lib/packet/import";
import { db } from "../src/lib/db/client";
import { identities } from "../src/lib/db/schema";

let ready: Promise<unknown> | undefined;
export function setupDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  if (!new URL(url).pathname.endsWith("_test")) throw new Error("Tests require a dedicated database ending in _test");
  return ready ??= migrate().then(() => importPacket());
}
export async function actor(id: string) {
  const [result] = await db.select().from(identities).where(eq(identities.id, id));
  if (!result) throw new Error("Seeded identity missing");
  return result;
}
