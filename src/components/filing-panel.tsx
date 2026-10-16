'use client';
import { ReadableRecord } from './readable-record';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FilingModel,getFilings } from '@/lib/season/service';
type FilingView={id:string;parentId:string|null;status:string;revision:number;snapshotHash:string|null;approval:{at:string;source:string;current:boolean}|null;
  originalEngineSummary?:unknown;modeledEstimates?:unknown;proposalHash?:string;createdBy?:string;nextResponseAvailable?:boolean;model?:FilingModel;attestations?:Record<string,{actorId:string}>;correction?:{ref:string}|null;
  readiness?:{ready:boolean;blockers:string[];findings:{key:string;title:string;inputRefs:string[]}[]};events?:unknown[];amendmentDiff?:unknown};
type Data=Awaited<ReturnType<typeof getFilings>>;
export function FilingPanel({data,base}:{data:Data;base:string}) {
  const canOperate=['preparer','reviewer','partner','quality_reviewer'].includes(data.role);
  const router=useRouter(),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function command(input:unknown) {
    setError('');setBusy(true);try{const response=await fetch(`/api${base}/season`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});const result=await response.json();if(!response.ok)throw Error(result.error);router.refresh();return true;}catch(e){setError(e instanceof Error?e.message:'The action failed.');return false;}finally{setBusy(false);}
  }
  return <section id="filing-approvals" className="section-panel season-panel" aria-labelledby="filing-approvals-title" tabIndex={-1}><span className="eyebrow">INTERNAL DEMONSTRATION</span><h2 id="filing-approvals-title">Simulated filing & amendments</h2><p className="evidence-gap">{data.warning} Every status here is simulated. Approval is a demonstration authorization, not a regulated electronic signature.</p>
    {!data.client&&data.canCreate&&<button className="button" disabled={busy} onClick={()=>command({action:'create',parentId:null})}>Create filing simulation</button>}
    {!data.client&&!data.canCreate&&<p>New simulations and amendment branches require a preparer identity and an available v3 return. Reviewers and partners provide separate approvals.</p>}
    {error&&<p role="alert">{error}</p>}{!data.filings.length&&<p>No filing simulation is available at this source date. Later replay simulations remain saved and reappear when the clock advances.</p>}
    {data.filings.map(raw=>{const f=raw as FilingView;const act=(action:string)=>command({action,id:f.id,expectedRevision:f.revision});return <article className="filing-card" key={f.id} data-testid="filing-card"><div className="filing-card-heading"><h3>{f.parentId?'Amendment branch':'Original return simulation'}</h3><span className="status-label neutral">SIMULATED · {f.status.replaceAll('_',' ')}</span></div><code>{f.id}</code><p>Revision {f.revision}{f.snapshotHash&&<> · Frozen/submitted snapshot SHA-256 <code>{f.snapshotHash}</code></>}</p>
      {f.approval&&<p>Demonstration authorization: {f.approval.current?'current':'stale or historical'} · {f.approval.source} · {f.approval.at}</p>}
      {data.client&&<details open><summary>Original v3 amounts and separate modeled estimates</summary><p>No accurate final liability is asserted. Proposal fingerprint: <code>{f.proposalHash}</code></p><ReadableRecord value={{originalEngineSummary:f.originalEngineSummary,rateBasedEstimates:f.modeledEstimates}}/></details>}
      {data.client&&f.status==='draft'&&<><p>I approve the displayed v3-based simulation and authorize this demonstration only. Modeled effects remain estimates and no real filing occurs.</p><button className="button" disabled={busy||!data.approvalAvailable} onClick={()=>act('approve')}>Approve & authorize simulation</button>{!data.approvalAvailable&&<p>The scripted approval date has not arrived.</p>}</>}
      {!data.client&&<>
        <AgencyAcknowledgments events={f.events??[]}/>
        {f.readiness&&f.status!=='accepted'&&<div className="filing-readiness"><h4>{f.readiness.ready?'Simulation gate passed':'Simulation readiness blockers'}</h4><ul>{f.readiness.blockers.map(b=><li key={b}>{b}</li>)}</ul></div>}
        {canOperate&&f.model&&f.status==='draft'&&<SimulationModel key={`${f.id}:${f.revision}`} filing={f} busy={busy} save={model=>command({action:'model',id:f.id,expectedRevision:f.revision,model})}/>}
        {canOperate&&<div className="filing-actions">{f.status==='draft'&&<>
          {['reviewer','partner'].includes(data.role)&&f.createdBy!==data.actorId&&<button className="button secondary" disabled={busy} onClick={()=>act('attest')}>Approve simulation as {data.role}</button>}
          {['reviewer','partner'].includes(data.role)&&<button className="button secondary" disabled={busy||!data.approvalAvailable} onClick={()=>act('scripted_approval')}>Link scripted msg-09 authorization</button>}
          <button className="button" disabled={busy||!f.readiness?.ready} onClick={()=>act('submit')}>Submit simulation</button>
        </>}{f.status==='rejected'&&data.canCorrectIdentity&&<button className="button" disabled={busy||!data.identityCorrectionAvailable} onClick={()=>act('correct_identity')}>Link D71 dependent-ID correction</button>}
        {!f.parentId&&['submitted','federal_accepted'].includes(f.status)&&<button className="button" disabled={busy||!f.nextResponseAvailable} onClick={()=>act('response')}>Replay next scripted agency response</button>}
        {f.status==='accepted'&&<><p>Accepted snapshot is frozen on the server. Changes require an isolated amendment branch.</p>{data.canCreate&&<button className="button secondary" disabled={busy} onClick={()=>command({action:'create',parentId:f.id})}>Create amendment branch</button>}</>}
        </div>}
        {f.status==='rejected'&&!data.identityCorrectionAvailable&&<p>D71 is not available at this source date. Advance replay before applying the dependent-ID correction.</p>}
        {f.status==='rejected'&&!data.canCorrectIdentity&&<p>A cleared tax professional must apply the identity correction.</p>}
        {f.parentId&&f.status==='submitted'&&<p>No amended-return acknowledgments are supplied. Amendment acceptance is not implemented; original-return responses cannot be reused.</p>}
        {!f.parentId&&['submitted','federal_accepted'].includes(f.status)&&!f.nextResponseAvailable&&<p>No next scripted acknowledgment is available at this source date. Advance the season clock to continue.</p>}
        {f.correction&&<p>Identity overlay: {f.correction.ref}. Original household entry and engine output are unchanged.</p>}
        {f.amendmentDiff&&<details open><summary>Amendment diff against frozen parent</summary><ReadableRecord value={f.amendmentDiff}/></details>}
        {f.events&&<details><summary>Simulation event history</summary><ReadableRecord value={f.events}/></details>}
      </>}
      {f.snapshotHash&&<a className="button secondary" href={`/api${base}/exports?kind=client&id=${f.id}`}>Download safe client HTML</a>}
    </article>;})}
    {!data.client&&<div className="notice-export"><h3>2028 Letter 566 response evidence</h3><p>Includes printed charity and Schedule C evidence, separate pipeline readings, dated answers and explicit gaps. The HTML opens offline.</p>{data.noticeAvailable?<a className="button" href={`/api${base}/exports?kind=notice`}>Download offline notice-response HTML</a>:<p>Unavailable until the examination letter is received in the season replay.</p>}</div>}
  </section>;
}
function AgencyAcknowledgments({events}:{events:unknown[]}) {
  const responses=events as {action:string;record:{agency?:{jurisdiction:string;status:string;date:string;errors?:{code:string;message:string}[]}[]}}[];
  const latest=responses.filter(e=>e.action==='response').at(-1)?.record.agency;
  if(!latest?.length)return null;
  return <div className="filing-acknowledgments">{latest.map((ack,i)=><section key={i}><h4>Scripted {ack.jurisdiction} acknowledgment · {ack.status.replaceAll('_',' ')}</h4><time>{ack.date}</time>{ack.errors?.map(error=><p key={error.code}><strong>{error.code}</strong> · {error.message}</p>)}<small>Supplied replay record · no IRS transmission</small></section>)}</div>;
}
function SimulationModel({filing:f,busy,save}:{filing:FilingView;busy:boolean;save:(model:FilingModel)=>Promise<boolean>}) {
  const [model,setModel]=useState(f.model!);const [line,setLine]=useState(''),[delta,setDelta]=useState(''),[category,setCategory]=useState('interest'),[reason,setReason]=useState(''),[refs,setRefs]=useState('');
  const findings=f.readiness?.findings??[];
  return <form className="simulation-model" aria-label="Simulation assumptions" method="post" onSubmit={e=>{e.preventDefault();void save(model);}}>
    <h4>Explicit simulation exceptions</h4><p>These acknowledgments leave Review Desk findings unresolved. Enter a reason grounded in the shown evidence; this does not certify an accurate return.</p>
    {findings.map(finding=><label className="simulation-exception" key={finding.key}>Simulation exception: {finding.title}<textarea minLength={10} maxLength={2000} value={model.exceptions.find(e=>e.key===finding.key)?.reason??''} onChange={e=>setModel({...model,exceptions:[...model.exceptions.filter(x=>x.key!==finding.key),...(e.target.value?[{key:finding.key,reason:e.target.value,refs:[finding.inputRefs[0]]}]:[])]})}/><small>Linked evidence: {finding.inputRefs.join(', ')}</small></label>)}
    <label className="acknowledgment"><input type="checkbox" checked={model.simulationAcknowledged} onChange={e=>setModel({...model,simulationAcknowledged:e.target.checked})}/> I acknowledge unresolved evidence and modeled tax estimates. This is a simulation; no accurate final tax liability or real filing is asserted.</label>
    <details><summary>Separate modeled adjustments · no engine rerun</summary><p>Original v3 lines remain read-only. Each change estimates tax effect using its supplied category rate; related downstream lines are not recalculated.</p>
      {model.adjustments.map(a=><p key={a.line}>{a.line} · delta {a.delta} · {a.category}<button type="button" className="button secondary" onClick={()=>setModel({...model,adjustments:model.adjustments.filter(x=>x.line!==a.line)})}>Remove {a.line}</button></p>)}
      <div className="model-fields"><label>Actual numeric v3 line<input value={line} onChange={e=>setLine(e.target.value)}/></label><label>Modeled change<input type="number" value={delta} onChange={e=>setDelta(e.target.value)}/></label><label>Supplied rate category<select value={category} onChange={e=>setCategory(e.target.value)}>{['wages','interest','schc_profit','stcg','ltcg','ordinary_income','adjustment','salt','itemized','ca_source_income'].map(k=><option key={k}>{k}</option>)}</select></label><label>Reason<input value={reason} onChange={e=>setReason(e.target.value)}/></label><label>Source refs, comma-separated<input value={refs} onChange={e=>setRefs(e.target.value)}/></label><button type="button" className="button secondary" disabled={!line||!delta||reason.trim().length<10||!refs.trim()} onClick={()=>{setModel({...model,adjustments:[...model.adjustments.filter(a=>a.line!==line),{line,delta:Number(delta),category,reason,refs:refs.split(',').map(s=>s.trim()).filter(Boolean)}]});setLine('');setDelta('');setReason('');setRefs('');}}>Add to unsaved model</button></div>
    </details><button className="button secondary" disabled={busy}>Save simulation assumptions</button><noscript>JavaScript is required for these audited filing simulation actions.</noscript>
  </form>;
}
