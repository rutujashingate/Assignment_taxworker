import "server-only";
import { and, eq, inArray, lte } from "drizzle-orm";
import { db } from "../db/client";
import { auditEvents, engagements, engineLines, engineVersions, packetAuxiliary, sourceDocuments, sourceValues, type Actor } from "../db/schema";
import { assertStaff, authorizeEngagement, HttpError } from "../auth/permissions";
import { getPreferences } from "../workpaper/preferences";
import { DEFAULT_AS_OF, type PacketLine, type PacketValue } from "../packet/schema";
import { createEvidenceIndex, type EvidencePacket, type EvidenceIndex, type EvidenceResolution, type TraceNode } from "./resolver";
import { isSensitiveValue, maskEvidence } from "./privacy";
import { pageReference } from "./references";

export async function getEvidenceWorkspace(actor: Actor, clientId: string, taxYear: number) {
  assertStaff(actor); await authorizeEngagement(actor, clientId, taxYear);
  const [engagement] = await db.select().from(engagements).where(and(eq(engagements.clientId, clientId), eq(engagements.taxYear, taxYear))).limit(1);
  if (!engagement) throw new HttpError(404, "Engagement not found.");
  const preference = await getPreferences(actor, clientId, taxYear);
  const hash = engagement.packetHash;
  const sections = ["household", "client", "prior_years", "tax_agency_records", "timeline", "engine_reference", "fx_rates"] as const;
  const [documentRows, valueRows, versionRows, lineRows, auxiliary] = await Promise.all([
    db.select({ record: sourceDocuments.record }).from(sourceDocuments).where(eq(sourceDocuments.packetHash, hash)),
    db.select({ record: sourceValues.record }).from(sourceValues).where(eq(sourceValues.packetHash, hash)),
    db.select({ record: engineVersions.record }).from(engineVersions).where(and(eq(engineVersions.packetHash, hash), lte(engineVersions.computedAt, new Date(DEFAULT_AS_OF)))),
    db.select({ record: engineLines.record }).from(engineLines).where(and(eq(engineLines.packetHash, hash), eq(engineLines.version, preference.selectedVersion))).orderBy(engineLines.lineKey),
    db.select({ section: packetAuxiliary.section, record: packetAuxiliary.record }).from(packetAuxiliary).where(and(eq(packetAuxiliary.packetHash, hash), inArray(packetAuxiliary.section, [...sections]))),
  ]);
  if (!versionRows.some(row => row.record.version === preference.selectedVersion)) throw new HttpError(404, "Computed version not available.");
  // These read-only projections were validated by the exact-byte importer.
  const aux = new Map(auxiliary.map(row => [row.section, row.record]));
  function section<K extends typeof sections[number]>(key: K): EvidencePacket[K] {
    if (!aux.has(key)) throw new HttpError(500, "Imported source section is missing.");
    return aux.get(key) as EvidencePacket[K];
  }
  const packet: EvidencePacket = {
    documents: documentRows.map(row => row.record), extracted_values: valueRows.map(row => row.record as PacketValue),
    return_versions: versionRows.map(row => ({ ...row.record, lines: row.record.version === preference.selectedVersion ? lineRows.map(line => line.record as PacketLine) : [] })),
    household: section("household"), client: section("client"), prior_years: section("prior_years"),
    tax_agency_records: section("tax_agency_records"), timeline: section("timeline"), engine_reference: section("engine_reference"), fx_rates: section("fx_rates"),
  };
  const index = createEvidenceIndex(actor.sensitiveDataClearance ? packet : maskEvidence(packet), preference.selectedVersion);
  const inventory = { total: packet.documents.length, extracted: 0, partial: 0, not_extracted: 0 };
  for (const doc of packet.documents) inventory[doc.extraction.status]++;
  return { index, inventory, masked: !actor.sensitiveDataClearance, actor, clientId, taxYear,
    rules: packet.engine_reference.rules as Record<string, string> };
}
export type EvidenceWorkspace = Awaited<ReturnType<typeof getEvidenceWorkspace>>;

export async function recordEvidenceView(workspace: EvidenceWorkspace, ref: string) {
  // Authorize at the operation boundary too. Do not serve source content if the
  // append-only view log cannot be written. No source values are copied to audit.
  assertStaff(workspace.actor); await authorizeEngagement(workspace.actor, workspace.clientId, workspace.taxYear);
  await db.insert(auditEvents).values({ actorId: workspace.actor.id, clientId: workspace.clientId, taxYear: workspace.taxYear,
    action: "evidence_viewed", target: ref, beforeJson: null,
    afterJson: { reference: ref, version: workspace.index.version.version, asOf: DEFAULT_AS_OF, sensitiveIdentifiersMasked: workspace.masked } });
  const resolved = workspace.index.resolve(ref);
  const documentId = resolved.status !== 'resolved' ? null : resolved.kind === 'document' ? resolved.document.id : resolved.kind === 'page' ? resolved.documentId : resolved.kind === 'extracted_value' ? resolved.extraction.document_id : null;
  if (documentId && [...workspace.index.values.values()].some(value => value.document_id === documentId && isSensitiveValue(value))) {
    await db.insert(auditEvents).values({actorId:workspace.actor.id,clientId:workspace.clientId,taxYear:workspace.taxYear,
      action:'sensitive_document_viewed',target:documentId,beforeJson:null,afterJson:{reference:ref,masked:workspace.masked,version:workspace.index.version.version}});
  }
}

export async function revealSensitiveValue(actor: Actor, clientId: string, taxYear: number, ref: string) {
  assertStaff(actor); await authorizeEngagement(actor,clientId,taxYear);
  if (!actor.sensitiveDataClearance) throw new HttpError(403,'Sensitive-data clearance is required.');
  const workspace=await getEvidenceWorkspace(actor,clientId,taxYear);
  const resolved=workspace.index.resolve(ref);
  if(resolved.status!=='resolved'||resolved.kind!=='extracted_value'||!isSensitiveValue(resolved.extraction)) throw new HttpError(404,'Sensitive field not found.');
  await db.insert(auditEvents).values({actorId:actor.id,clientId,taxYear,action:'sensitive_value_revealed',target:ref,beforeJson:null,
    afterJson:{reference:ref,documentId:resolved.extraction.document_id,version:workspace.index.version.version}});
  return {ref,label:resolved.extraction.label??resolved.extraction.field,value:resolved.extraction.value,textAsRead:resolved.extraction.text_as_read};
}

export function documentView(index: EvidenceIndex, documentId: string, pageNumber = 1) {
  const document = index.documents.get(documentId);
  const page = document?.pages.find(item => item.page === pageNumber);
  if (!document || !page) throw new HttpError(404, "Document page not found or unavailable at this workpaper date.");
  return { id: document.id, title: document.title, type: document.document_type, issuer: document.issuer,
    taxYear: document.tax_year, receivedAt: document.received_at, extraction: document.extraction,
    pageNumbers: document.pages.map(item => item.page), page, values: index.pageValues(documentId, pageNumber),
    superseded: index.version.documents_superseded.includes(documentId) };
}
export type DocumentView = ReturnType<typeof documentView>;

export function evidenceSummary(resolution: EvidenceResolution) {
  return { ref: resolution.ref, status: resolution.status, label: resolution.label, relatedRefs: resolution.relatedRefs,
    kind: resolution.status === "resolved" ? resolution.kind : null,
    valueType: resolution.status === "resolved" && resolution.kind === "extracted_value" ? resolution.extraction.value_type : null,
    value: resolution.status === "resolved" ? resolution.kind === "line" ? resolution.line.value
      : resolution.kind === "extracted_value" ? resolution.extraction.value : null : null };
}
export type EvidenceSummary = ReturnType<typeof evidenceSummary>;
export type DisplayTrace = { node: EvidenceSummary; children: DisplayTrace[]; cycle: boolean; truncated: boolean };
function displayTrace(trace: TraceNode): DisplayTrace {
  return { node: evidenceSummary(trace.resolution), children: trace.children.map(displayTrace), cycle: trace.cycle, truncated: trace.truncated };
}
export function inspectEvidence(workspace: EvidenceWorkspace, ref: string) {
  const { index } = workspace;
  const resolved = index.resolve(ref);
  const result = { node: evidenceSummary(resolved), trace: displayTrace(index.trace(ref)),
    usage: index.usage(ref).map(({ line, direct }) => ({ key: line.key, label: line.label, value: line.value, direct })),
    source: undefined as DocumentView | undefined,
    extraction: resolved.status === "resolved" && resolved.kind === "extracted_value" ? resolved.extraction : undefined,
    line: resolved.status === "resolved" && resolved.kind === "line" ? { ...resolved.line, ruleDescription: workspace.rules[resolved.line.rule] ?? "Rule description unavailable." } : undefined,
    record: resolved.status === "resolved" && "data" in resolved ? resolved.data : undefined };
  if (resolved.status === "resolved") {
    if (resolved.kind === "extracted_value") result.source = documentView(index, resolved.extraction.document_id, resolved.extraction.page);
    else if (resolved.kind === "page") result.source = documentView(index, resolved.documentId, resolved.page.page);
    else if (resolved.kind === "document") result.source = documentView(index, resolved.document.id, resolved.document.pages[0]?.page);
  }
  return result;
}
export type EvidenceInspection = ReturnType<typeof inspectEvidence>;

export function documentIndex(workspace: EvidenceWorkspace, query = "", state = "all") {
  const documents = [...workspace.index.documents.values()];
  const q = query.normalize("NFKC").toLowerCase().trim();
  const rows = documents.filter(doc => (state === "all" || doc.extraction.status === state) &&
    `${doc.id} ${doc.title} ${doc.issuer} ${doc.document_type} ${doc.tax_year}`.normalize("NFKC").toLowerCase().includes(q));
  return { total: workspace.inventory, available: documents.length, withheld: workspace.inventory.total - documents.length,
    states: documents.reduce((counts, doc) => { counts[doc.extraction.status]++; return counts; }, { extracted: 0, partial: 0, not_extracted: 0 }),
    rows: rows.map(doc => ({ id: doc.id, title: doc.title, type: doc.document_type, issuer: doc.issuer, taxYear: doc.tax_year,
      pages: doc.pages.length, status: doc.extraction.status, values: doc.extraction.values, reason: doc.extraction.reason,
      superseded: workspace.index.version.documents_superseded.includes(doc.id), firstPageRef: pageReference(doc.id, doc.pages[0]?.page ?? 1) })) };
}
