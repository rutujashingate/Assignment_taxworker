import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { db } from "../db/client";
import { packetImports, engagements, sourceDocuments, sourceValues, engineVersions, engineLines, packetAuxiliary, identities, engagementAccess } from "../db/schema";
import { packetSchema, assertPacketCounts, PACKET_SHA256 } from "./schema";

export async function importPacket(path = "data/okafor_lindqvist_2025_packet.json") {
  const rawBytes = await readFile(path);
  const packetHash = createHash("sha256").update(rawBytes).digest("hex");
  if (packetHash !== PACKET_SHA256) throw new Error("Original packet SHA-256 mismatch; no rows imported");
  const rawJson: unknown = JSON.parse(rawBytes.toString("utf8"));
  const packet = packetSchema.parse(rawJson);
  assertPacketCounts(packet);
  return db.transaction(async tx => {
    const inserted = await tx.insert(packetImports).values({ packetHash, rawBytes, rawJson }).onConflictDoNothing().returning();
    if (!inserted.length) return { imported: false, packetHash };
    const clientId = packet.packet.client_id; const taxYear = packet.household.tax_year;
    await tx.insert(engagements).values({ clientId, taxYear, packetHash, name: "Okafor–Lindqvist" });
    await tx.insert(sourceDocuments).values(packet.documents.map(record => ({ packetHash, documentId: record.id, receivedAt: new Date(record.received_at), record })));
    // Chunk inserts to stay below PostgreSQL's parameter limit as packets grow.
    for (let offset=0; offset<packet.extracted_values.length; offset+=500) {
      await tx.insert(sourceValues).values(packet.extracted_values.slice(offset, offset+500).map(record => ({ packetHash, valueId: record.id, documentId: record.document_id, record })));
    }
    for (const version of packet.return_versions) {
      const { lines, ...record } = version;
      // Lines have their own immutable projection; full originals remain in raw_json.
      await tx.insert(engineVersions).values({ packetHash, version: version.version, computedAt: new Date(version.computed_at), record: { ...record, lines: [] } });
      await tx.insert(engineLines).values(lines.map(line => ({ packetHash, version: version.version, lineKey: line.key, record: line })));
    }
    const normalized = new Set(["documents", "extracted_values", "return_versions"]);
    await tx.insert(packetAuxiliary).values(Object.entries(packet).filter(([key]) => !normalized.has(key)).map(([section, record]) => ({ packetHash, section, record })));
    const seeded = [
      ...packet.firm.staff.map(actor => ({ id: actor.id, name: actor.name, role: actor.role, sensitiveDataClearance: actor.sensitive_data_clearance, activeFrom: actor.active_from })),
      ...packet.firm.client_users.map(actor => ({ id: actor.id, name: actor.name, role: actor.role, sensitiveDataClearance: false, activeFrom: "2026-01-12" })),
    ];
    await tx.insert(identities).values(seeded);
    await tx.insert(engagementAccess).values(seeded.map(actor => ({ actorId: actor.id, clientId, taxYear })));
    return { imported: true, packetHash };
  });
}
