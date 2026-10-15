import { z } from "zod";

export const PACKET_SHA256 = "ee01f8508bd2fd9854754b82fd9c4a055bdc55e2778a132002a25381c412ad19";
export const DEFAULT_AS_OF = "2026-06-23T06:05:00Z";
const record = z.record(z.string(), z.unknown());
const documentSchema = z.object({
  id: z.string(), title: z.string(), document_type: z.string(), issuer: z.string(),
  belongs_to: z.string(), tax_year: z.number().int(), received_at: z.string(),
  uploaded_by: z.string(), file_name: z.string(), page_count: z.number().int(),
  pages: z.array(z.object({ page: z.number().int(), printed_content: z.string() })),
  extraction: z.object({ status: z.enum(["extracted", "partial", "not_extracted"]), values: z.number().int() }).passthrough(),
}).passthrough();
const lineSchema = z.object({
  key: z.string(), jurisdiction: z.string(), form: z.string(), line: z.string(), label: z.string(),
  value: z.unknown(), rule: z.string(), inputs: z.array(z.string()), sources: z.array(z.string()),
}).passthrough();
const versionSchema = z.object({
  version: z.enum(["v1", "v2", "v3"]), computed_at: z.string(), trigger: z.string(),
  documents_used: z.array(z.string()), documents_superseded: z.array(z.string()),
  summary: record, tax_effect_rates: record, carryovers_out: record,
  assets: z.array(record), diagnostics: z.array(record), changes_from_previous: z.array(record), lines: z.array(lineSchema),
}).passthrough();
const staffSchema = z.object({
  id: z.string(), name: z.string(),
  role: z.enum(["preparer", "reviewer", "partner", "firm_administrator", "quality_reviewer"]),
  sensitive_data_clearance: z.boolean(), active_from: z.string(),
}).passthrough();
export const packetSchema = z.object({
  packet: z.object({ client_id: z.literal("CL-20417"), name: z.string(), version: z.string(), generated: z.string() }),
  readme: record,
  household: z.object({ tax_year: z.literal(2025), filing_status: z.string(), people: z.array(record) }).passthrough(),
  documents: z.array(documentSchema),
  extracted_values: z.array(z.object({ id: z.string(), document_id: z.string(), page: z.number().int(), field: z.string(), value: z.unknown(), confidence: z.number().min(0).max(1) }).passthrough()),
  client: z.object({ questionnaire: z.array(record), messages: z.array(record), call_notes: z.array(record) }),
  firm: z.object({
    staff: z.array(staffSchema),
    client_users: z.array(z.object({ id: z.string(), name: z.string(), role: z.literal("client") })),
  }).passthrough(),
  prior_years: record, tax_agency_records: record, timeline: z.array(record),
  engine_reference: record, return_versions: z.array(versionSchema),
  what_if: z.object({ alternatives: z.array(record), extension: record }),
  planning_reference_2026: record, post_filing_rates: record, fx_rates: record,
}).passthrough();
export type Packet = z.infer<typeof packetSchema>;
export type PacketDocument = z.infer<typeof documentSchema>;
export type PacketVersion = z.infer<typeof versionSchema>;

export function assertPacketCounts(packet: Packet) {
  const counts = packet.documents.reduce<Record<string, number>>((a, d) => {
    a[d.extraction.status] = (a[d.extraction.status] ?? 0) + 1; return a;
  }, {});
  if (packet.documents.length !== 74 || packet.documents.reduce((a,d) => a+d.pages.length, 0) !== 199 ||
      packet.extracted_values.length !== 3012 || counts.extracted !== 68 || counts.partial !== 2 || counts.not_extracted !== 4 ||
      packet.return_versions.map(v => v.lines.length).join(",") !== "625,625,627" ||
      packet.timeline.length !== 29 || packet.what_if.alternatives.length !== 5 ||
      packet.firm.staff.length !== 6 || packet.firm.client_users.length !== 2) {
    throw new Error("Packet inventory does not match the validated source");
  }
}
