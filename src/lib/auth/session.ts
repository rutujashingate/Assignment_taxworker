import "server-only";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, lte } from "drizzle-orm";
import { db } from "../db/client";
import { auditEvents, identities, sessions, type Actor } from "../db/schema";
import { readClock } from "../season/clock";
import { assertActive, authorizeEngagement, HttpError, publicIdentity } from "./permissions";

export const SESSION_COOKIE = "miraflores_demo";
const signature = (id: string, key: Buffer) => createHmac("sha256", key).update(id).digest("hex");
export async function listIdentities() {
  const {asOf}=await readClock();
  const active = await db.select().from(identities).where(lte(identities.activeFrom, asOf.slice(0, 10))).orderBy(identities.id);
  return active.map(publicIdentity);
}
export async function createSession(actorId: string, previousToken?: string) {
  const [actor] = await db.select().from(identities).where(eq(identities.id, actorId)).limit(1);
  if (!actor) throw new HttpError(400, "Unknown demo identity.");
  await assertActive(actor);
  await authorizeEngagement(actor, "CL-20417", 2025);
  const id = randomUUID(); const signingKey = randomBytes(32);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const previous = await verifiedSession(previousToken);
  await db.transaction(async tx => {
    await tx.insert(sessions).values({ id, actorId, signingKey, expiresAt });
    if (previous) await tx.delete(sessions).where(eq(sessions.id, previous.id));
    await tx.insert(auditEvents).values({ actorId, clientId: "CL-20417", taxYear: 2025, action: "demo_identity_selected", target: "demo_session", beforeJson: previous ? { actorId: previous.actor.id } : null, afterJson: { actorId } });
  });
  return { token: `${id}.${signature(id, signingKey)}`, expiresAt, actor: publicIdentity(actor) };
}
async function verifiedSession(token?: string): Promise<{ id: string; actor: Actor } | null> {
  if (!token || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.[a-f0-9]{64}$/.test(token)) return null;
  const [id, provided] = token.split(".");
  const [session] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  if (!session || session.expiresAt.getTime() <= Date.now()) return null;
  const expected = signature(id, session.signingKey);
  if (!timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided, "hex"))) return null;
  const {asOf}=await readClock();
  const [actor] = await db.select().from(identities).where(and(eq(identities.id, session.actorId), lte(identities.activeFrom, asOf.slice(0, 10)))).limit(1);
  return actor ? { id, actor } : null;
}
export async function actorFromToken(token?: string) { return (await verifiedSession(token))?.actor ?? null; }
export async function currentActor() { return actorFromToken((await cookies()).get(SESSION_COOKIE)?.value); }
export async function requireActor() {
  const actor = await currentActor();
  if (!actor) throw new HttpError(401, "Choose a demo identity to continue.");
  return actor;
}
