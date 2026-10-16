import { parseReference } from './references';

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
export function recordLabel(key: string) {
  const labels: Record<string, string> = {
    duplicateImageGroups: 'Matching document copies', usedDocuments: 'Counted in the return',
    maximumUsedContributionsPerMatchingReport: 'Maximum times each report should be counted',
    originalEngineSummary: 'Original return amounts', rateBasedEstimates: 'Estimated effects of proposed changes',
    ftb_account: 'California tax account', irs_account: 'IRS account',
  };
  if (labels[key]) return labels[key];
  const label = key.replace(/([a-z\d])([A-Z])/gu, '$1 $2').replaceAll('_', ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}
export function referenceLabel(ref:string,fallback:string) {
  const parsed=parseReference(ref);
  if(parsed?.kind!=='pointer')return fallback;
  const root=parsed.root==='tax_agency_records'?'Agency record':parsed.root==='prior_years'?'Prior year':'Household';
  return [root,...parsed.tokens.map(recordLabel)].join(' · ');
}
