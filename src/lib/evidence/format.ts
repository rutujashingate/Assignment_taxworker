export function displayValue(value: unknown, money = false): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return new Intl.NumberFormat("en-US", money ? { style: "currency", currency: "USD", minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 6 }).format(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}
export function lineValue(line: { value: unknown; label: string }) {
  const money = typeof line.value === "number" && !(Math.abs(line.value) > 0 && Math.abs(line.value) < 1) && !/\b(ratio|rate|days|miles|number of|count|age|years|percent)\b/iu.test(line.label);
  return displayValue(line.value, money);
}
export function evidenceHref(base: string, ref: string, line?: string) {
  return `${base}/return?${new URLSearchParams({ ...(line ? { line } : {}), ref })}#evidence-inspector`;
}
export function documentHref(base: string, documentId: string, page = 1, field?: string) {
  return `${base}/documents/${documentId}?${new URLSearchParams({ page: String(page), ...(field ? { field } : {}) })}`;
}
