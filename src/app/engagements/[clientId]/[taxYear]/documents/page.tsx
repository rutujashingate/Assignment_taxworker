import Link from "next/link";
import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth/session";
import { documentIndex, getEvidenceWorkspace } from "@/lib/evidence/queries";
import { documentHref } from "@/lib/evidence/format";
import { StagePlaceholder } from "@/components/stage-placeholder";

export default async function Documents({ params, searchParams }: {
  params: Promise<{ clientId: string; taxYear: string }>; searchParams: Promise<{ q?: string; state?: string }>;
}) {
  const actor = await currentActor(); if (!actor) redirect("/firm");
  if (actor.role === "client") return <StagePlaceholder title="Documents" phase={2} description="Source review is available to staff."/>;
  const [{ clientId, taxYear }, search] = await Promise.all([params, searchParams]);
  const workspace = await getEvidenceWorkspace(actor, clientId, Number(taxYear));
  const q = typeof search.q === "string" ? search.q.slice(0,200) : "";
  const state = typeof search.state === "string" ? search.state : "all";
  const index = documentIndex(workspace, q, state);
  const base = `/engagements/${clientId}/${taxYear}`;
  return <section className="panel document-index">
    <div className="section-heading"><div><span className="eyebrow">SOURCE RECORDS</span><h2>Documents</h2><p>Search the supplied records and open any available printed page.</p></div><span className="count-tag">{index.rows.length} results</span></div>
    <div className="document-inventory"><strong>Full packet: {index.total.total} documents</strong><span>{index.total.extracted} extracted · {index.total.partial} partial · {index.total.not_extracted} not extracted</span><p>Available on June 23, 2026: {index.available} documents ({index.states.extracted} extracted, {index.states.partial} partial, {index.states.not_extracted} not extracted). {index.withheld} future records are withheld until replay advances; their names and contents are not shown.</p></div>
    <form className="document-search" action={`${base}/documents`}><label className="sr-only" htmlFor="document-search">Search documents</label><input id="document-search" type="search" name="q" maxLength={200} defaultValue={q} placeholder="Document ID, title, issuer, type or year"/><label htmlFor="extraction-state" className="sr-only">Extraction state</label><select id="extraction-state" name="state" defaultValue={state}><option value="all">All extraction states</option><option value="extracted">Extracted</option><option value="partial">Partial</option><option value="not_extracted">Not extracted</option></select><button type="submit" className="button secondary">Search documents</button></form>
    {index.rows.length ? <div className="table-scroll"><table className="documents-table"><thead><tr><th>DOCUMENT</th><th>EXTRACTION</th><th>PAGES</th><th>YEAR</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{index.rows.map(doc => <tr key={doc.id}><td><Link prefetch={false} href={documentHref(base,doc.id)} className="document-title">{doc.id} · {doc.title}</Link><span className="cell-detail">{doc.type} · {doc.issuer}</span><span className="cell-detail">{doc.computedUsed?'Listed as used by engine':'Not listed as used by engine'} · {doc.usageCount} downstream line usages · human disposition not recorded</span>{doc.superseded && <span className="superseded-tag">Superseded in {workspace.index.version.version}</span>}</td><td><span className={`extraction-tag ${doc.status}`}>{doc.status.replaceAll("_"," ")}</span><span className="cell-detail">{doc.values} extracted values</span>{typeof doc.reason === "string" && <small className="extraction-reason">{doc.reason}</small>}</td><td>{doc.pages}</td><td>{doc.taxYear}</td><td><Link prefetch={false} className="open-link" aria-label={`Open document ${doc.id}`} href={documentHref(base,doc.id)}>Open ↗</Link></td></tr>)}</tbody></table></div> : <div className="search-empty"><h3>No documents match</h3><p>Try D29, Northlake, W-2 or another extraction state.</p></div>}
  </section>;
}
