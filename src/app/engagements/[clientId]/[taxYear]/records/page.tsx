import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentActor } from '@/lib/auth/session';
import { getEvidenceWorkspace } from '@/lib/evidence/queries';
import { AREAS } from '@/lib/records/types';
import { StagePlaceholder } from '@/components/stage-placeholder';
export default async function Records({params}:{params:Promise<{clientId:string;taxYear:string}>}) {
  const actor=await currentActor();if(!actor)redirect('/firm');if(actor.role==='client')return <StagePlaceholder title="CPA records" phase={6} description="Tax records are available to firm staff."/>;
  const p=await params;const workspace=await getEvidenceWorkspace(actor,p.clientId,Number(p.taxYear));const base=`/engagements/${p.clientId}/${p.taxYear}`;
  return <section aria-labelledby="records-title"><div className="section-heading page-section-heading"><div><span className="eyebrow">CPA RECORDS</span><h2 id="records-title">Tax areas</h2><p>Original {workspace.index.version.version} computation and available evidence. No tax engine has been rerun.</p></div></div><div className="area-grid">{AREAS.map(a=><Link prefetch={false} className="panel area-card" key={a.id} href={`${base}/records/${a.id}`} aria-label={`Open area ${a.title}`}><span className="eyebrow">{a.id.replaceAll('-',' ')}</span><h3>{a.title}</h3><p>{a.description}</p><small>Open records & source trace →</small></Link>)}</div><aside className="evidence-gap"><h3>Missing evidence stays visible</h3><p>Unknown S-corp basis, partnership outside basis and absent related returns remain gaps. Original engine treatment is separate from prior-preparer evidence and human review overlays.</p></aside></section>;
}
