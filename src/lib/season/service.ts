import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { pool } from '../db/client';
import type { Actor } from '../db/schema';
import { assertStaff, authorizeEngagement, HttpError } from '../auth/permissions';
import { DEFAULT_AS_OF, type Packet } from '../packet/schema';
import { isAvailable, availableAgencyRecords, availableClientEvidence } from '../packet/availability';
import { createEvidenceIndex } from '../evidence/resolver';
import { createEvidenceRedactor } from '../evidence/privacy';
import { runIndependentChecks } from '../review/checks';
import { compareVersions, replayEvents, rateEstimate, SCENARIO_NAMES } from './models';
import { readClock } from './clock';

export type Adjustment={line:string;delta:number;category:string;reason:string;refs:string[]};
export type FilingModel={adjustments:Adjustment[];exceptions:{key:string;reason:string;refs:string[]}[];simulationAcknowledged:boolean};
type Attestation={actorId:string;fingerprint:string;at:string};
export type FilingRow={id:string;client_id:string;tax_year:number;parent_id:string|null;status:string;revision:number;model:FilingModel;
  attestations:Record<string,Attestation>;approval:{actorId:string;fingerprint:string;at:string;source:string}|null;
  correction:{ref:string;at:string;targetRef?:string;extractionRef?:string;ssn?:string;previousValueHash?:string}|null;snapshot:Record<string,unknown>|null;snapshot_hash:string|null;created_by:string;created_at:Date;updated_at:Date};
function canonical(value:unknown):unknown {if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));return value;}
export const snapshotDigest=(v:unknown)=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const digest=snapshotDigest;
export async function sourcePacket(clientId:string,taxYear:number,executor=pool) {
  const {rows}=await executor.query('SELECT p.raw_json FROM engagement e JOIN packet_import p USING(packet_hash) WHERE e.client_id=$1 AND e.tax_year=$2',[clientId,taxYear]);
  if(!rows[0])throw new HttpError(404,'Engagement not found.');
  return rows[0].raw_json as Packet;
}
async function audit(tx:PoolClient,actor:Actor,clientId:string,taxYear:number,action:string,target:string,before:unknown,after:unknown) {
  await tx.query('INSERT INTO audit_event(actor_id,client_id,tax_year,action,target,before_json,after_json) VALUES($1,$2,$3,$4,$5,$6,$7)',[actor.id,clientId,taxYear,action,target,JSON.stringify(before),JSON.stringify(after)]);
}
const taxRoles=['preparer','reviewer','partner','quality_reviewer'];
// Static SQL fragment, never user-provided SQL. A later replay cannot become
// previously available simply by rewinding. Rows stay persisted and reappear
// when their recorded source date is available again.
export const filingSourceDateSql="(SELECT coalesce(max((ev.record->>'asOf')::timestamptz),'2026-06-23T06:05:00Z'::timestamptz) FROM filing_simulation_event ev WHERE ev.filing_id=f.id)";
function taxStaff(actor:Actor){assertStaff(actor);if(!taxRoles.includes(actor.role))throw new HttpError(403,'A tax professional must perform this action.');}
const adjustment=z.strictObject({line:z.string().min(1).max(100),delta:z.number().finite().min(-10000000).max(10000000),category:z.string().max(50),reason:z.string().trim().min(10).max(2000),refs:z.array(z.string().max(500)).min(1).max(20)});
const modelSchema=z.strictObject({adjustments:z.array(adjustment).max(100),exceptions:z.array(z.strictObject({key:z.string().max(200),reason:z.string().trim().min(10).max(2000),refs:z.array(z.string().max(500)).min(1).max(20)})).max(100),simulationAcknowledged:z.boolean()});
const commandSchema=z.discriminatedUnion('action',[
  z.strictObject({action:z.literal('clock'),eventId:z.string().max(60),expectedRevision:z.number().int().min(0)}),
  z.strictObject({action:z.literal('create'),parentId:z.string().uuid().nullable()}),
  z.strictObject({action:z.literal('model'),id:z.string().uuid(),expectedRevision:z.number().int().positive(),model:modelSchema}),
  ...(['attest','approve','scripted_approval','submit','correct_identity','response'] as const).map(action=>z.strictObject({action:z.literal(action),id:z.string().uuid(),expectedRevision:z.number().int().positive()})),
]);

async function readiness(tx:PoolClient,row:FilingRow,packet:Packet,asOf:string) {
  const version=packet.return_versions.find(v=>v.version==='v3')!;
  if(!isAvailable(version.computed_at,asOf))return {ready:false,blockers:['v3 is not available at this source date.'],fingerprint:'',findings:[]};
  const index=createEvidenceIndex(packet,'v3',asOf);
  const findings=runIndependentChecks(index).filter(c=>c.outcome!=='pass');
  const scope=[row.client_id,row.tax_year];
  // Locks existing review-note/issue rows until submission or acceptance commits.
  const notes=await tx.query("SELECT id,revision,status FROM collaboration_item WHERE client_id=$1 AND tax_year=$2 AND kind='review_note' AND blocks_filing AND status<>'closed' ORDER BY id FOR SHARE",scope);
  const issues=await tx.query("SELECT issue_key,revision,status FROM workpaper_issue WHERE client_id=$1 AND tax_year=$2 AND version='v3' ORDER BY issue_key FOR SHARE",scope);
  const collaboration=await tx.query('SELECT id,revision FROM collaboration_item WHERE client_id=$1 AND tax_year=$2 ORDER BY id FOR SHARE',scope);
  const lotReviews=await tx.query("SELECT line_key,revision FROM sales_lot_review WHERE client_id=$1 AND tax_year=$2 AND version='v3' ORDER BY line_key FOR SHARE",scope);
  const standards=await tx.query('SELECT s.revision FROM firm_standard s JOIN engagement e USING(packet_hash) WHERE e.client_id=$1 AND e.tax_year=$2',scope);
  const current=new Map(issues.rows.map(i=>[i.issue_key,i]));
  const remaining=findings.filter(f=>current.get(f.key)?.status!=='resolved_with_evidence');
  const blockers:string[]=[];
  if(notes.rows.length)blockers.push(`${notes.rows.length} open blocking review note(s).`);
  for(const f of remaining)if(!row.model.exceptions.some(e=>e.key===f.key))blockers.push(`Record an evidenced simulation exception: ${f.title}`);
  if(!row.model.simulationAcknowledged)blockers.push('Explicitly acknowledge this simulation and its unresolved tax accuracy limitations.');
  const fingerprint=digest({packet:packet.packet.version,base:'v3',model:row.model,correction:row.correction,issues:issues.rows,notes:notes.rows,collaboration:collaboration.rows,lotReviews:lotReviews.rows,standards:standards.rows,
    // Newly available evidence invalidates approvals even when engine lines stay unchanged.
    documents:[...index.documents.keys()],client:availableClientEvidence(packet.client,asOf),parent:row.parent_id});
  for(const role of ['reviewer','partner'])if(row.attestations[role]?.fingerprint!==fingerprint)blockers.push(`Current ${role} simulation approval required.`);
  if(row.attestations.reviewer?.actorId===row.attestations.partner?.actorId&&row.attestations.partner)blockers.push('Reviewer and partner must be different people.');
  if(row.approval?.fingerprint!==fingerprint)blockers.push('Current client approval and demonstration e-file authorization required.');
  return {ready:blockers.length===0,blockers,fingerprint,findings:remaining.map(f=>({key:f.key,title:f.title,severity:f.severity,inputRefs:f.inputRefs}))};
}
export async function getSeason(actor:Actor,clientId:string,taxYear:number,options:{before?:string;after?:string;scenario?:string}={}) {
  assertStaff(actor);await authorizeEngagement(actor,clientId,taxYear);
  const packet=await sourcePacket(clientId,taxYear);const clock=await readClock(clientId,taxYear);
  const redact=createEvidenceRedactor(packet);
  const versions=packet.return_versions.filter(v=>isAvailable(v.computed_at,clock.asOf));
  const a=versions.find(v=>v.version===(options.before??'v2')),b=versions.find(v=>v.version===(options.after??'v3'));
  const latest=versions.at(-1);
  const scenario=options.scenario?packet.what_if.alternatives.find(a=>a.id===options.scenario):null;
  if(options.scenario&&(!scenario||!versions.some(v=>v.version==='v3')))throw new HttpError(404,'Scenario unavailable at this source date.');
  return redact({clock,versions:versions.map(v=>({version:v.version,computed_at:v.computed_at,trigger:v.trigger,summary:v.summary,changes_from_previous:v.changes_from_previous,lineCount:v.lines.length})),
    comparison:a&&b?{before:a.version,after:b.version,lines:compareVersions(a,b)}:null,
    alternatives:versions.some(v=>v.version==='v3')?packet.what_if.alternatives.map(a=>({id:String(a.id),name:SCENARIO_NAMES[String(a.id)],description:String(a.description)})):[],
    scenario:scenario?{...scenario,description:String(scenario.description),name:SCENARIO_NAMES[String(scenario.id)],label:'Supplied precomputed alternative · isolated from the live workpaper'}:null,
    rates:latest?.tax_effect_rates??{},timeline:replayEvents(packet,clock.asOf),extension:isAvailable(String(packet.what_if.extension.computed_at),clock.asOf)?packet.what_if.extension:null,
    canOperate:taxRoles.includes(actor.role),canReplay:['reviewer','partner','quality_reviewer'].includes(actor.role)});
}
function clientView(row:FilingRow,gate:Awaited<ReturnType<typeof readiness>>,packet:Packet) {
  // No internal exceptions, modeled reasons, assignees, notes, or audit payloads.
  return {id:row.id,parentId:row.parent_id,status:row.status,revision:row.revision,simulated:true,
    accuracy:'Demonstration only. Engine v3 is unchanged; modeled tax effects are estimates. No real return has been filed.',
    approval:row.approval?{at:row.approval.at,source:row.approval.source,current:gate?row.approval.fingerprint===gate.fingerprint:false}:null,
    originalEngineSummary:packet.return_versions[2].summary,
    modeledEstimates:row.model.adjustments.map(a=>rateEstimate(packet.return_versions[2],a.category,a.delta)),
    proposalHash:gate.fingerprint,snapshotHash:row.snapshot_hash,createdAt:row.created_at.toISOString()};
}
export async function getFilings(actor:Actor,clientId:string,taxYear:number) {
  await authorizeEngagement(actor,clientId,taxYear);const packet=await sourcePacket(clientId,taxYear),clock=await readClock(clientId,taxYear);
  const redact=createEvidenceRedactor(packet);const tx=await pool.connect();
  try {
    await tx.query('BEGIN');
    const rows=(await tx.query<FilingRow>(`SELECT f.* FROM filing_simulation f WHERE client_id=$1 AND tax_year=$2 AND ${filingSourceDateSql}<=$3::timestamptz ORDER BY created_at,id`,[clientId,taxYear,clock.asOf])).rows;
    const availableEfile=availableAgencyRecords(packet.tax_agency_records,new Map(packet.documents.map(d=>[d.id,d.received_at])),clock.asOf).efile as {jurisdiction:string;status:string}[];
    const filings=[];
    for(const row of rows) {
      const gate=await readiness(tx,row,packet,clock.asOf);
      if(actor.role==='client'){filings.push(clientView(row,gate,packet));continue;}
      const events=(await tx.query('SELECT action,record,created_at FROM filing_simulation_event WHERE filing_id=$1 ORDER BY id',[row.id])).rows.map(e=>({action:e.action,record:e.record,createdAt:e.created_at.toISOString()}));
      const parent=row.parent_id?rows.find(r=>r.id===row.parent_id):null;
      filings.push({...clientView(row,gate,packet),model:row.model,attestations:row.attestations,correction:row.correction,readiness:gate,createdBy:row.created_by,
        nextResponseAvailable:!row.parent_id&&availableEfile.some(e=>row.status==='federal_accepted'?e.jurisdiction==='california'&&e.status==='accepted':row.correction?e.jurisdiction==='federal'&&e.status==='accepted':e.jurisdiction==='federal'&&e.status==='rejected'),
        snapshot:row.snapshot,events,amendmentDiff:parent?{parentHash:parent.snapshot_hash,before:parent.model.adjustments,after:row.model.adjustments,
          lines:[...new Set([...parent.model.adjustments,...row.model.adjustments].map(a=>a.line))].flatMap(key=>{
            const oldDelta=parent.model.adjustments.find(a=>a.line===key)?.delta??0,newDelta=row.model.adjustments.find(a=>a.line===key)?.delta??0;
            const original=packet.return_versions[2].lines.find(l=>l.key===key)?.value;
            return oldDelta===newDelta?[]:[{key,originalV3:original,previousModeledDelta:oldDelta,amendmentModeledDelta:newDelta,delta:newDelta-oldDelta,
              previousModeledValue:typeof original==='number'?original+oldDelta:null,amendmentModeledValue:typeof original==='number'?original+newDelta:null}];
          })}:null});
    }
    await tx.query('COMMIT');
    return redact({clock,filings,client:actor.role==='client',actorId:actor.id,role:actor.role,canCorrectIdentity:actor.sensitiveDataClearance&&taxRoles.includes(actor.role),
      canCreate:['preparer','quality_reviewer'].includes(actor.role)&&isAvailable(packet.return_versions[2].computed_at,clock.asOf),
      identityCorrectionAvailable:packet.documents.some(d=>d.id==='D71'&&isAvailable(d.received_at,clock.asOf)),
      approvalAvailable:isAvailable(String(packet.client.messages.find(m=>m.id==='msg-09')?.sent_at),clock.asOf),
      noticeAvailable:packet.documents.some(d=>d.id==='D72'&&isAvailable(d.received_at,clock.asOf)),
      warning:'Internal simulation only. Phase 4 corrections and production sign-offs are unavailable. Exceptions do not resolve Review Desk findings.'});
  }catch(e){await tx.query('ROLLBACK');throw e;}finally{tx.release();}
}

export async function seasonCommand(actor:Actor,clientId:string,taxYear:number,input:unknown) {
  await authorizeEngagement(actor,clientId,taxYear);
  const parsed=commandSchema.safeParse(input);if(!parsed.success)throw new HttpError(400,'Provide a valid season action and current revision.');
  const c=parsed.data;
  if(c.action!=='approve')taxStaff(actor);
  else if(actor.role!=='client')throw new HttpError(403,'Only a client may authorize their demonstration filing.');
  const packet=await sourcePacket(clientId,taxYear);
  const tx=await pool.connect();
  try {
    await tx.query('BEGIN');await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`season:${clientId}:${taxYear}`]);
    const clockRows=(await tx.query('SELECT as_of,revision FROM season_clock WHERE client_id=$1 AND tax_year=$2 FOR UPDATE',[clientId,taxYear])).rows;
    const asOf=clockRows[0]?.as_of.toISOString().replace(".000Z","Z")??DEFAULT_AS_OF,clockRevision=Number(clockRows[0]?.revision??0);
    if(!isAvailable(actor.activeFrom,asOf))throw new HttpError(403,'This identity is not active at the current source date.');
    if(c.action==='clock') {
      if(!['reviewer','partner','quality_reviewer'].includes(actor.role))throw new HttpError(403,'A reviewer or partner controls season replay.');
      if(c.expectedRevision!==clockRevision)throw new HttpError(409,'The season clock changed. Reload before replaying.');
      const event=packet.timeline.find(e=>e.id===c.eventId);
      const next=c.eventId==='default'?DEFAULT_AS_OF:event?.at;
      if(typeof next!=='string')throw new HttpError(400,'Choose a supplied timeline event.');
      if(!isAvailable(actor.activeFrom,next))throw new HttpError(409,'Switch to an identity active at the target date before rewinding.');
      await tx.query('INSERT INTO season_clock(client_id,tax_year,as_of,revision,updated_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(client_id,tax_year) DO UPDATE SET as_of=excluded.as_of,revision=excluded.revision,updated_by=excluded.updated_by',[clientId,taxYear,next,clockRevision+1,actor.id]);
      await audit(tx,actor,clientId,taxYear,'season_clock_changed','season_clock',{asOf,revision:clockRevision},{asOf:next,revision:clockRevision+1,eventId:c.eventId});
      await tx.query('COMMIT');return {asOf:next,revision:clockRevision+1};
    }
    if(!isAvailable(packet.return_versions[2].computed_at,asOf))throw new HttpError(409,'Filing simulations require the supplied v3 return.');
    if(c.action==='create') {
      if(!['preparer','quality_reviewer'].includes(actor.role))throw new HttpError(403,'A preparer creates the simulation; the separate reviewer and partner supply approvals.');
      let inheritedCorrection:FilingRow['correction']=null;
      let model:FilingModel={adjustments:[],exceptions:[],simulationAcknowledged:false};
      if(c.parentId) {
        const parent=(await tx.query<FilingRow>(`SELECT f.* FROM filing_simulation f WHERE id=$1 AND client_id=$2 AND tax_year=$3 AND status='accepted' AND ${filingSourceDateSql}<=$4::timestamptz FOR SHARE`,[c.parentId,clientId,taxYear,asOf])).rows[0];
        if(!parent)throw new HttpError(409,'An amendment requires a frozen accepted simulation in this engagement.');
        model=structuredClone(parent.model);model.simulationAcknowledged=false;inheritedCorrection=parent.correction;
      }
      const id=randomUUID();
      await tx.query("INSERT INTO filing_simulation(id,client_id,tax_year,parent_id,status,revision,model,created_by,correction) VALUES($1,$2,$3,$4,'draft',1,$5,$6,$7)",[id,clientId,taxYear,c.parentId,JSON.stringify(model),actor.id,inheritedCorrection?JSON.stringify(inheritedCorrection):null]);
      await tx.query('INSERT INTO filing_simulation_event(filing_id,actor_id,action,record) VALUES($1,$2,$3,$4)',[id,actor.id,'create',JSON.stringify({asOf,parentId:c.parentId,simulated:true})]);
      await audit(tx,actor,clientId,taxYear,c.parentId?'amendment_simulation_created':'filing_simulation_created',id,null,{parentId:c.parentId});
      await tx.query('COMMIT');return {id,revision:1};
    }
    const row=(await tx.query<FilingRow>(`SELECT f.* FROM filing_simulation f WHERE id=$1 AND client_id=$2 AND tax_year=$3 AND ${filingSourceDateSql}<=$4::timestamptz FOR UPDATE`,[c.id,clientId,taxYear,asOf])).rows[0];
    if(!row)throw new HttpError(404,'Filing simulation not found.');
    if(row.revision!==c.expectedRevision)throw new HttpError(409,'This filing changed in another window. Reload before retrying.');
    if(row.status==='accepted'||(row.status==='federal_accepted'&&c.action!=='response'))throw new HttpError(409,'Accepted snapshot is frozen. Create an amendment branch.');
    const before={status:row.status,revision:row.revision,model:row.model};
    const index=createEvidenceIndex(packet,'v3',asOf);
    if(c.action==='model') {
      if(row.status!=='draft')throw new HttpError(409,'Only a draft simulation can be edited.');
      const validFindings=runIndependentChecks(index).filter(c=>c.outcome!=='pass');
      for(const entry of [...c.model.adjustments,...c.model.exceptions]) {
        for(const ref of entry.refs)if(index.resolve(ref).status!=='resolved')throw new HttpError(400,'Evidence must resolve at the selected source date.');
        if('line' in entry) {
          if(typeof index.lines.get(entry.line)?.value!=='number')throw new HttpError(400,'Choose an actual numeric v3 line.');
          try{rateEstimate(packet.return_versions[2],entry.category,entry.delta);}catch{throw new HttpError(400,'Choose a supplied tax-effect rate.');}
        }else {
          const finding=validFindings.find(f=>f.key===entry.key);
          if(!finding||!entry.refs.some(ref=>finding.inputRefs.includes(ref)))throw new HttpError(400,'Each simulation exception needs a related finding source.');
        }
      }
      if(new Set(c.model.adjustments.map(a=>a.line)).size!==c.model.adjustments.length||new Set(c.model.exceptions.map(a=>a.key)).size!==c.model.exceptions.length)throw new HttpError(400,'Duplicate modeled lines or exceptions are not allowed.');
      if(!actor.sensitiveDataClearance&&JSON.stringify(createEvidenceRedactor(packet)(c.model))!==JSON.stringify(c.model))throw new HttpError(403,"A cleared staff member must enter protected identifiers.");
      row.model=c.model;row.attestations={};row.approval=null;
    }
    const gate=await readiness(tx,row,packet,asOf);
    if(c.action==='attest') {
      if(!['reviewer','partner'].includes(actor.role)||row.created_by===actor.id)throw new HttpError(403,'A separate reviewer or partner must approve this simulation.');
      if(row.status!=='draft')throw new HttpError(409,'Simulation approval is limited to drafts.');
      row.attestations[actor.role]={actorId:actor.id,fingerprint:gate.fingerprint,at:new Date().toISOString()};
    }
    if(c.action==='approve'||c.action==='scripted_approval') {
      if(row.status!=='draft')throw new HttpError(409,'Only a draft can receive approval.');
      const message=packet.client.messages.find(m=>m.id==='msg-09');
      if(!message||!isAvailable(String(message.sent_at),asOf))throw new HttpError(409,'The scripted client approval is not available yet.');
      if(c.action==='scripted_approval'&&!['reviewer','partner'].includes(actor.role))throw new HttpError(403,'A reviewer or partner may link the scripted authorization.');
      row.approval={actorId:actor.id,fingerprint:gate.fingerprint,at:new Date().toISOString(),source:c.action==='approve'?'Client demonstration authorization':'Scripted msg-09 · not a regulated signature'};
    }
    if(c.action==='submit') {
      if(!['draft','rejected'].includes(row.status))throw new HttpError(409,'This simulation has already been submitted.');
      if(!gate.ready)throw new HttpError(409,`Simulation readiness blocked: ${gate.blockers.join(' ')}`);
      if(row.status==='rejected'&&!row.correction)throw new HttpError(409,'Link the available D71 correction before resubmitting.');
      row.status='submitted';
      row.snapshot={simulated:true,accuracy:'Unchanged v3 engine outputs plus separate modeled estimates; no engine rerun or actual filing.',
        baseVersion:'v3',computedAt:packet.return_versions[2].computed_at,summary:packet.return_versions[2].summary,
        lines:packet.return_versions[2].lines,model:row.model,estimates:row.model.adjustments.map(a=>rateEstimate(packet.return_versions[2],a.category,a.delta)),
        approval:row.approval,attestations:row.attestations,correction:row.correction,asOf,parentId:row.parent_id,packetHash:(await tx.query('SELECT packet_hash FROM engagement WHERE client_id=$1 AND tax_year=$2',[clientId,taxYear])).rows[0].packet_hash};
      row.snapshot_hash=digest(row.snapshot);
    }
    if(c.action==='correct_identity') {
      if(!actor.sensitiveDataClearance)throw new HttpError(403,'Sensitive-data clearance is required to apply an identity correction.');
      if(row.status!=='rejected')throw new HttpError(409,'A rejected simulation is required.');
      const correction=packet.documents.find(d=>d.id==='D71');
      if(!correction||!isAvailable(correction.received_at,asOf))throw new HttpError(409,'D71 has not arrived at this source date.');
      const reading=packet.extracted_values.find(v=>v.document_id===correction.id&&v.field==='ssn');
      const person=packet.household.people.find(p=>p.id==='theo');
      if(!reading||typeof reading.value!=='string'||!correction.pages.some(p=>p.printed_content.includes(reading.value as string)))throw new HttpError(409,'The correction must match the supplied printed identity evidence.');
      row.correction={ref:'doc:D71#page1',at:correction.received_at,targetRef:'household:theo',extractionRef:reading.id,ssn:reading.value,previousValueHash:digest(person?.ssn)};
      await audit(tx,actor,clientId,taxYear,'sensitive_document_viewed','D71',null,{reference:reading.id,reason:'Apply supplied identity correction to separate simulation overlay',masked:true});
      // The dependency set changed: require fresh separate approvals.
      row.status='draft';row.attestations={};row.approval=null;row.snapshot=null;row.snapshot_hash=null;
    }
    if(c.action==='response') {
      if(row.parent_id)throw new HttpError(409,'No amended-return acknowledgments are supplied; this amendment remains an isolated simulation.');
      if(!['submitted','federal_accepted'].includes(row.status))throw new HttpError(409,'Submit a simulation before replaying agency responses.');
      if(!row.snapshot||digest(row.snapshot)!==row.snapshot_hash)throw new HttpError(409,'Snapshot integrity validation failed.');
      // Submission already validated current approvals and captured their exact
      // proposal. A later source arrival cannot replace that submitted payload
      // or strand a rejection acknowledgment. New acceptance still honors notes.
      if((row.status==='federal_accepted'||row.correction)&&gate.blockers.some(b=>b.includes('open blocking review note')))throw new HttpError(409,'Open blocking review notes prevent processing acceptance.');
      const agency=availableAgencyRecords(packet.tax_agency_records,new Map(packet.documents.map(d=>[d.id,d.received_at])),asOf);
      const efile=agency.efile as {date:string;status:string;jurisdiction:string;errors?:unknown[]}[];
      if(row.status==='submitted'&&!row.correction) {
        const reject=efile.find(e=>e.jurisdiction==='federal'&&e.status==='rejected');
        if(!reject)throw new HttpError(409,'The scripted rejection has not arrived.');
        row.status='rejected';
      } else if(row.status==='submitted') {
        const accepted=efile.find(e=>e.jurisdiction==='federal'&&e.status==='accepted');
        if(!accepted)throw new HttpError(409,'Federal acceptance has not arrived.');row.status='federal_accepted';
      } else {
        if(!efile.some(e=>e.jurisdiction==='california'&&e.status==='accepted'))throw new HttpError(409,'California acceptance has not arrived.');row.status='accepted';
      }
    }
    row.revision++;
    await tx.query('UPDATE filing_simulation SET status=$2,revision=$3,model=$4,attestations=$5,approval=$6,correction=$7,snapshot=$8,snapshot_hash=$9,updated_at=now() WHERE id=$1',
      [row.id,row.status,row.revision,JSON.stringify(row.model),JSON.stringify(row.attestations),row.approval?JSON.stringify(row.approval):null,row.correction?JSON.stringify(row.correction):null,row.snapshot?JSON.stringify(row.snapshot):null,row.snapshot_hash]);
    const record={status:row.status,revision:row.revision,asOf,simulated:true,snapshotHash:row.snapshot_hash,
      ...(c.action==='response'?{agency:availableAgencyRecords(packet.tax_agency_records,new Map(packet.documents.map(d=>[d.id,d.received_at])),asOf).efile.filter((e:{status:string;jurisdiction:string})=>row.status==='rejected'?['rejected','not_transmitted'].includes(e.status):e.status==='accepted'&&e.jurisdiction===(row.status==='federal_accepted'?'federal':'california'))}:{}),
      ...(c.action==='correct_identity'?{ref:'doc:D71#page1'}:{})};
    await tx.query('INSERT INTO filing_simulation_event(filing_id,actor_id,action,record) VALUES($1,$2,$3,$4)',[row.id,actor.id,c.action,JSON.stringify(record)]);
    await audit(tx,actor,clientId,taxYear,`filing_simulation_${c.action}`,row.id,before,record);
    await tx.query('COMMIT');return {id:row.id,status:row.status,revision:row.revision};
  }catch(e){await tx.query('ROLLBACK');throw e;}finally{tx.release();}
}
