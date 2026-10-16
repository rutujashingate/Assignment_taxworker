'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { getSeason } from '@/lib/season/service';
import { displayValue } from '@/lib/evidence/format';
type Data=Awaited<ReturnType<typeof getSeason>>;
export function SeasonDesk({data,base}:{data:Data;base:string}) {
  const router=useRouter(),[error,setError]=useState(''),[busy,setBusy]=useState(false),[category,setCategory]=useState(Object.keys(data.rates)[0]??''),[delta,setDelta]=useState('0');
  async function clock(eventId:string) {
    setBusy(true);setError('');try{const r=await fetch(`/api${base}/season`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'clock',eventId,expectedRevision:data.clock.revision})});const v=await r.json();if(!r.ok)throw Error(v.error);router.refresh();}catch(e){setError(e instanceof Error?e.message:'Replay failed.');}finally{setBusy(false);}
  }
  const rates=data.rates[category] as {federal_per_dollar:number;california_per_dollar:number}|undefined;
  const amount=Number(delta),valid=delta.trim()!==''&&Number.isFinite(amount)&&Math.abs(amount)<=10000000;
  return <>
    <section className="section-panel season-panel"><span className="eyebrow">ORIGINAL ENGINE HISTORY</span><h2>History & Scenarios</h2><p>Compare immutable computed results. A scenario is an isolated supplied result; selecting it does not update the workpaper or simulate a new engine run.</p>
      <div className="version-cards">{data.versions.map(v=><article className="summary-card" key={v.version}><h3>{v.version} · {v.lineCount} lines</h3><time>{v.computed_at}</time><p>{v.trigger}</p><details><summary>Original summary & changes from previous</summary><pre className="reference-record">{JSON.stringify({summary:v.summary,changes_from_previous:v.changes_from_previous},null,2)}</pre></details></article>)}</div>
      {!data.versions.length&&<p className="evidence-gap">No return had been computed at this date. Advance to tl-04 or later to inspect a return.</p>}
      <form className="search-form" method="get"><label>Compare from<select name="before" defaultValue={data.comparison?.before??data.versions[0]?.version}>{data.versions.map(v=><option key={v.version}>{v.version}</option>)}</select></label><label>Compare to<select name="after" defaultValue={data.comparison?.after??data.versions.at(-1)?.version}>{data.versions.map(v=><option key={v.version}>{v.version}</option>)}</select></label><button className="button secondary" disabled={data.versions.length<1}>Compare versions</button></form>
      {data.comparison&&<details open><summary>{data.comparison.before} → {data.comparison.after} · {data.comparison.lines.length} changed line records</summary><p className="fine-print">Trace links open your header-selected computed version. Comparing versions does not change that saved preference.</p><div className="table-scroll season-diffs"><table><thead><tr><th>Line</th><th>Before</th><th>After</th><th>Numeric delta</th><th>Reference changes</th></tr></thead><tbody>{data.comparison.lines.map(l=><tr key={l.key}><td><Link href={`${base}/return?ref=${encodeURIComponent(l.key)}&line=${encodeURIComponent(l.key)}`}>{l.key}</Link><small className="cell-detail">{l.change} · {l.label}</small></td><td>{displayValue(l.old)}</td><td>{displayValue(l.new)}</td><td>{displayValue(l.delta)}</td><td>{l.inputsChanged?'Inputs changed. ':''}{l.sourcesChanged?'Sources changed.':''}</td></tr>)}</tbody></table></div></details>}
    </section>
    <section className="section-panel season-panel"><h2>Five supplied alternatives</h2><div className="scenario-links">{data.alternatives.map(a=><Link key={a.id} className="button secondary" href={`?scenario=${a.id}`}>{a.name}</Link>)}</div>
      {data.scenario&&<article className="scenario-result"><span className="pill">PRECOMPUTED · ISOLATED</span><h3>{String(data.scenario.name)}</h3><p>{String(data.scenario.description)}</p><p>{String(data.scenario.label)}</p><ScenarioOutcomes scenario={data.scenario}/><details><summary>Original supplied scenario record and changed lines</summary><pre className="reference-record">{JSON.stringify(data.scenario,null,2)}</pre></details></article>}
      <details><summary>Custom rate-based estimate</summary><p>This calculator changes no live state. It multiplies a hypothetical change by the supplied per-dollar rates; it does not recompute a return.</p><div className="search-form"><label>Rate category<select disabled={!Object.keys(data.rates).length} value={category} onChange={e=>setCategory(e.target.value)}>{Object.keys(data.rates).map(k=><option key={k}>{k}</option>)}</select></label><label>Hypothetical dollar change<input disabled={!Object.keys(data.rates).length} type="number" min="-10000000" max="10000000" value={delta} onChange={e=>setDelta(e.target.value)}/></label></div><p role="status">Rate-based estimate only: {!Object.keys(data.rates).length?'No computed rate is available at this source date.':rates&&valid?`federal ${displayValue(Math.round(amount*rates.federal_per_dollar*100)/100)}, California ${displayValue(Math.round(amount*rates.california_per_dollar*100)/100)}. Rates: ${rates.federal_per_dollar} / ${rates.california_per_dollar} per dollar.`:'Enter a finite dollar change and choose a supplied rate.'}</p></details>
      {data.extension&&<details><summary>Supplied extension calculation</summary><pre className="reference-record">{JSON.stringify(data.extension,null,2)}</pre></details>}
    </section>
    <section className="section-panel season-panel"><h2>Season replay · 29 supplied events</h2><p>Source availability: <strong>{data.clock.asOf}</strong>. Replay affects the engagement’s shared source clock. Workpaper decisions and actual activity timestamps persist when you rewind.</p>
      {data.canReplay&&<button className="button secondary" onClick={()=>clock('default')} disabled={busy}>Reset to v3 · June 23</button>}{error&&<p role="alert">{error}</p>}<ol className="season-timeline">{data.timeline.map(e=><li key={e.id}><time>{e.at}</time><strong>{e.id} · {e.event.replaceAll('_',' ')}</strong>{e.available&&<><p>{typeof e.detail==='string'?e.detail:''}</p><div>{Array.isArray(e.refs)&&e.refs.map(ref=><Link key={String(ref)} href={`${base}/return?ref=${encodeURIComponent(String(ref))}`}>{String(ref)} </Link>)}</div></>}{data.canReplay&&<button className="button secondary" onClick={()=>clock(e.id)} disabled={busy} aria-label={`Replay through ${e.id}`}>View at this event</button>}</li>)}</ol>
    </section>
  </>;
}

type ScenarioOutcome={base:Record<string,number>;alternative:Record<string,number>;total_tax_change:number;penalty_change?:number};
function ScenarioOutcomes({scenario}:{scenario:unknown}) {
  const outcomes=scenario as {federal:ScenarioOutcome;california:ScenarioOutcome};
  const labels:Record<string,string>={agi:'Adjusted gross income',total_agi:'Total adjusted gross income',ca_agi:'California-source AGI',taxable_income:'Taxable income',total_tax:'Total tax',payments:'Payments',balance_due:'Balance due / (refund)',penalty:'Penalty'};
  const money=(v:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v);
  return <div className="scenario-outcomes">{(['federal','california'] as const).map(jurisdiction=>{
    const result=outcomes[jurisdiction];return <section key={jurisdiction}><h4>{jurisdiction==='federal'?'Federal':'California'} · supplied outcome</h4><div className="table-scroll"><table><thead><tr><th>Measure</th><th>Base v3</th><th>Alternative</th></tr></thead><tbody>{Object.entries(result.alternative).map(([key,value])=><tr key={key}><th scope="row">{labels[key]??key.replaceAll('_',' ')}</th><td>{money(result.base[key])}</td><td>{money(value)}</td></tr>)}</tbody></table></div><p>Total tax change: <strong>{money(result.total_tax_change)}</strong>{typeof result.penalty_change==='number'&&<> · Penalty change: {money(result.penalty_change)}</>}</p></section>;
  })}</div>;
}
