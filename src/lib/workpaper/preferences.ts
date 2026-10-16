import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import { auditEvents, engineVersions, engagements, preferences, type Actor } from "../db/schema";
import { assertStaff, authorizeEngagement, HttpError } from "../auth/permissions";
import { readClock } from "../season/clock";
import { isAvailable } from "../packet/availability";

export const preferenceCommand = z.strictObject({ selectedVersion: z.enum(["v1", "v2", "v3"]), expectedRevision: z.number().int().min(0) });
export async function getPreferences(actor: Actor, clientId: string, taxYear: number) {
  assertStaff(actor); await authorizeEngagement(actor, clientId, taxYear);
  const [row] = await db.select().from(preferences).where(and(eq(preferences.actorId, actor.id), eq(preferences.clientId, clientId), eq(preferences.taxYear, taxYear))).limit(1);
  const {asOf}=await readClock(clientId,taxYear);
  const available=await db.select({version:engineVersions.version,computedAt:engineVersions.computedAt}).from(engineVersions).innerJoin(engagements,eq(engagements.packetHash,engineVersions.packetHash)).where(and(eq(engagements.clientId,clientId),eq(engagements.taxYear,taxYear)));
  const versions=available.filter(v=>isAvailable(v.computedAt.toISOString(),asOf)).sort((a,b)=>a.version.localeCompare(b.version));

  const selectedVersion=versions.some(v=>v.version===row?.selectedVersion)?row!.selectedVersion:versions.at(-1)?.version??"none";
  return {selectedVersion,revision:row?.revision??0};
}
export async function updatePreferences(actor: Actor, clientId: string, taxYear: number, input: unknown) {
  assertStaff(actor); await authorizeEngagement(actor, clientId, taxYear);
  const parsed = preferenceCommand.safeParse(input);
  if (!parsed.success) throw new HttpError(400, "Choose v1, v2, or v3 and supply a non-negative revision.");
  const { selectedVersion, expectedRevision } = parsed.data;
  const {asOf}=await readClock(clientId,taxYear);
  return db.transaction(async tx => {
    // Serializes first insert as well as subsequent edits for this user's preference.
    const scope = `${actor.id}:${clientId}:${taxYear}`;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${scope}, 0))`);
    const [existing] = await tx.select().from(preferences).where(and(eq(preferences.actorId, actor.id), eq(preferences.clientId, clientId), eq(preferences.taxYear, taxYear))).limit(1);
    const before = { selectedVersion: existing?.selectedVersion ?? "v3", revision: existing?.revision ?? 0 };
    if (expectedRevision !== before.revision) throw new HttpError(409, "Your view changed in another window. Reload before saving again.", before);
    const [available] = await tx.select({ computedAt: engineVersions.computedAt }).from(engineVersions)
      .innerJoin(engagements, eq(engagements.packetHash, engineVersions.packetHash))
      .where(and(eq(engagements.clientId, clientId), eq(engagements.taxYear, taxYear), eq(engineVersions.version, selectedVersion))).limit(1);
    if (!available || !isAvailable(available.computedAt.toISOString(), asOf)) throw new HttpError(400, "Computed version is not available at this workpaper date.");
    const after = { selectedVersion, revision: before.revision + 1 };
    await tx.insert(preferences).values({ actorId: actor.id, clientId, taxYear, ...after }).onConflictDoUpdate({
      target: [preferences.actorId, preferences.clientId, preferences.taxYear], set: { ...after, updatedAt: new Date() },
    });
    await tx.insert(auditEvents).values({ actorId: actor.id, clientId, taxYear, action: "computed_version_preference_changed", target: "workpaper_preference", beforeJson: before, afterJson: after });
    return after;
  });
}
