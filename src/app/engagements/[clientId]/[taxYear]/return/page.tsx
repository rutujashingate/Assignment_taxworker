import { SourceDateUnavailable } from "@/components/source-date-unavailable";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth/session";
import { optionalEvidenceWorkspace as getEvidenceWorkspace, inspectEvidence, recordEvidenceView } from "@/lib/evidence/queries";
import { evidenceHref, lineValue } from "@/lib/evidence/format";
import { EvidenceInspector } from "@/components/evidence-inspector";
import { StagePlaceholder } from "@/components/stage-placeholder";

export default async function Return({ params, searchParams }: {
  params: Promise<{ clientId: string; taxYear: string }>;
  searchParams: Promise<{ q?: string; form?: string; line?: string; ref?: string; page?: string }>;
}) {
  const actor = await currentActor(); if (!actor) redirect("/firm");
  if (actor.role === "client") return <StagePlaceholder title="Tax Return" phase={2} description="Return review is available to staff."/>;
  const [{ clientId, taxYear }, search] = await Promise.all([params, searchParams]);
  const workspace = await getEvidenceWorkspace(actor, clientId, Number(taxYear));
  if(!workspace)return <SourceDateUnavailable/>;
  const base = `/engagements/${clientId}/${taxYear}`;
  const q = typeof search.q === "string" ? search.q.slice(0,200) : "";
  const form = typeof search.form === "string" ? search.form : "all";
  const selectedLine = typeof search.line === "string" ? search.line : "F1040.2b";
  const ref = typeof search.ref === "string" ? search.ref.slice(0,500) : selectedLine;
  const inspection = inspectEvidence(workspace, ref);
  await recordEvidenceView(workspace, ref);
  const lines = [...workspace.index.lines.values()];
  const forms = [...new Set(lines.map(line => line.form))].sort();
  const filtered = lines.filter(line => (form === "all" || line.form === form) && `${line.key} ${line.label} ${String(line.value)} ${lineValue(line)}`.toLowerCase().includes(q.toLowerCase().trim()));
  const pageCount = Math.max(1, Math.ceil(filtered.length/50));
  const page = Math.min(pageCount, Math.max(1, Number(search.page) || 1));
  const visible = filtered.slice((page-1)*50, page*50);
  const pageHref = (number: number) => `${base}/return?${new URLSearchParams({ q, form, line: selectedLine, ref, page: String(number) })}`;
  return <>
    <div className="section-heading page-section-heading"><div><span className="eyebrow">ORIGINAL RETURN · {workspace.index.version.version}</span><h2>Tax Return</h2><p>Select an amount to see how it was built and open its supporting records.</p></div><span className="count-tag">{lines.length} lines</span></div>
    <div className="evidence-workspace">
      <section className="panel return-lines" aria-label="Computed return lines">
        <form className="return-search" action={`${base}/return`}><label htmlFor="line-search">Find a line or amount</label><input id="line-search" name="q" type="search" defaultValue={q} maxLength={200} placeholder="F1040.2b, interest, 6450…"/><label htmlFor="form-filter">Form</label><select id="form-filter" name="form" defaultValue={form}><option value="all">All forms</option>{forms.map(name => <option key={name}>{name}</option>)}</select><button className="button secondary" type="submit">Find lines</button></form>
        <div className="return-result-label">{filtered.length} matching lines · original values</div>
        {visible.length ? <div className="table-scroll"><table className="return-table"><thead><tr><th>LINE / DESCRIPTION</th><th>VALUE</th></tr></thead><tbody>{visible.map(line => <tr key={line.key} className={selectedLine === line.key ? "selected-line" : undefined}><td><Link prefetch={false} href={evidenceHref(base, line.key, line.key)} aria-label={`Inspect line ${line.key}`}><code>{line.key}</code><span className="line-description">{line.label}</span><small>{line.jurisdiction}</small></Link></td><td><Link prefetch={false} className="text-button amount-link" href={evidenceHref(base,line.key,line.key)} aria-label={`Trace amount for ${line.key}`} title="See calculation and source evidence">{lineValue(line)} <span aria-hidden="true">↗</span></Link></td></tr>)}</tbody></table></div> : <p className="search-empty">No return lines match. Try another form, line key, label or amount.</p>}
        <nav className="pagination" aria-label="Return line pages">{page > 1 && <Link prefetch={false} href={pageHref(page-1)}>← Previous</Link>}<span>Page {page} of {pageCount}</span>{page < pageCount && <Link prefetch={false} href={pageHref(page+1)}>Next →</Link>}</nav>
        <details className="reference-lookup-tools"><summary>Open a reference by ID</summary><form className="reference-lookup" action={`${base}/return`}><input name="line" type="hidden" value={selectedLine}/><label htmlFor="evidence-reference">Open an evidence reference</label><input id="evidence-reference" name="ref" maxLength={500} placeholder="ev-0538, qa-01, doc:D31#page32…" required/><button className="button secondary" type="submit">Inspect reference</button></form></details>
      </section>
      <EvidenceInspector inspection={inspection} base={base} selectedLine={selectedLine} masked={workspace.masked}/>
    </div>
  </>;
}
