import type { EvidencePacket } from "./resolver";

const sensitiveKey = /ssn|ip[_ ]?pin|account[_ ]?number|^account$|routing|^dob$|date[_ ]?of[_ ]?birth/iu;
export const isSensitiveValue = (value: { field: string; value_type?: unknown }) => value.value_type === "ssn" || value.value_type === "account_number" || sensitiveKey.test(value.field);

export function createEvidenceRedactor(packet: Pick<EvidencePacket, 'household'|'extracted_values'>) {
  const secrets = new Set<string>();
  const add = (value: unknown) => { if ((typeof value === "string" || typeof value === "number") && String(value).length >= 4) secrets.add(String(value)); };
  function gather(value: unknown) {
    if (Array.isArray(value)) { value.forEach(gather); return; }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (sensitiveKey.test(key)) add(child);
      else if (child && typeof child === "object") gather(child);
    }
  }
  gather(packet.household);
  for (const value of packet.extracted_values) if (isSensitiveValue(value)) { add(value.value); add(value.text_as_read); }
  const tokens = [...secrets].sort((a, b) => b.length - a.length);
  function redact(value: unknown): unknown {
    if (typeof value === "string") {
      let text = value.replace(/\b\d{3}-\d{2}-\d{4}\b/gu, "[REDACTED SSN]")
        .replace(/(\b(?:IP[ _-]?PIN|routing|account(?: number)?)\s*[:#]?\s*)[\d -]{6,}/giu, '$1[REDACTED]');
      for (const token of tokens) text = text.replaceAll(token, "[REDACTED]");
      return text;
    }
    if (Array.isArray(value)) return value.map(redact);
    if (value && typeof value === "object") {
      const object = value as Record<string, unknown>;
      const extracted = typeof object.field === "string" && isSensitiveValue({ field: object.field, value_type: object.value_type });
      return Object.fromEntries(Object.entries(object).map(([key, child]) => [key,
        sensitiveKey.test(key) || (extracted && ["value", "text_as_read"].includes(key)) ? "[REDACTED]" : redact(child)]));
    }
    return value;
  }
  return <T>(value: T): T => redact(value) as T;
}

export function maskEvidence(packet: EvidencePacket): EvidencePacket { return createEvidenceRedactor(packet)(packet); }
