export const normalize = (text: string) => text.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/gu, " ").trim();
export const money = (value: string) => Number(value.replaceAll(",", ""));
export const sum = (values: number[]) => Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100;
export const reconcile = (observed: number, expected: number) => ({ observed, expected, difference: Math.round((observed - expected) * 100) / 100, agrees: Math.abs(observed - expected) < 0.005 });
export function groupBy<T>(values: T[], key: (value: T) => string | null) {
  const groups = new Map<string, T[]>();
  for (const value of values) { const id = key(value); if (id !== null) groups.set(id, [...(groups.get(id) ?? []), value]); }
  return [...groups.values()];
}
export function duplicatePages(pages: { page: number; printed_content: string }[]) {
  const records = [...pages].sort((a,b)=>a.page-b.page).map(page => {
    const total = /Page total\s+([\d,]+)\s+miles/iu.exec(page.printed_content);
    const firstTrip = page.printed_content.search(/\b\d{4}-\d{2}-\d{2}\b/u);
    return { page: page.page, total: total ? money(total[1]) : null,
      identity: total && firstTrip >= 0 ? normalize(page.printed_content.slice(firstTrip, total.index)) : null };
  });
  const groups = groupBy(records, row => row.identity);
  return { records, groups, duplicates: groups.filter(group => group.length > 1),
    reported: sum(records.map(row => row.total ?? 0)), unique: sum(groups.map(group => group[0].total ?? 0)) };
}
