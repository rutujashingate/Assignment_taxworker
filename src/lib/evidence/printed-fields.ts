import type { PacketValue } from "../packet/schema";

export type PrintedLocation = { status: "matched"; start: number; end: number; text: string } | { status: "unlocalized"; reason: string };
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

// Locate only literal text anchored to a known printed label. Synthetic positions
// and the extracted numeric value never supply replacement source text.
export function locatePrintedField(content: string, value: PacketValue): PrintedLocation {
  const absent: PrintedLocation = { status: "unlocalized", reason: "Precise printed span not established. Use page-level evidence." };
  if (typeof value.text_as_read !== "string" || !value.text_as_read || value.text_as_read.includes("[REDACTED")) return absent;
  const literal = value.text_as_read;
  const occurrences = [...content.matchAll(new RegExp(escape(literal), "gu"))];
  if (occurrences.length !== 1) return absent;
  const start = occurrences[0].index!; const end = start + literal.length;
  const before = content.slice(Math.max(0, start - 100), start);
  const box = /^(?:box|int_)(\d+[a-z]?)$/iu.exec(value.field);
  const dividend = /^div_(\d+[a-z]?)$/iu.exec(value.field);
  const anchors = box ? [new RegExp(`\\bbox\\s+${escape(box[1])}\\b`, "iu")]
    : dividend ? [new RegExp(`\\b${escape(dividend[1])}\\b`, "iu")]
    : [new RegExp(escape(value.field.replaceAll("_", " ")), "iu")];
  let labelStart = -1;
  for (const anchor of anchors) { const match = anchor.exec(before); if (match) labelStart = start - before.length + match.index; }
  if (labelStart < 0) return absent;
  // A different box/field or sentence between the label and value is ambiguous.
  const between = content.slice(labelStart, start);
  if (/[.;\n\d]/u.test(between.replace(anchors[0], ""))) return absent;
  return { status: "matched", start: labelStart, end, text: content.slice(labelStart, end) };
}

export function printedFields(content: string, values: PacketValue[]) {
  const located = values.map(value => ({ value, location: locatePrintedField(content, value) }));
  return located.filter(item => item.location.status === "matched" && !located.some(other => {
    if (other.value.id === item.value.id || other.location.status !== "matched" || item.location.status !== "matched") return false;
    return other.location.start < item.location.end && item.location.start < other.location.end;
  }));
}
