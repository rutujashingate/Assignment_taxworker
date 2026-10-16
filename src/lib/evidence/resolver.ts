import type { Packet, PacketDocument, PacketLine, PacketPage, PacketValue, PacketVersion } from "../packet/schema";
import { DEFAULT_AS_OF } from "../packet/schema";
import { availableAgencyRecords, availableClientEvidence, isAvailable } from "../packet/availability";
import { pageReference, parseReference, readPointer } from "./references";

export type EvidencePacket = Pick<Packet, "documents" | "extracted_values" | "return_versions" | "client" | "household" | "prior_years" | "tax_agency_records" | "timeline" | "engine_reference" | "fx_rates">;
type Base = { status: "resolved"; ref: string; label: string; relatedRefs: string[] };
export type ResolvedEvidence = Base & (
  | { kind: "line"; line: PacketLine }
  | { kind: "extracted_value"; extraction: PacketValue }
  | { kind: "document"; document: PacketDocument }
  | { kind: "page"; documentId: string; page: PacketPage; missingExtraction: boolean }
  | { kind: "questionnaire" | "message" | "call" | "asset" | "household" | "timeline" | "version" | "computed" | "pointer" | "parameter" | "fx"; data: unknown }
);
export type EvidenceResolution = ResolvedEvidence | { status: "missing_source" | "invalid_reference"; ref: string; label: string; relatedRefs: string[] };
export type TraceNode = { resolution: EvidenceResolution; children: TraceNode[]; cycle: boolean; truncated: boolean };

function relatedSources(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(relatedSources);
  const object = value as Record<string, unknown>;
  const refs: string[] = [];
  for (const [key, child] of Object.entries(object)) {
    if (["sources", "refs", "documents"].includes(key)) {
      const candidates = Array.isArray(child) ? child : [child];
      refs.push(...candidates.filter((item): item is string => typeof item === "string"));
    } else if (["source", "source_document", "document"].includes(key) && typeof child === "string") refs.push(child);
    else if (child && typeof child === "object") refs.push(...relatedSources(child));
  }
  return [...new Set(refs)];
}

export function createEvidenceIndex(packet: EvidencePacket, selectedVersion = "v3", asOf = DEFAULT_AS_OF) {
  const documents = new Map(packet.documents.filter(doc => isAvailable(doc.received_at, asOf)).map(doc => [doc.id, doc]));
  const values = new Map(packet.extracted_values.filter(value => documents.has(value.document_id)).map(value => [value.id, value]));
  const versions = packet.return_versions.filter(version => isAvailable(version.computed_at, asOf));
  const version = versions.find(item => item.version === selectedVersion);
  if (!version) throw new Error("Computed version is unavailable at this workpaper date.");
  const lines = new Map(version.lines.map(line => [line.key, line]));
  const client = availableClientEvidence(packet.client, asOf);
  const agency = availableAgencyRecords(packet.tax_agency_records, new Map(packet.documents.map(doc => [doc.id, doc.received_at])), asOf);
  const timeline = packet.timeline.filter(event => typeof event.at === "string" && isAvailable(event.at, asOf));
  const pagesToValues = new Map<string, PacketValue[]>();
  for (const value of values.values()) {
    const ref = pageReference(value.document_id, value.page);
    pagesToValues.set(ref, [...(pagesToValues.get(ref) ?? []), value]);
  }
  const cache = new Map<string, EvidenceResolution>();
  const missing = (ref: string, invalid = false): EvidenceResolution => ({ status: invalid ? "invalid_reference" : "missing_source", ref, label: invalid ? "Invalid reference syntax" : "Source not found or unavailable at this workpaper date", relatedRefs: [] });
  function resolve(ref: string): EvidenceResolution {
    const previous = cache.get(ref); if (previous) return previous;
    const result = resolveUncached(ref); cache.set(ref, result); return result;
  }
  function resolveUncached(ref: string): EvidenceResolution {
    const reference = parseReference(ref);
    if (!reference) return missing(ref, true);
    const base = (label: string, relatedRefs: string[] = []): Base => ({ status: "resolved", ref, label, relatedRefs: [...new Set(relatedRefs)] });
    switch (reference.kind) {
      case "line": {
        const line = lines.get(reference.key);
        return line ? { ...base(line.label, [...line.inputs, ...line.sources]), kind: "line", line } : missing(ref);
      }
      case "extracted_value": {
        const extraction = values.get(reference.id);
        return extraction ? { ...base(typeof extraction.label === "string" ? extraction.label : extraction.field, [pageReference(extraction.document_id, extraction.page)]), kind: "extracted_value", extraction } : missing(ref);
      }
      case "document": {
        const document = documents.get(reference.id);
        return document ? { ...base(document.title), kind: "document", document } : missing(ref);
      }
      case "page": {
        const document = documents.get(reference.documentId);
        const page = document?.pages.find(item => item.page === reference.page);
        return page ? { ...base(`${reference.documentId} · page ${page.page}`, [reference.documentId]), kind: "page", documentId: reference.documentId, page, missingExtraction: !pagesToValues.get(ref)?.length } : missing(ref);
      }
      case "questionnaire": case "message": case "call": {
        const collection = reference.kind === "questionnaire" ? client.questionnaire : reference.kind === "message" ? client.messages : client.call_notes;
        const data = collection.find(item => item.id === reference.id);
        return data ? { ...base(String(data.question ?? data.id), relatedSources(data)), kind: reference.kind, data } : missing(ref);
      }
      case "pointer": {
        const target = readPointer(reference.root === "prior_years" ? packet.prior_years : reference.root === 'household' ? packet.household : agency, reference.tokens);
        if (!target.found || (reference.root === "tax_agency_records" && target.value === null)) return missing(ref);
        let refs = relatedSources(target.value);
        // The delivered prior-return schema stores evidence in a sibling line_sources map.
        const [section, property, key] = reference.tokens;
        if (reference.root === "prior_years" && property === "lines" && reference.tokens.length === 3) {
          const provenance = readPointer(packet.prior_years, [section, "line_sources", key]);
          if (provenance.found && typeof provenance.value === "string") refs = [...refs, provenance.value];
        }
        return { ...base(ref, refs), kind: "pointer", data: target.value };
      }
      case 'computed': {
        const record=versions.find(v=>v.version===reference.version);if(!record)return missing(ref);
        const target=readPointer(record,reference.tokens);
        return target.found?{...base(`${reference.version} · original computed record`,relatedSources(target.value)),kind:'computed',data:target.value}:missing(ref);
      }
      case "asset": {
        const prior = packet.prior_years.asset_records;
        const data = version!.assets.find(item => item.asset_id === reference.id) ?? (Array.isArray(prior) ? prior.find(item => item.asset_id === reference.id) : undefined);
        return data ? { ...base(String(data.description ?? reference.id), relatedSources(data)), kind: "asset", data } : missing(ref);
      }
      case "household": {
        const data = packet.household.people.find(person => person.id === reference.id);
        return data ? { ...base(String(data.name ?? reference.id)), kind: "household", data } : missing(ref);
      }
      case "parameter": {
        const parameters = packet.engine_reference.parameters;
        const result = readPointer(parameters, Object.hasOwn((parameters ?? {}) as object, reference.name) ? [reference.name] : reference.name.split("."));
        return result.found ? { ...base(reference.name), kind: "parameter", data: result.value } : missing(ref);
      }
      case "fx": {
        const result = readPointer(packet.engine_reference.parameters, ["fx", reference.currency, reference.rate]);
        return result.found ? { ...base(`${reference.currency} · ${reference.rate}`), kind: "fx", data: result.value } : missing(ref);
      }
      case "timeline": {
        const data = timeline.find(event => event.id === reference.id);
        return data ? { ...base(String(data.event), relatedSources(data)), kind: "timeline", data } : missing(ref);
      }
      case "version": {
        const data = versions.find(item => item.version === reference.id);
        return data ? { ...base(`${data.version} · ${data.computed_at}`), kind: "version", data: { version: data.version, computed_at: data.computed_at, trigger: data.trigger } } : missing(ref);
      }
      default: return missing(ref);
    }
  }
  const reverse = new Map<string, Set<string>>();
  const queue = [...lines.keys(), ...values.keys(), ...documents.keys(), ...[...documents.values()].flatMap(doc => doc.pages.map(page => pageReference(doc.id, page.page)))];
  const indexed = new Set<string>();
  for (let offset = 0; offset < queue.length; offset++) {
    const ref = queue[offset];
    if (indexed.has(ref)) continue;
    indexed.add(ref);
    for (const target of resolve(ref).relatedRefs) {
      if (!reverse.has(target)) reverse.set(target, new Set());
      reverse.get(target)!.add(ref);
      if (!indexed.has(target)) queue.push(target);
    }
  }
  function usage(ref: string) {
    const direct = new Set([...(reverse.get(ref) ?? [])].filter(parent => lines.has(parent)));
    const found = new Set<string>(); const visited = new Set([ref]); const parents = [ref];
    for (let i = 0; i < parents.length; i++) for (const parent of reverse.get(parents[i]) ?? []) {
      if (visited.has(parent)) continue;
      visited.add(parent); parents.push(parent); if (lines.has(parent)) found.add(parent);
    }
    return [...found].map(key => ({ line: lines.get(key)!, direct: direct.has(key) }));
  }
  function trace(ref: string, maxNodes = 160, maxDepth = 12): TraceNode {
    let remaining = Math.max(1, maxNodes);
    function visit(key: string, ancestors: Set<string>, depth: number): TraceNode {
      remaining--;
      const resolution = resolve(key); const cycle = ancestors.has(key);
      const truncated = !cycle && resolution.relatedRefs.length > 0 && (remaining <= 0 || depth >= maxDepth);
      const children: TraceNode[] = [];
      if (!cycle && !truncated) {
        const next = new Set(ancestors).add(key);
        for (const child of resolution.relatedRefs) {
          if (remaining <= 0) break;
          children.push(visit(child, next, depth + 1));
        }
      }
      return { resolution, children, cycle, truncated: truncated || (!cycle && children.length < resolution.relatedRefs.length) };
    }
    return visit(ref, new Set(), 0);
  }
  return { version: version as PacketVersion, documents, values, lines, resolve, trace, usage,
    pageValues: (documentId: string, page: number) => pagesToValues.get(pageReference(documentId, page)) ?? [] };
}
export type EvidenceIndex = ReturnType<typeof createEvidenceIndex>;
