import { SourceDateUnavailable } from "@/components/source-date-unavailable";
import Link from 'next/link';
import { redirect,notFound } from 'next/navigation';
import { currentActor } from '@/lib/auth/session';
import { HttpError } from '@/lib/auth/permissions';
import { getRecords } from '@/lib/records/queries';
import { AREAS } from '@/lib/records/types';
import { inspectEvidence,recordEvidenceView } from '@/lib/evidence/queries';
import { displayValue,lineValue } from '@/lib/evidence/format';
import { EvidenceInspector } from '@/components/evidence-inspector';
import { RecordFacts } from '@/components/record-facts';
import { SalesDetail } from '@/components/sales-detail';
import { StagePlaceholder } from '@/components/stage-placeholder';
export default async function Area({params,searchParams}:{params:Promise<{clientId:string;taxYear:string;area:string}>;searchParams:Promise<{ref?:string;lot?:string;q?:string;document?:string}>}) {
  const actor=await currentActor();if(!actor)redirect('/firm');if(actor.role==='client')return <StagePlaceholder title="CPA records" phase={6} description="Tax records are available to firm staff."/>;
  const [p,search]=await Promise.all([params,searchParams]);let result;
  try{result=await getRecords(actor,p.clientId,Number(p.taxYear),p.area);}catch(e){if(e instanceof HttpError&&e.status===409)return <SourceDateUnavailable/>;if(e instanceof HttpError&&e.status===404)notFound();throw e;}
  const {workspace,model,lots,reviews,canReview}=result;const base=`/engagements/${p.clientId}/${p.taxYear}`;
  const lot=typeof search.lot==='string'?lots.find(l=>l.key===search.lot||l.id===search.lot):undefined;if(search.lot&&!lot)notFound();
  const ref=typeof search.ref==='string'?search.ref:lot?.key??model.trace;const inspection=inspectEvidence(workspace,ref);await recordEvidenceView(workspace,ref);
  const href=(target:string)=>`${base}/records/${p.area}?${new URLSearchParams({...(lot?{lot:lot.key}:{}),ref:target})}#evidence-inspector`;
  return <section className="tax-area" aria-labelledby="area-heading">
    <Link className="text-button" href={`${base}/records`}>← Tax areas</Link><div className="section-heading page-section-heading"><div><span className="eyebrow">ORIGINAL {workspace.index.version.version} · CPA RECORD</span><h2 id="area-heading">{model.title}</h2><p>{model.description}</p></div></div>
    <nav className="area-tabs" aria-label="Tax areas">{AREAS.map(a=><Link prefetch={false} key={a.id} aria-current={a.id===p.area?'page':undefined} href={`${base}/records/${a.id}`}>{a.title}</Link>)}</nav>
    {model.metrics.length>0&&<div className="record-metrics">{model.metrics.map(m=><Link prefetch={false} href={href(m.ref)} className="panel" key={m.ref}><span>{m.label}</span><strong>{lineValue({label:m.label,value:m.value})}</strong><small>{m.ref} · inspect calculation</small></Link>)}</div>}
    {p.area==='documents'&&<Link className="button primary" href={`${base}/documents`}>Open all-document index</Link>}
    {p.area==='sales'&&<SalesDetail key={workspace.index.version.version} lots={lots} reviews={reviews} base={base} version={workspace.index.version.version} selectedKey={lot?.key} canReview={canReview} query={typeof search.q==='string'?search.q:''} documentId={typeof search.document==='string'?search.document:undefined}/>}
    <div className="records-workspace"><div>
      {lot&&<section className="panel record-card" aria-label="Selected lot details"><h3>{lot.id} · {lot.description}</h3><RecordFacts value={{category:lot.category,exception:lot.exception,acquired:lot.acquired,sold:lot.sold,quantity_or_units:lot.quantity,proceeds:lot.proceeds,basis:lot.basis,wash:lot.wash,original_engine_gain:lot.gain}} reference={lot.key} href={href}/><h4>Actual input provenance</h4><ul className="reference-list">{lot.sourceRefs.map(source=><li key={source}><Link prefetch={false} href={href(source)}>{source}</Link></li>)}</ul><Link prefetch={false} className="text-button" href={`${base}/documents/${lot.documentId}?page=${lot.page}`}>Open {lot.documentId} page {lot.page}</Link><p className="fine-print">Pipeline fields and computed gain are separate. A null basis is unknown, not zero.</p></section>}
      {model.gaps.map(g=><aside className="evidence-gap" key={g.title}><h3>{g.title}</h3><p>{g.detail}</p>{g.ref&&<Link prefetch={false} className="text-button" href={href(g.ref)}>Inspect evidence / gap</Link>}</aside>)}
      {model.comparisons.length>0&&<section className="panel record-card"><h3>2024 as filed → selected 2025 computation</h3><p className="fine-print">Variance criteria come from current firm standards. Missing or changed detail-line meanings are not silently paired; “not comparable” has no calculated variance.</p><div className="comparison-list">{model.comparisons.map(c=><article key={c.key} className={c.flagged?'variance-flag':''}><header><code>{c.key}</code>{c.flagged&&<strong>Review variance</strong>}</header><h4>{c.label}</h4><div><Link prefetch={false} href={href(c.priorRef)}>2024: {displayValue(c.prior)}</Link><Link prefetch={false} href={href(c.key)}>2025: {c.current===null?'Unavailable':displayValue(c.current)}</Link></div><p>{c.delta===null?'Not comparable · inspect both source meanings':`Change ${displayValue(c.delta)}${c.percent===null?' · prior zero':` (${c.percent.toFixed(1)}%)`}`}</p></article>)}</div></section>}
      {model.bridge&&<section className="panel record-card" aria-label="Books to engine bridge"><h3>Book profit → original engine profit</h3><p className="fine-print">Arithmetic reconciliation of supplied book and engine totals. Each step links to both sides where applicable; amounts are not tax corrections.</p><ol className="book-bridge">{model.bridge.map(step=><li key={step.label}><strong>{step.label}</strong><span>{displayValue(step.value,true)}</span><div>{step.refs.map(ref=><Link prefetch={false} key={ref} href={href(ref)}>{ref}</Link>)}</div></li>)}</ol></section>}
      {model.records.map((r,i)=><details className="panel record-card" key={r.ref} open={i===0}><summary>{r.title}</summary><div className="record-card-source"><Link prefetch={false} className="text-button" href={href(r.ref)}>Inspect {r.ref}</Link></div><RecordFacts value={r.data} reference={r.ref} href={href}/></details>)}
      <details className="panel record-card" open={!model.records.length}><summary>Computed lines in this area</summary><p className="fine-print">Supplied rules, inputs and sources are available for every line. These are original computed results.</p><div className="area-lines">{model.lines.filter(l=>p.area!=='sales'||!lots.some(lot=>lot.key===l.key)).map(l=><Link prefetch={false} href={href(l.key)} key={l.key}><span><code>{l.key}</code><small>{l.label}</small></span><strong>{lineValue(l)}</strong></Link>)}</div></details>
    </div><EvidenceInspector inspection={inspection} base={base} masked={workspace.masked} referenceHref={href}/></div>
  </section>;
}
