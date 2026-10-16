import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { engagements, packetAuxiliary, sourceValues } from '../db/schema';
import { HttpError } from '../auth/permissions';
import { createEvidenceRedactor } from '../evidence/privacy';
import type { EvidencePacket } from '../evidence/resolver';
import type { PacketValue } from '../packet/schema';

// Only immutable source material is cached. Authorization and overlay records
// are always queried afresh. No cross-user cache contains a serialized response.
const redactors = new Map<string, ReturnType<typeof createEvidenceRedactor>>();
export async function engagementRedactor(clientId:string,taxYear:number) {
  const [engagement] = await db.select().from(engagements).where(and(eq(engagements.clientId,clientId),eq(engagements.taxYear,taxYear))).limit(1);
  if (!engagement) throw new HttpError(404,'Engagement not found.');
  const cached = redactors.get(engagement.packetHash); if (cached) return cached;
  const [household,values] = await Promise.all([
    db.select().from(packetAuxiliary).where(and(eq(packetAuxiliary.packetHash,engagement.packetHash),eq(packetAuxiliary.section,'household'))).limit(1),
    db.select({record:sourceValues.record}).from(sourceValues).where(eq(sourceValues.packetHash,engagement.packetHash)),
  ]);
  const redact = createEvidenceRedactor({household:household[0].record as EvidencePacket['household'],extracted_values:values.map(v=>v.record as PacketValue)});
  redactors.set(engagement.packetHash,redact); return redact;
}
