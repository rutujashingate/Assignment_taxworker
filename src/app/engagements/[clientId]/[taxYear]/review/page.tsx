import { SourceDateUnavailable } from "@/components/source-date-unavailable";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth/session";
import { getImportStatus } from "@/lib/engagements/queries";
import { optionalEvidenceWorkspace as getEvidenceWorkspace, inspectEvidence, recordEvidenceView } from "@/lib/evidence/queries";
import { getReviewDesk, filterIssues } from "@/lib/review/issues";
import { AREA_LABELS, ISSUE_STATES, STATE_LABELS, type IssueView } from "@/lib/review/types";
import { issuePresentation, needsAttention, recommendIssue, reviewGuidance, passedCheckPresentation } from "@/lib/review/presentation";
import { EvidenceInspector } from "@/components/evidence-inspector";
import { IssueTriageForm } from "@/components/issue-triage-form";
import { StagePlaceholder } from "@/components/stage-placeholder";
import { ReadableRecord } from "@/components/readable-record";
import { referenceLabel } from "@/lib/evidence/format";

export default async function Review({ params,searchParams }: { params: Promise<{ clientId: string; taxYear: string }>;searchParams:Promise<{issue?:string;ref?:string;status?:string;blocker?:string;area?:string;assignee?:string}> }) {
  const actor=await currentActor();if(!actor)redirect('/firm');
  if(actor.role==='client')return <StagePlaceholder title="Review" phase={3} description="Review is available to your tax team."/>;
  const [{clientId,taxYear},search]=await Promise.all([params,searchParams]);
  const [workspace,status]=await Promise.all([getEvidenceWorkspace(actor,clientId,Number(taxYear)),getImportStatus(actor,clientId,Number(taxYear))]);
  if(!workspace)return <SourceDateUnavailable/>;
  const desk=await getReviewDesk(workspace),base=`/engagements/${clientId}/${taxYear}`;
  const filters={status:typeof search.status==='string'?search.status:'all',blocker:typeof search.blocker==='string'?search.blocker:'all',area:typeof search.area==='string'?search.area:'all',assignee:typeof search.assignee==='string'?search.assignee:'all'};
  const issues=filterIssues(desk.issues,filters).sort((a,b)=>Number(needsAttention(b))-Number(needsAttention(a))||Number(b.finding.severity==='blocking')-Number(a.finding.severity==='blocking')||a.key.localeCompare(b.key));
  const next=recommendIssue(issues,actor.id),selected=issues.find(i=>i.key===search.issue);
  const selectedRef=typeof search.ref==='string'&&search.ref.length<=500?search.ref:undefined;
  const inspection=selected&&selectedRef?inspectEvidence(workspace,selectedRef):null;
  if(inspection)await recordEvidenceView(workspace,selectedRef!);
  const issueHref=(key:string,ref?:string)=>`${base}/review?${new URLSearchParams({...filters,issue:key,...(ref?{ref}:{})})}${ref?'#evidence-inspector':'#selected-finding'}`;
  const attention=desk.issues.filter(needsAttention),waiting=attention.filter(i=>i.status==='waiting');
  const passes=desk.checks.filter(c=>c.outcome==='pass'),filtered=Object.values(filters).some(value=>value!=='all');
  const view=selected?issuePresentation(selected.finding):null;
  function reviewAmount(text:string,kind:'reported'|'supported'|'difference'){
    if(!selected||!/^[-]?\$?[\d,]+(?:\.\d+)?(?: miles)?$/u.test(text))return text;
    const value=Number(text.replaceAll('$','').replaceAll(',','').replace(' miles',''));
    // Only an existing finding reference can be a destination. Reconciled totals
    // without a single source value open the comparison instead of a false field.
    const refs=kind==='reported'?selected.finding.inputRefs.map(ref=>workspace!.index.resolve(ref)):[];
    const target=refs.find(r=>r.status==='resolved'&&r.kind==='line'&&r.line.value===value)??refs.find(r=>r.status==='resolved'&&r.kind==='extracted_value'&&r.extraction.value===value);
    const href=target?issueHref(selected.key,target.ref):`${issueHref(selected.key).split('#')[0]}#review-evidence`;
    return <Link prefetch={false} className="amount-link" href={href} aria-label={`Inspect ${kind} value`} title={target?'Inspect the linked return amount or source reading':'Compare the supporting records for this figure'}>{text} <span aria-hidden="true">↗</span></Link>;
  }
  const guidance=selected?reviewGuidance(selected.finding):null;
  const following=recommendIssue(issues.filter(i=>i.key!==selected?.key),actor.id);
  const evidenceLabels=Object.fromEntries((selected?.finding.inputRefs??[]).map(ref=>{
    const r=workspace.index.resolve(ref);
    return [ref,r.status==='resolved'&&r.kind==='extracted_value'?`${r.extraction.document_id} · Page ${r.extraction.page} · ${String(r.extraction.label??r.extraction.field)}`:referenceLabel(ref,r.label)];
  }));
  const otherSources=(selected?.finding.inputRefs??[]).filter(ref=>{const r=workspace.index.resolve(ref);return r.status==='resolved'&&!['line','extracted_value','document','page'].includes(r.kind);});
  const sources=new Map<string,{id:string;page:number;title:string}>();
  for(const ref of selected?.finding.inputRefs??[]){
    const r=workspace.index.resolve(ref);if(r.status!=='resolved')continue;
    const id=r.kind==='extracted_value'?r.extraction.document_id:r.kind==='page'?r.documentId:r.kind==='document'?r.document.id:null;
    const page=r.kind==='extracted_value'?r.extraction.page:r.kind==='page'?r.page.page:r.kind==='document'?r.document.pages[0].page:1;
    if(id){const doc=workspace.index.documents.get(id);if(doc)sources.set(`doc:${id}#page${page}`,{id,page,title:doc.title});}
  }
  function queueRow(issue:IssueView){return <li key={issue.key} className={selected?.key===issue.key?'selected-issue':''}><Link prefetch={false} href={issueHref(issue.key)} aria-current={selected?.key===issue.key?'true':undefined} aria-label={`Review issue: ${issuePresentation(issue.finding).title}`}><div className="issue-row-heading"><span className={`finding-priority ${issue.finding.severity}`}>{issue.finding.severity==='blocking'?'Before approval':'Review suggested'}</span><span className="issue-state">{STATE_LABELS[issue.status]}</span></div><strong>{issuePresentation(issue.finding).title}</strong><span>{AREA_LABELS[issue.finding.taxArea]} · {desk.assignees.find(p=>p.id===issue.assigneeId)?.name??'Unassigned'}</span></Link></li>;}
  return <section className="review-desk" aria-labelledby="review-heading">
    <header className="review-heading"><div><h2 id="review-heading">Review</h2><p>{selected?'Check the difference, compare the evidence, then save your conclusion.':'Start with one item below. Check its documents, then save what you found.'}</p></div><div className="review-counts"><strong>{attention.length} need attention</strong><span>{waiting.length} waiting for information</span></div></header>
    {!selected&&(next?<section className="next-review" aria-labelledby="next-review-heading"><div><span className="eyebrow">START HERE</span><h3 id="next-review-heading">{issuePresentation(next.finding).title}</h3><p>{issuePresentation(next.finding).next}</p></div><Link prefetch={false} className="button" href={issueHref(next.key)}>Review next issue <span aria-hidden="true">→</span></Link></section>:<div className="next-review"><p>{filtered?'No unresolved items match these filters.':'No open review items remain.'} Saved review conclusions do not change the return amounts.</p></div>)}
    {selected?<Link className="text-button review-back" href={`${base}/review?${new URLSearchParams(filters)}`}>← Back to review list</Link>:<ol className="review-start-steps" aria-label="How to review"><li><strong>1. Open an item</strong><span>See what needs checking.</span></li><li><strong>2. Compare the evidence</strong><span>Read the linked documents.</span></li><li><strong>3. Save your conclusion</strong><span>Add your reason and supporting sources.</span></li></ol>}
    {search.issue&&!selected&&<p role="status">This item is not available in the selected return. Choose an item below.</p>}
    <details className="review-filters panel" open={filtered}><summary>Filter review items{filtered?' · filters active':''}</summary><form className="issue-filters" action={`${base}/review`} aria-label="Issue filters">
      <div><label htmlFor="filter-status">Status</label><select id="filter-status" name="status" defaultValue={filters.status}><option value="all">All states</option>{ISSUE_STATES.map(state=><option value={state} key={state}>{STATE_LABELS[state]}</option>)}</select></div>
      <div><label htmlFor="filter-blocker">Priority</label><select id="filter-blocker" name="blocker" defaultValue={filters.blocker}><option value="all">All priorities</option><option value="blocking">Before approval</option><option value="nonblocking">Review suggested</option></select></div>
      <div><label htmlFor="filter-area">Tax area</label><select id="filter-area" name="area" defaultValue={filters.area}><option value="all">All tax areas</option>{Object.entries(AREA_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div>
      <div><label htmlFor="filter-assignee">Assigned to</label><select id="filter-assignee" name="assignee" defaultValue={filters.assignee}><option value="all">Everyone</option><option value="unassigned">Unassigned</option>{desk.assignees.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <button className="button secondary">Filter issues</button><Link className="text-button" href={`${base}/review`}>Clear filters</Link>
    </form></details>
    <div className={`review-workspace${selected?'':' review-list-only'}`}>
      <section className="panel issue-queue" aria-label="Review items"><div className="section-heading"><h3>{selected?'Review items':'Items to check'}</h3><span className="count-tag">{issues.length}</span></div>
        {issues.length?<><ul>{issues.filter(needsAttention).map(queueRow)}</ul>{issues.some(i=>!needsAttention(i))&&<details className="completed-review"><summary>Explained or resolved ({issues.filter(i=>!needsAttention(i)).length})</summary><ul>{issues.filter(i=>!needsAttention(i)).map(queueRow)}</ul></details>}</>:<div className="search-empty"><h3>No review items match these filters</h3><Link className="text-button" href={`${base}/review`}>Clear filters</Link></div>}
      </section>
      <div className="review-detail-column">
        {selected&&view&&guidance&&<section id="selected-finding" className="panel selected-finding" aria-labelledby="finding-title"><header className="issue-detail-heading"><span>{AREA_LABELS[selected.finding.taxArea]}</span><span className="status-label neutral">{STATE_LABELS[selected.status]}</span></header><h3 id="finding-title">{view.title}</h3>
          <h4 className="review-step-heading"><span>1</span> Check the difference</h4><p className="finding-explanation">{guidance.summary}</p>
          <dl className="discrepancy-summary"><div><dt>Reported value</dt><dd>{reviewAmount(view.reported,'reported')}</dd></div><div><dt>Supported value</dt><dd>{reviewAmount(view.supported,'supported')}</dd></div><div><dt>Difference to review</dt><dd>{reviewAmount(view.difference,'difference')}</dd></div></dl>
          <p className="issue-qualification">{view.qualification}</p>
          <section id="review-evidence" className="issue-evidence" aria-label="Supporting source evidence"><h4 className="review-step-heading"><span>2</span> Compare the evidence</h4><ol className="review-checklist">{guidance.steps.map(step=><li key={step}>{step}</li>)}</ol><Link prefetch={false} className="button secondary" href={issueHref(selected.key,selected.finding.action.ref)}>View source evidence</Link><ul className="source-cards">{[...sources].map(([ref,source])=><li key={ref}><Link prefetch={false} href={issueHref(selected.key,ref)}><span>{source.id} · Page {source.page}</span><strong>{source.title}</strong><span className="source-open">Open source →</span></Link></li>)}</ul>{otherSources.length>0&&<ul className="additional-evidence">{otherSources.map(ref=><li key={ref}><Link prefetch={false} href={issueHref(selected.key,ref)}>{evidenceLabels[ref]}</Link></li>)}</ul>}</section>
          {inspection&&<section className="review-open-evidence"><EvidenceInspector inspection={inspection} base={base} masked={workspace.masked} compact closeHref={`${issueHref(selected.key).split('#')[0]}#review-evidence`} referenceHref={ref=>issueHref(selected.key,ref)}/></section>}
          {desk.canTriage?<IssueTriageForm key={`${actor.id}:${selected.key}:${desk.version}`} issue={selected} assignees={desk.assignees} clientId={clientId} taxYear={Number(taxYear)} evidenceLabels={evidenceLabels} nextHref={following?issueHref(following.key):`${base}/review`}/>:<p className="triage-scope">You have read-only access to tax review. A preparer, reviewer or partner can record the next step. Firm administration is available under More tools.</p>}
          <details className="issue-technical"><summary>How this check works</summary><p>{selected.finding.explanation}</p><p className="finding-certainty">{selected.finding.outcome.replaceAll('_',' ')} · certainty: {selected.finding.certainty} · {desk.version}</p><code>{selected.finding.code}</code><div className="finding-fact-grid">{[['Observed',selected.finding.observed],['Reconciliation target',selected.finding.expected]].map(([label,values])=><section className="finding-facts" key={String(label)}><h4>{String(label)}</h4><ReadableRecord value={values}/></section>)}</div><h4>Source and calculation references</h4><ul className="reference-list">{selected.finding.inputRefs.map(ref=><li key={ref}><Link prefetch={false} href={issueHref(selected.key,ref)} aria-label={`Inspect issue evidence ${ref}`}>{evidenceLabels[ref]} <small>({ref})</small></Link></li>)}</ul></details>
        </section>}
      </div>
    </div>
    <details className="panel review-controls"><summary>Checks with no issue found ({passes.length})</summary>{passes.map(check=>{const summary=passedCheckPresentation(check);return <div key={check.key}><h3>{summary.title}</h3><p>{summary.summary}</p><Link prefetch={false} className="text-button" href={`${base}/return?ref=${encodeURIComponent(check.action.ref)}`}>Check this on the return</Link></div>;})}</details>
    <details className="panel engine-diagnostics"><summary>Original calculation messages ({desk.diagnostics.length})</summary><p>Unmodified engine diagnostics, separate from the review checks above.</p>{desk.diagnostics.map(diagnostic=><div key={diagnostic.code}><h3>{diagnostic.code} · {diagnostic.severity}</h3><p>{diagnostic.message}</p><ul className="reference-list">{diagnostic.refs.map(ref=><li key={ref}><Link prefetch={false} href={selected?issueHref(selected.key,ref):`${base}/return?ref=${encodeURIComponent(ref)}`}>{ref}</Link></li>)}</ul></div>)}</details>
    <details className="panel import-details review-import-details"><summary>Packet import details</summary><p>Full delivered inventory; source availability follows the season clock.</p><dl className="import-metrics"><div><dt>Imported documents</dt><dd>{status.documentCount}</dd></div><div><dt>Source pages</dt><dd>{status.pageCount}</dd></div><div><dt>Extracted values</dt><dd>{status.extractedValueCount.toLocaleString('en-US')}</dd></div><div><dt>Computed versions</dt><dd>{status.versions.map(v=>v.version).join(' / ')}</dd></div></dl><dl className="import-provenance"><div><dt>Source file</dt><dd><code>data/okafor_lindqvist_2025_packet.json</code></dd></div><div><dt>Original bytes</dt><dd>{status.byteLength.toLocaleString('en-US')}</dd></div><div><dt>Imported at (UTC)</dt><dd>{status.importedAt}</dd></div><div><dt>SHA-256</dt><dd><code>{status.packetHash}</code></dd></div></dl></details>
    {!selected&&<p className="review-scope">This workspace saves review notes and conclusions. Tax corrections and formal verification sign-offs are not available yet.</p>}
  </section>;
}
