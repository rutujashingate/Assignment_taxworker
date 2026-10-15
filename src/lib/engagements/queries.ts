import "server-only";
import { and, eq, lte, count, sql } from "drizzle-orm";
import { db } from "../db/client";
import { engagements, engagementAccess, engineVersions, sourceDocuments, sourceValues, engineLines, packetImports, type Actor } from "../db/schema";
import { assertActive, assertStaff, authorizeEngagement, HttpError } from "../auth/permissions";
import { DEFAULT_AS_OF } from "../packet/schema";

export async function getEngagement(actor: Actor, clientId: string, taxYear: number) {
  await authorizeEngagement(actor, clientId, taxYear);
  const [engagement] = await db.select().from(engagements).where(and(eq(engagements.clientId, clientId), eq(engagements.taxYear, taxYear))).limit(1);
  if (!engagement) throw new HttpError(404, "Engagement not found.");
  // Deliberate allow-list: no raw packet, identities, source fields, or notes.
  return { clientId: engagement.clientId, taxYear: engagement.taxYear, name: engagement.name,
    jurisdictions: ["Federal", "California"], computedVersion: "v3", readiness: "Review not evaluated" };
}
export async function searchEngagements(actor: Actor, query = "") {
  assertStaff(actor); assertActive(actor);
  const rows = await db.select({ clientId: engagements.clientId, taxYear: engagements.taxYear, name: engagements.name })
    .from(engagements).innerJoin(engagementAccess, and(eq(engagementAccess.clientId, engagements.clientId), eq(engagementAccess.taxYear, engagements.taxYear)))
    .where(eq(engagementAccess.actorId, actor.id));
  const normalize = (text: string) => text.normalize("NFKD").toLowerCase().replace(/[–—-]/g, " ").replace(/\s+/g, " ").trim();
  const q = normalize(query);
  const matched = rows.filter(row => normalize(`${row.name} ${row.clientId} ${row.taxYear}`).includes(q));
  return Promise.all(matched.map(row => getEngagement(actor, row.clientId, row.taxYear)));
}
export async function engagementStatistics(actor: Actor, clientId: string, taxYear: number, version: string) {
  assertStaff(actor); await authorizeEngagement(actor, clientId, taxYear);
  const [engagement] = await db.select().from(engagements).where(and(eq(engagements.clientId, clientId), eq(engagements.taxYear, taxYear))).limit(1);
  if (!engagement) throw new HttpError(404, "Engagement not found.");
  const hash = engagement.packetHash;
  const [documents, lines, versions] = await Promise.all([
    db.select({ count: count() }).from(sourceDocuments).where(and(eq(sourceDocuments.packetHash, hash), lte(sourceDocuments.receivedAt, new Date(DEFAULT_AS_OF)))),
    db.select({ count: count() }).from(engineLines).where(and(eq(engineLines.packetHash, hash), eq(engineLines.version, version))),
    db.select({ version: engineVersions.version, computedAt: engineVersions.computedAt }).from(engineVersions).where(and(eq(engineVersions.packetHash, hash), lte(engineVersions.computedAt, new Date(DEFAULT_AS_OF)))).orderBy(engineVersions.version),
  ]);
  return { documentCount: documents[0].count, lineCount: lines[0].count, versions: versions.map(x => ({ version: x.version, computedAt: x.computedAt.toISOString() })) };
}

export async function getImportStatus(actor: Actor, clientId: string, taxYear: number) {
  assertStaff(actor); await authorizeEngagement(actor, clientId, taxYear);
  const [engagement] = await db.select({ packetHash: engagements.packetHash }).from(engagements)
    .where(and(eq(engagements.clientId, clientId), eq(engagements.taxYear, taxYear))).limit(1);
  if (!engagement) throw new HttpError(404, "Engagement not found.");
  const hash = engagement.packetHash;
  // Staff-only import metadata. Neither original bytes nor source fields leave the server.
  const [imports, documents, values, versions] = await Promise.all([
    db.select({ importedAt: packetImports.importedAt, byteLength: sql<number>`octet_length(${packetImports.rawBytes})` }).from(packetImports).where(eq(packetImports.packetHash, hash)),
    db.select({ count: count(), pages: sql<number>`coalesce(sum(jsonb_array_length(${sourceDocuments.record}->'pages')), 0)`.mapWith(Number) }).from(sourceDocuments).where(eq(sourceDocuments.packetHash, hash)),
    db.select({ count: count() }).from(sourceValues).where(eq(sourceValues.packetHash, hash)),
    db.select({ version: engineVersions.version, computedAt: engineVersions.computedAt }).from(engineVersions)
      .where(and(eq(engineVersions.packetHash, hash), lte(engineVersions.computedAt, new Date(DEFAULT_AS_OF)))).orderBy(engineVersions.version),
  ]);
  if (!imports[0]) throw new HttpError(404, "Packet import not found.");
  return { packetHash: hash, importedAt: imports[0].importedAt.toISOString(), byteLength: imports[0].byteLength,
    documentCount: documents[0].count, pageCount: documents[0].pages, extractedValueCount: values[0].count,
    versions: versions.map(version => ({ version: version.version, computedAt: version.computedAt.toISOString() })) };
}
