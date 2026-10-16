export type Reference =
  | { kind: "line"; key: string }
  | { kind: "extracted_value"; id: string }
  | { kind: "document"; id: string }
  | { kind: "page"; documentId: string; page: number }
  | { kind: "questionnaire" | "message" | "call" | "asset" | "household" | "timeline" | "version"; id: string }
  | { kind: "pointer"; root: "prior_years" | "tax_agency_records" | "household"; tokens: string[] }
  | { kind: "computed"; version: string; tokens: string[] }
  | { kind: "parameter"; name: string }
  | { kind: "fx"; currency: string; rate: string }
  | { kind: "unknown"; label: string };

export function pointerTokens(pointer: string): string[] | null {
  if (pointer === "") return [];
  if (!pointer.startsWith("/") || /~(?![01])/u.test(pointer)) return null;
  return pointer.slice(1).split("/").map(token => token.replaceAll("~1", "/").replaceAll("~0", "~"));
}

export function readPointer(root: unknown, tokens: string[]): { found: boolean; value?: unknown } {
  let value = root;
  for (const token of tokens) {
    if (value === null || typeof value !== "object" || !Object.hasOwn(value, token)) return { found: false };
    if (Array.isArray(value) && !/^(0|[1-9]\d*)$/u.test(token)) return { found: false };
    value = (value as Record<string, unknown>)[token];
  }
  return { found: true, value };
}

export function parseReference(ref: string): Reference | null {
  if (!ref || ref.length > 500 || ref.trim() !== ref) return null;
  if (/^ev-\d{4}$/u.test(ref)) return { kind: "extracted_value", id: ref };
  if (/^D\d{2}$/u.test(ref)) return { kind: "document", id: ref };
  const page = /^doc:(D\d{2})#page([1-9]\d*)$/u.exec(ref);
  if (page) return Number.isSafeInteger(Number(page[2])) ? { kind: "page", documentId: page[1], page: Number(page[2]) } : null;
  if (ref.startsWith("doc:")) return null;
  for (const [prefix, kind] of [["qa", "questionnaire"], ["msg", "message"], ["call", "call"]] as const) {
    if (new RegExp(`^${prefix}-\\d{2}$`, "u").test(ref)) return { kind, id: ref };
  }
  const computed = /^computed:(v[123]):(.*)$/u.exec(ref);
  if(computed){const tokens=pointerTokens(computed[2]);return tokens&&['summary','assets','carryovers_out','tax_effect_rates'].includes(tokens[0])?{kind:'computed',version:computed[1],tokens}:null;}
  if(ref.startsWith('computed:'))return null;
  if(ref.startsWith('household:/')) {const tokens=pointerTokens(ref.slice(10));return tokens?{kind:'pointer',root:'household',tokens}:null;}
  for (const [prefix, root] of [["py:", "prior_years"], ["agency:", "tax_agency_records"]] as const) {
    if (ref.startsWith(prefix)) { const tokens = pointerTokens(ref.slice(prefix.length)); return tokens ? { kind: "pointer", root, tokens } : null; }
  }
  for (const kind of ["asset", "household", "timeline"] as const) {
    if (ref.startsWith(`${kind}:`)) return ref.length > kind.length + 1 ? { kind, id: ref.slice(kind.length + 1) } : null;
  }
  if (ref.startsWith("ref:param.")) return ref.length > 10 ? { kind: "parameter", name: ref.slice(10) } : null;
  const fx = /^ref:fx\.([A-Z]{3})\.([A-Za-z0-9_]+)$/u.exec(ref);
  if (fx) return { kind: "fx", currency: fx[1], rate: fx[2] };
  if (/^v[123]$/u.test(ref)) return { kind: "version", id: ref };
  if (/^[A-Za-z][A-Za-z0-9_-]*\.[A-Za-z0-9_.-]+$/u.test(ref)) return { kind: "line", key: ref };
  return { kind: "unknown", label: ref };
}

export const pageReference = (documentId: string, page: number) => `doc:${documentId}#page${page}`;
