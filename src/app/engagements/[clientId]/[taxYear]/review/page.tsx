import { SourceDateUnavailable } from "@/components/source-date-unavailable";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth/session";
import { getImportStatus } from "@/lib/engagements/queries";
import { optionalEvidenceWorkspace as getEvidenceWorkspace, inspectEvidence, recordEvidenceView } from "@/lib/evidence/queries";
import { getReviewDesk, filterIssues } from "@/lib/review/issues";
import { AREA_LABELS, ISSUE_STATES, STATE_LABELS } from "@/lib/review/types";
import { EvidenceInspector } from "@/components/evidence-inspector";
import { IssueTriageForm } from "@/components/issue-triage-form";
import { StagePlaceholder } from "@/components/stage-placeholder";

function fact(value:unknown,key=""):string {
  if(value===null)return "Not established";
  if(typeof value==="boolean")return value?"Yes":"No";
  if(typeof value==="number")return /confidence/iu.test(key)?`${Math.round(value*100)}%`:new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(value);
  if(Array.isArray(value))return value.length?value.map(item=>fact(item,key)).join("; "):"None";
  if(value&&typeof value==="object")return Object.entries(value).map(([name,item])=>`${name.replace(/([a-z])([A-Z])/gu,"$1 $2")}: ${fact(item,name)}`).join(" · ");
  return String(value);
}
function Facts({label,values}:{label:string;values:Record<string,unknown>}) {
  return <section className="finding-facts"><h4>{label}</h4><dl>{Object.entries(values).map(([key,value])=><div key={key}><dt>{key.replace(/([a-z])([A-Z])/gu,"$1 $2")}</dt><dd>{fact(value,key)}</dd></div>)}</dl></section>;
}
export default async function Review({ params,searchParams }: { params: Promise<{ clientId: string; taxYear: string }>;searchParams:Promise<{issue?:string;ref?:string;status?:string;blocker?:string;area?:string;assignee?:string}> }) {
  const actor = await currentActor();
  if (!actor) redirect("/firm");
  if (actor.role === "client") return <StagePlaceholder title="Review Desk" phase={3} description="Independent checks are planned for Phase 3."/>;
  const [{ clientId, taxYear },search] = await Promise.all([params,searchParams]);
  const [workspace,status]=await Promise.all([getEvidenceWorkspace(actor,clientId,Number(taxYear)),getImportStatus(actor,clientId,Number(taxYear))]);
  if(!workspace)return <SourceDateUnavailable/>;
  const desk=await getReviewDesk(workspace);
  const filters={status:typeof search.status==="string"?search.status:"all",blocker:typeof search.blocker==="string"?search.blocker:"all",area:typeof search.area==="string"?search.area:"all",assignee:typeof search.assignee==="string"?search.assignee:"all"};
  const issues=filterIssues(desk.issues,filters).sort((a,b)=>Number(b.finding.severity==="blocking")-Number(a.finding.severity==="blocking")||a.key.localeCompare(b.key));
  const selected=issues.find(issue=>issue.key===search.issue)??issues[0];
  const selectedRef=typeof search.ref==="string"&&search.ref.length<=500?search.ref:selected?.finding.action.ref;
  const inspection=selected&&selectedRef?inspectEvidence(workspace,selectedRef):null;
  if(inspection)await recordEvidenceView(workspace,selectedRef!);
  const base=`/engagements/${clientId}/${taxYear}`;
  const issueHref=(key:string,ref?:string)=>`${base}/review?${new URLSearchParams({...filters,issue:key,...(ref?{ref}:{})})}${ref?"#evidence-inspector":"#selected-finding"}`;
  const passes=desk.checks.filter(check=>check.outcome==="pass");
  return <section className="review-desk" aria-labelledby="review-heading">
    <span className="eyebrow">INDEPENDENT CHECKS · {desk.version}</span>
    <h2 id="review-heading">Review Desk</h2>
    <p className="review-intro">{desk.checks.length} deterministic checks · {desk.issues.length} findings · {passes.length} passing control. Source evidence, calculation output and your review disposition stay separate.</p>
    <div className="foundation-actions">
      <Link prefetch={false} className="button" href={`/engagements/${clientId}/${taxYear}/return`}>Open tax return</Link>
      <Link prefetch={false} className="button secondary" href={`/engagements/${clientId}/${taxYear}/documents`}>Browse client documents</Link>
      <a className="button" href="#computed-version">Choose computed version</a>
      <Link className="button secondary" href={`/firm?q=${encodeURIComponent(clientId)}`}>Find this household</Link>
    </div>
    <form className="panel issue-filters" action={`${base}/review`} aria-label="Issue filters">
      <div><label htmlFor="filter-status">Status</label><select id="filter-status" name="status" defaultValue={filters.status}><option value="all">All states</option>{ISSUE_STATES.map(state=><option value={state} key={state}>{STATE_LABELS[state]}</option>)}</select></div>
      <div><label htmlFor="filter-blocker">Blocker</label><select id="filter-blocker" name="blocker" defaultValue={filters.blocker}><option value="all">All priorities</option><option value="blocking">Blocking findings</option><option value="nonblocking">Nonblocking findings</option></select></div>
      <div><label htmlFor="filter-area">Tax area</label><select id="filter-area" name="area" defaultValue={filters.area}><option value="all">All tax areas</option>{Object.entries(AREA_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div>
      <div><label htmlFor="filter-assignee">Assignee</label><select id="filter-assignee" name="assignee" defaultValue={filters.assignee}><option value="all">Everyone</option><option value="unassigned">Unassigned</option>{desk.assignees.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select></div>
      <button className="button secondary" type="submit">Filter issues</button><Link className="text-button" href={`${base}/review`}>Clear filters</Link>
    </form>
    <div className="review-workspace">
      <div className="review-queue-column">
        <section className="panel issue-queue" aria-label="Independent issue queue"><div className="section-heading"><h3>Independent findings</h3><span className="count-tag">{issues.length} shown</span></div>
          {issues.length?<ul>{issues.map(issue=><li key={issue.key} className={selected?.key===issue.key?"selected-issue":""}><Link prefetch={false} href={issueHref(issue.key)} aria-label={`Select issue ${issue.finding.code}`}><div className="issue-row-heading"><span className={`finding-priority ${issue.finding.severity}`}>{issue.finding.severity==="blocking"?"Blocking":"Warning"}</span><span className="issue-state">{STATE_LABELS[issue.status]}</span></div><strong>{issue.finding.title}</strong><span>{AREA_LABELS[issue.finding.taxArea]} · {desk.assignees.find(person=>person.id===issue.assigneeId)?.name??"Unassigned"}</span><small>{issue.finding.outcome.replaceAll("_"," ")} · {issue.finding.certainty}</small></Link></li>)}</ul>:<div className="search-empty"><h3>No findings match these filters</h3><p>Clear filters to return to the full independent queue. This does not establish filing readiness.</p></div>}
        </section>
        {selected&&<section id="selected-finding" className="panel selected-finding" aria-labelledby="finding-title"><span className="eyebrow">INDEPENDENT FINDING · {selected.finding.code}</span><h3 id="finding-title">{selected.finding.title}</h3><p className="finding-explanation">{selected.finding.explanation}</p><div className="finding-fact-grid"><Facts label="Observed" values={selected.finding.observed}/><Facts label="Expected / reconciliation target" values={selected.finding.expected}/></div><p className="finding-certainty">{selected.finding.outcome.replaceAll("_"," ")} · certainty: {selected.finding.certainty} · {desk.version}</p>
          <Link prefetch={false} className="button" href={issueHref(selected.key,selected.finding.action.ref)}>{selected.finding.action.label}</Link>
          <h4>Source and calculation references</h4><ul className="reference-list">{selected.finding.inputRefs.map(ref=><li key={ref}><Link prefetch={false} href={issueHref(selected.key,ref)} aria-label={`Inspect issue evidence ${ref}`}>{ref}</Link></li>)}</ul>
          {desk.canTriage?<IssueTriageForm key={`${actor.id}:${selected.key}:${selected.revision}`} issue={selected} assignees={desk.assignees} clientId={clientId} taxYear={Number(taxYear)}/>:<p className="triage-scope">This identity can inspect findings. A preparer, reviewer or partner must save tax-review dispositions.</p>}
        </section>}
      </div>
      {inspection&&selected&&<EvidenceInspector inspection={inspection} base={base} masked={workspace.masked} referenceHref={ref=>issueHref(selected.key,ref)}/>}
    </div>
    <details className="panel review-controls"><summary>Passing independent controls ({passes.length})</summary>{passes.map(check=><div key={check.key}><h3>{check.title}</h3><p>{check.explanation}</p><p>{fact(check.observed)}</p><Link prefetch={false} className="text-button" href={`${base}/return?ref=${encodeURIComponent(check.action.ref)}`}>Inspect passing control evidence</Link></div>)}</details>
    <details className="panel engine-diagnostics"><summary>Supplied engine diagnostics ({desk.diagnostics.length}) · separate from independent checks</summary><p>These are unmodified pipeline messages. They are not counted as independent findings and have no triage state here.</p>{desk.diagnostics.map(diagnostic=><div key={diagnostic.code}><h3>{diagnostic.code} · {diagnostic.severity}</h3><p>{diagnostic.message}</p><ul className="reference-list">{diagnostic.refs.map(ref=><li key={ref}><Link prefetch={false} href={selected?issueHref(selected.key,ref):`${base}/return?ref=${encodeURIComponent(ref)}`}>{ref}</Link></li>)}</ul></div>)}</details>
    <details className="panel import-details review-import-details" open>
      <summary>Packet import details</summary>
      <p>Full delivered packet totals are shown below. The workpaper follows the selected season clock; the header counts only documents available at that date. Future source contents remain withheld.</p>
      <dl className="import-metrics">
        <div><dt>Imported documents</dt><dd>{status.documentCount}</dd></div>
        <div><dt>Source pages</dt><dd>{status.pageCount}</dd></div>
        <div><dt>Extracted values</dt><dd>{status.extractedValueCount.toLocaleString("en-US")}</dd></div>
        <div><dt>Computed versions</dt><dd>{status.versions.map(version => version.version).join(" / ")}</dd></div>
      </dl>
      <dl className="import-provenance">
        <div><dt>Source file</dt><dd><code>data/okafor_lindqvist_2025_packet.json</code></dd></div>
        <div><dt>Original bytes</dt><dd>{status.byteLength.toLocaleString("en-US")}</dd></div>
        <div><dt>Imported at (UTC)</dt><dd><time dateTime={status.importedAt}>{status.importedAt}</time></dd></div>
        <div><dt>SHA-256</dt><dd><code>{status.packetHash}</code></dd></div>
      </dl>
    </details>
    <div className="phase-boundary"><h3>Review scope</h3><p>Issue triage persists with evidence and audit history. Tax corrections, sign-offs and filing-readiness derivation remain later-phase work. A closed triage state does not alter the engine result.</p></div>
  </section>;
}
