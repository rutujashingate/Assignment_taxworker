import 'server-only';
import { createHash } from 'node:crypto';
import { pool } from '../db/client';
import type { Actor } from '../db/schema';
import { assertStaff, authorizeEngagement, HttpError } from '../auth/permissions';
import { isAvailable } from '../packet/availability';
import { createEvidenceRedactor } from '../evidence/privacy';
import { createEvidenceIndex } from '../evidence/resolver';
import { runIndependentChecks } from '../review/checks';
import { PACKET_SHA256 } from '../packet/schema';
import { readClock } from './clock';
import { sourcePacket, snapshotDigest, filingSourceDateSql, type FilingRow } from './service';

const escape=(value:unknown)=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const record=(value:unknown)=>`<pre>${escape(JSON.stringify(value,null,2))}</pre>`;
export function offlineHtml(title:string,body:string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; form-action 'none'; base-uri 'none'"><title>${escape(title)}</title><style>body{font:16px/1.6 Georgia,serif;color:#18392d;background:#faf9f4;max-width:960px;margin:40px auto;padding:24px}h1,h2,h3{line-height:1.2}section{border-top:1px solid #becac0;padding:20px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.6 monospace;background:#fff;padding:18px;border:1px solid #d8ded7}.notice{padding:16px;border:2px solid #ad773b}a{color:#245742}small{color:#526258}@media print{body{margin:0;background:white}section{break-inside:avoid}}</style></head><body><h1>${escape(title)}</h1>${body}<footer><small>Self-contained evidence record. No network, scripts, remote files or filing integration required.</small></footer></body></html>`;
}
export async function exportSeason(actor:Actor,clientId:string,taxYear:number,kind:string,id?:string) {
  await authorizeEngagement(actor,clientId,taxYear);
  const packet=await sourcePacket(clientId,taxYear),clock=await readClock(clientId,taxYear),redact=createEvidenceRedactor(packet);
  let title:string,body:string,refs:string[]=[];
  if(kind==='client') {
    if(!id||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(id))throw new HttpError(400,'Choose a filing simulation.');
    const row=(await pool.query<FilingRow>(`SELECT f.* FROM filing_simulation f WHERE id=$1 AND client_id=$2 AND tax_year=$3 AND ${filingSourceDateSql}<=$4::timestamptz`,[id,clientId,taxYear,clock.asOf])).rows[0];
    if(!row)throw new HttpError(404,'Filing simulation not found.');
    if(!row.snapshot)throw new HttpError(409,'Submit a simulation before exporting its snapshot.');
    if(snapshotDigest(row.snapshot)!==row.snapshot_hash)throw new HttpError(409,'Snapshot integrity validation failed.');
    title='CL-20417 · 2025 client simulation summary';
    // Deliberate allow-list. Never serialize snapshot.model, exceptions, internal
    // notes, attestations, evidence payloads, firm credentials or full source JSON.
    const safe={simulated:true,status:row.status,snapshotHash:row.snapshot_hash,baseVersion:'v3',computedAt:row.snapshot.computedAt,
      originalEngineSummary:row.snapshot.summary,modeledEstimates:row.snapshot.estimates,approval:row.approval?{at:row.approval.at,source:row.approval.source}:null};
    body=`<p class="notice">INTERNAL SIMULATION — no real filing or regulated signature. Original v3 engine results remain unchanged. Rate-based effects are estimates; no accurate final filed liability is asserted.</p>${record(redact(safe))}`;
  }else if(kind==='notice') {
    assertStaff(actor);
    const noticeDoc=packet.documents.find(d=>d.id==='D72');
    if(!noticeDoc||!isAvailable(noticeDoc.received_at,clock.asOf))throw new HttpError(404,'The examination letter has not arrived at this source date.');
    const notice=(packet.tax_agency_records.notices as Record<string,unknown>[]).find(n=>n.document===noticeDoc.id);
    const index=createEvidenceIndex(packet,'v3',clock.asOf);
    // Traverse actual supplied line sources; additional contextual records are
    // included by document type, not invented field-to-line relationships.
    const sourceDocs=new Set<string>(['D72']);
    for(const line of ['SchA.12','SchA.11','SchC.1']) {
      const visit=(ref:string,seen=new Set<string>())=>{
        if(seen.has(ref))return;seen.add(ref);const r=index.resolve(ref);if(r.status!=='resolved')return;
        if(r.kind==='document')sourceDocs.add(r.document.id);
        if(r.kind==='page')sourceDocs.add(r.documentId);
        if(r.kind==='extracted_value')sourceDocs.add(r.extraction.document_id);
        r.relatedRefs.forEach(x=>visit(x,seen));
      };visit(line);
    }
    for(const d of index.documents.values())if(/transaction detail/i.test(d.title)||/1098-C|noncash|donation|donat/i.test(`${d.title} ${d.document_type}`))sourceDocs.add(d.id);
    const documents=packet.documents.filter(d=>sourceDocs.has(d.id)&&index.documents.has(d.id));
    refs=documents.flatMap(d=>d.pages.map(p=>`doc:${d.id}#page${p.page}`));
    const relatedQuestions=(await pool.query("SELECT id,title,source_refs FROM collaboration_item WHERE client_id=$1 AND tax_year=$2 AND audience='client'",[clientId,taxYear])).rows
      .filter(q=>(q.source_refs as string[]).some(r=>refs.includes(r)||documents.some(d=>r===d.id||packet.extracted_values.some(v=>v.id===r&&v.document_id===d.id))));
    const answers=relatedQuestions.length?(await pool.query("SELECT m.id,m.body,m.created_at,m.created_by,m.item_id FROM collaboration_message m WHERE m.kind='answer' AND m.item_id=ANY($1::uuid[]) ORDER BY m.created_at,m.id",[relatedQuestions.map(q=>q.id)])).rows.map(a=>({...a,created_at:a.created_at.toISOString()})):[];
    const scripted=packet.client.messages.filter(m=>m.id==='msg-08'&&isAvailable(String(m.sent_at),clock.asOf));
    const snapshots=(await pool.query('SELECT id,snapshot_hash,snapshot FROM filing_simulation WHERE client_id=$1 AND tax_year=$2 AND status=$3 ORDER BY created_at',[clientId,taxYear,'accepted'])).rows;
    title='Draft response evidence · IRS Letter 566 · 2025';
    const findings=runIndependentChecks(index).filter(f=>['business','charity'].includes(f.taxArea)&&f.outcome!=='pass');
    body=`<p class="notice">DRAFT FOR CPA REVIEW — self-contained supporting evidence, not an IRS submission. No engine rerun exists. Source discrepancies and substantiation gaps remain explicit; simulation acceptance does not establish tax accuracy.</p><section><h2>Examination request</h2>${record(redact(notice))}<p>Received ${escape(noticeDoc.received_at)}; source clock ${escape(clock.asOf)}. Original packet SHA-256: ${PACKET_SHA256}.</p></section>
      <section><h2>Schedule C receipts reconciliation</h2><p>D14 books report $151,300. D15 page 3 says Atlas's $41,200 includes $12,400 through Paywell and $28,800 by ACH. Forms 1099-NEC D16–D20 total $142,000; D15 also reports $9,300 of deposits from clients who issued no Form 1099, reconciling to $151,300 in books receipts. D21's $12,400 must be reconciled to the included deposits. Original v3 SchC.1 is $163,700; the engine added the card receipts. This evidence supports review of the overlap and does not by itself prove a corrected filed return.</p></section>
      <section><h2>Charitable contributions and limitations</h2><p>D65 acknowledges 200 fund shares: donor-record transfer valuation $14,500 (200 × $72.50), acquired April 2019, basis $9,300, no goods or services. D66 states vehicle sale proceeds of $2,900; compare the original Form 8283/SchA.12 treatment before representing an allowable deduction. D64's handwritten first digit remains ambiguous in the source image representation. Its pipeline reading is not proof. Later client confirmation is reproduced separately.</p>${record(redact(['SchA.11','SchA.12','F8283.A1.stock','F8283.A1.vehicle'].map(k=>{const l=index.lines.get(k);return {key:k,value:l?.value,inputs:l?.inputs,sources:l?.sources};})))}</section>
      <section><h2>Known evidence gaps and independent findings</h2>${record(redact(findings))}</section>
      <section><h2>Later dated evidence</h2>${record(redact({scriptedClientMessages:scripted,linkedQuestions:relatedQuestions,workpaperAnswers:answers,description:'Human answers are dated evidence, not engine recalculations.'}))}</section>
      <section><h2>Frozen simulated return reference</h2>${snapshots.length?record(redact(snapshots.map(s=>({id:s.id,hash:s.snapshot_hash,originalEngineSummary:s.snapshot.summary,modeledEstimates:s.snapshot.estimates})))):'<p>No frozen accepted snapshot exists. Filed amounts cannot be established by this export.</p>'}</section>
      <section><h2>Evidence index</h2>${documents.map(d=>`<p><a href="#${escape(d.id)}">${escape(d.id)} · ${escape(d.title)}</a> · ${escape(d.received_at)}</p>`).join('')}</section>
      ${documents.map(d=>`<section id="${escape(d.id)}"><h2>${escape(d.id)} · ${escape(d.title)}</h2><p>Source representation from printed_content; no original PDF or OCR precision is asserted. Extraction: ${escape(d.extraction.status)}.</p>${d.pages.map(p=>`<h3>${escape(`doc:${d.id}#page${p.page}`)}</h3><pre>${escape(redact(p.printed_content))}</pre><details><summary>Separate pipeline readings · unverified</summary>${record(redact(index.pageValues(d.id,p.page).map(v=>({ref:v.id,field:v.field,value:v.value,textAsRead:v.text_as_read,confidence:v.confidence,humanVerification:'Not recorded'}))))}</details>`).join('')}</section>`).join('')}`;
  }else throw new HttpError(400,'Choose a client or notice export.');
  const html=offlineHtml(title,body),sha256=createHash('sha256').update(html).digest('hex');
  await pool.query('INSERT INTO audit_event(actor_id,client_id,tax_year,action,target,before_json,after_json) VALUES($1,$2,$3,$4,$5,null,$6)',[actor.id,clientId,taxYear,`simulation_${kind}_exported`,id??'D72',JSON.stringify({sha256,asOf:clock.asOf,refs,masked:true})]);
  return {html,sha256,filename:kind==='notice'?'CL-20417-2025-Letter566-evidence.html':'CL-20417-2025-client-simulation.html'};
}
