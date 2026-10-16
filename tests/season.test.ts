import { afterAll,beforeAll,expect,test } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pool } from '../src/lib/db/client';
import { setupDatabase,actor } from './helpers';
import { getFilings,getSeason,seasonCommand,sourcePacket,type FilingModel,type FilingRow,snapshotDigest } from '../src/lib/season/service';
import { exportSeason,offlineHtml } from '../src/lib/season/exports';
import { readClock } from '../src/lib/season/clock';
import { compareVersions,replayEvents,rateEstimate } from '../src/lib/season/models';
import { createEvidenceIndex } from '../src/lib/evidence/resolver';
import { getEvidenceWorkspace,documentIndex } from '../src/lib/evidence/queries';
import { globalSearch } from '../src/lib/firm/search';
import { listIdentities } from '../src/lib/auth/session';
import { runIndependentChecks } from '../src/lib/review/checks';
import { collaborationCommand,getCollaborationItem } from '../src/lib/collaboration/service';
import { DEFAULT_AS_OF,PACKET_SHA256 } from '../src/lib/packet/schema';
const client='CL-20417',year=2025;
async function move(eventId:string){const clock=await readClock();return seasonCommand(await actor('st-02'),client,year,{action:'clock',eventId,expectedRevision:clock.revision});}
async function row(id:string){return (await pool.query<FilingRow>('SELECT * FROM filing_simulation WHERE id=$1',[id])).rows[0];}
async function act(id:string,action:string,who='st-01'){return seasonCommand(await actor(who),client,year,{action,id,expectedRevision:(await row(id)).revision});}
async function create(){const r=await seasonCommand(await actor('st-01'),client,year,{action:'create',parentId:null});return (r as {id:string}).id;}
async function modeled(id:string,adjustments:FilingModel['adjustments']=[]){
  const packet=await sourcePacket(client,year),index=createEvidenceIndex(packet,'v3',(await readClock()).asOf);
  const model:FilingModel={simulationAcknowledged:true,adjustments,exceptions:runIndependentChecks(index).filter(c=>c.outcome!=='pass').map(f=>({key:f.key,reason:'Explicit test simulation exception; original evidence discrepancy remains unresolved.',refs:[f.inputRefs[0]]}))};
  await seasonCommand(await actor('st-01'),client,year,{action:'model',id,expectedRevision:(await row(id)).revision,model});
}
async function approvals(id:string){await act(id,'attest','st-02');await act(id,'attest','st-03');await act(id,'approve','cu-01');}
let frozenId='';
beforeAll(async()=>{await setupDatabase();await move('default');});
afterAll(async()=>{await move('default');});

test('actual v1/v2/v3 metadata, values, structural line diffs and source-only changes are preserved',async()=>{
  const packet=await sourcePacket(client,year);expect(packet.return_versions.map(v=>v.lines.length)).toEqual([625,625,627]);
  const changes=compareVersions(packet.return_versions[1],packet.return_versions[2]);
  expect(changes.find(l=>l.key==='F1040.2b')).toMatchObject({old:6330,new:6450,delta:120});
  expect(changes.find(l=>l.key==='SchE.28B')).toMatchObject({change:'added',new:8400});
  const first=compareVersions(packet.return_versions[0],packet.return_versions[1]);expect(first.find(l=>l.key==='F8949.D.M14')).toMatchObject({change:'added',new:855});
  const data=await getSeason(await actor('st-01'),client,year);
  expect(data.versions.map(v=>v.computed_at)).toEqual(packet.return_versions.map(v=>v.computed_at));expect(data.versions[2].changes_from_previous).toEqual(packet.return_versions[2].changes_from_previous);
  expect(compareVersions(packet.return_versions[2],packet.return_versions[2])).toEqual([]);
});
test('all five named alternatives return their exact packet outcomes without changing source or live preferences',async()=>{
  const packet=await sourcePacket(client,year),before=await pool.query('SELECT selected_version,revision FROM workpaper_preference ORDER BY actor_id');
  const expected=[[81962,17824],[92207,18614],[85595,19770],[94268,18874],[81962,18874]];
  for(const [i,a] of packet.what_if.alternatives.entries()){
    const data=await getSeason(await actor('st-01'),client,year,{scenario:String(a.id)});
    expect(data.scenario).toMatchObject(a);const s=data.scenario as unknown as typeof a;
    expect([(s.federal as {alternative:{total_tax:number}}).alternative.total_tax,(s.california as {alternative:{total_tax:number}}).alternative.total_tax]).toEqual(expected[i]);
  }
  expect((await pool.query('SELECT selected_version,revision FROM workpaper_preference ORDER BY actor_id')).rows).toEqual(before.rows);
  expect((await sourcePacket(client,year)).return_versions).toEqual(packet.return_versions);
  expect(rateEstimate(packet.return_versions[2],'interest',-1840)).toMatchObject({federal:-640.32,california:-126.96,label:expect.stringContaining('estimate')});
  expect(()=>rateEstimate(packet.return_versions[2],'unknown',100)).toThrow();
});
test('29-event replay is ordered, non-destructive, revision-checked and filters direct evidence and global search',async()=>{
  try {
    const packet=await sourcePacket(client,year),events=replayEvents(packet,DEFAULT_AS_OF);expect(events).toHaveLength(29);expect(events.filter(e=>e.available)).toHaveLength(17);
    expect(events.map(e=>e.at)).toEqual(events.map(e=>e.at).sort());expect(JSON.stringify(events.filter(e=>!e.available))).not.toContain('41207');expect(JSON.stringify(events.filter(e=>!e.available))).not.toContain('D71');
    await expect(seasonCommand(await actor('st-01'),client,year,{action:'clock',eventId:'tl-29',expectedRevision:(await readClock()).revision})).rejects.toMatchObject({status:403});
    await expect(seasonCommand(await actor('cu-01'),client,year,{action:'clock',eventId:'tl-29',expectedRevision:(await readClock()).revision})).rejects.toMatchObject({status:403});
    await move('tl-04');const prep=await actor('st-01');const old=await getEvidenceWorkspace(prep,client,year);expect(old.index.version.version).toBe('v1');expect(old.index.resolve('D31').status).toBe('missing_source');
    expect((await getSeason(prep,client,year)).versions.map(v=>v.version)).toEqual(['v1']);
    await move('default');let workspace=await getEvidenceWorkspace(prep,client,year);expect(documentIndex(workspace).available).toBe(72);expect(workspace.index.resolve('D71').status).toBe('missing_source');expect(workspace.index.resolve('msg-09').status).toBe('missing_source');
    await move('tl-22');workspace=await getEvidenceWorkspace(prep,client,year);expect(workspace.index.resolve('D71').status).toBe('resolved');expect(workspace.index.resolve('D72').status).toBe('missing_source');expect(documentIndex(workspace).available).toBe(73);
    const protectedReplay=JSON.stringify(await getSeason(await actor('st-04'),client,year));expect(protectedReplay).not.toContain('41207');expect(protectedReplay).not.toContain('88310');
    await move('tl-29');expect((await getEvidenceWorkspace(prep,client,year)).index.resolve('D72').status).toBe('resolved');expect((await listIdentities()).map(i=>i.id)).toContain('st-06');
    const stale=await readClock();await move('default');await expect(seasonCommand(await actor('st-02'),client,year,{action:'clock',eventId:'tl-29',expectedRevision:stale.revision})).rejects.toMatchObject({status:409});
    expect((await listIdentities()).map(i=>i.id)).not.toContain('st-06');
    const search=await globalSearch(prep,'D72');expect(JSON.stringify(search)).not.toContain('examination of 2025');
  }finally{await move('default');}
});
test('client serialization excludes internal model and APIs reject unauthorized filing actions',async()=>{
  const id=await create();await modeled(id);
  const clientData=JSON.stringify(await getFilings(await actor('cu-01'),client,year));expect(clientData).not.toContain('Explicit test simulation exception');expect(clientData).not.toContain('attestations');expect(clientData).not.toContain('"findings":');
  await expect(getSeason(await actor('cu-01'),client,year)).rejects.toMatchObject({status:403});
  await expect(seasonCommand(await actor('cu-01'),client,year,{action:'model',id,expectedRevision:(await row(id)).revision,model:(await row(id)).model})).rejects.toMatchObject({status:403});
  await expect(act(id,'attest','st-01')).rejects.toMatchObject({status:403});await expect(act(id,'approve','st-02')).rejects.toMatchObject({status:403});await expect(act(id,'submit')).rejects.toMatchObject({status:409});
});
test('scripted rejection, dependent-ID correction and jurisdiction acceptances freeze one exact snapshot',async()=>{
  try {
    await move('tl-20');const id=await create();frozenId=id;await modeled(id,[{line:'F1040.2b',delta:-1840,category:'interest',reason:'Model the documented Northlake overlap, without rerunning the engine.',refs:['ev-0538']}]);await approvals(id);await act(id,'submit');
    await expect(act(id,'response')).rejects.toMatchObject({status:409});
    await move('tl-21');await act(id,'response');expect((await row(id)).status).toBe('rejected');
    const ev=(await pool.query('SELECT record FROM filing_simulation_event WHERE filing_id=$1 AND action=$2',[id,'response'])).rows;expect(JSON.stringify(ev)).toContain('R0000-504-02');expect(JSON.stringify(ev)).toContain('STATE-HOLD');
    await expect(act(id,'correct_identity')).rejects.toMatchObject({status:409});
    await move('tl-22');await expect(act(id,'correct_identity','st-04')).rejects.toMatchObject({status:403});await act(id,'correct_identity');expect((await row(id)).correction).toMatchObject({ref:'doc:D71#page1',extractionRef:'ev-1080',targetRef:'household:theo',ssn:'666-74-3390'});expect((await row(id)).approval).toBeNull();expect((await sourcePacket(client,year)).household.people.find(p=>p.id==='theo')?.ssn).toBe('666-74-3309');await expect(act(id,'submit')).rejects.toMatchObject({status:409});
    await approvals(id);await act(id,'submit');await expect(act(id,'response')).rejects.toMatchObject({status:409});
    await move('tl-23');await act(id,'response');const federal=await row(id);expect(federal.status).toBe('federal_accepted');
    await expect(pool.query("UPDATE filing_simulation SET model='{}' WHERE id=$1",[id])).rejects.toThrow('immutable');await expect(act(id,'model')).rejects.toMatchObject({status:400});
    await collaborationCommand(await actor('st-01'),client,year,{action:'create',kind:'thread',audience:'internal',title:'Post-federal-acceptance follow-up',body:'New workpaper discussion cannot change a federally frozen snapshot.',sourceRefs:['D64'],assigneeId:null,dueDate:null});
    await move('tl-24');await act(id,'response');const accepted=await row(id);expect(accepted.status).toBe('accepted');expect(accepted.snapshot_hash).toBe(federal.snapshot_hash);expect(accepted.snapshot).toEqual(federal.snapshot);expect(snapshotDigest(accepted.snapshot)).toBe(accepted.snapshot_hash);
    await expect(act(id,'submit')).rejects.toMatchObject({status:409});await expect(pool.query("UPDATE filing_simulation SET revision=revision+1 WHERE id=$1",[id])).rejects.toThrow('immutable');await expect(pool.query('DELETE FROM filing_simulation WHERE id=$1',[id])).rejects.toThrow('immutable');
    const snapshot=accepted.snapshot!;expect((snapshot.summary as {federal:{total_tax:number}}).federal.total_tax).toBe(81962);expect(JSON.stringify(snapshot.estimates)).toContain('-640.32');expect(JSON.stringify(snapshot)).toContain('no engine rerun');
  }finally{await move('default');}
});
test('model edits invalidate approval, new available evidence stales approval, and concurrent writes return 409',async()=>{
  try {await move('tl-20');const id=await create();await modeled(id);await approvals(id);const first=await row(id);await modeled(id);expect((await row(id)).approval).toBeNull();await expect(seasonCommand(await actor('st-01'),client,year,{action:'model',id,expectedRevision:first.revision,model:first.model})).rejects.toMatchObject({status:409});
    await approvals(id);await move('tl-22');await expect(act(id,'submit')).rejects.toMatchObject({status:409});
  }finally{await move('default');}
});
test('later workpaper activity cannot strand a submitted rejection or replace its authorized snapshot',async()=>{
  try {
    await move('tl-20');const id=await create();await modeled(id);await approvals(id);await act(id,'submit');const submitted=await row(id);
    await collaborationCommand(await actor('st-01'),client,year,{action:'create',kind:'thread',audience:'internal',title:'Post-submission audit follow-up',body:'Later discussion does not replace the already-authorized submitted payload.',sourceRefs:['D64'],assigneeId:null,dueDate:null});
    await move('tl-29');await act(id,'response');expect((await row(id)).status).toBe('rejected');expect((await row(id)).snapshot).toEqual(submitted.snapshot);
    await act(id,'correct_identity');await approvals(id);await act(id,'submit');const corrected=await row(id);await act(id,'response');await act(id,'response');expect((await row(id)).status).toBe('accepted');expect((await row(id)).snapshot_hash).toBe(corrected.snapshot_hash);
  }finally{await move('default');}
});
test('an open review note blocks even explicitly acknowledged and separately approved simulations',async()=>{
  const reviewer=await actor('st-02');let noteId='';
  try {await move('tl-20');const id=await create();await modeled(id);await approvals(id);
    const created=await collaborationCommand(reviewer,client,year,{action:'create',kind:'review_note',audience:'internal',title:'Phase 7 filing gate test',body:'This unresolved internal review note must block the simulated filing.',sourceRefs:['D64'],assigneeId:'st-01',dueDate:null}) as {id:string};noteId=created.id;
    await expect(act(id,'submit')).rejects.toMatchObject({status:409});
  }finally{if(noteId){const note=await getCollaborationItem(reviewer,client,year,noteId);await collaborationCommand(reviewer,client,year,{action:'update',id:noteId,expectedRevision:note.revision,title:note.title,body:note.body,assigneeId:note.assigneeId,dueDate:note.dueDate,status:'closed',reason:'Closing only the automated simulation gate test note.'});}await move('default');}
});
test('amendment overlay is isolated from its frozen parent and cannot reuse original-return agency acknowledgments',async()=>{
  try {await move('tl-24');
  const parent=await row(frozenId);const result=await seasonCommand(await actor('st-01'),client,year,{action:'create',parentId:frozenId}) as {id:string};
  await modeled(result.id,[{line:'SchC.1',delta:-12400,category:'schc_profit',reason:'Isolated amendment model of the included Paywell card deposits.',refs:['D15','D21']}]);
  expect((await row(frozenId)).snapshot).toEqual(parent.snapshot);expect((await row(frozenId)).model).toEqual(parent.model);expect((await row(result.id)).model.adjustments[0].delta).toBe(-12400);expect((await row(result.id)).correction).toEqual(parent.correction);
  const data=await getFilings(await actor('st-01'),client,year);const branch=JSON.stringify(data.filings.find(f=>f.id===result.id));expect(branch).toContain(parent.snapshot_hash!);expect(branch).toContain('previousModeledValue');await expect(act(result.id,'response')).rejects.toMatchObject({status:409});
  }finally{await move('default');}
});
test('rewind withholds later simulated snapshots and exports without deleting their persistent state',async()=>{
  try {
    await move('default');const before=await row(frozenId);
    expect((await getFilings(await actor('cu-01'),client,year)).filings.some(f=>f.id===frozenId)).toBe(false);
    await expect(exportSeason(await actor('cu-01'),client,year,'client',frozenId)).rejects.toMatchObject({status:404});
    await expect(act(frozenId,'submit')).rejects.toMatchObject({status:404});
    await move('tl-24');const view=(await getFilings(await actor('st-01'),client,year)).filings.find(f=>f.id===frozenId);
    expect(view).toMatchObject({status:'accepted',snapshotHash:before.snapshot_hash});
    expect(JSON.stringify(view)).toMatch(/"createdAt":"2026-/);
    expect((await row(frozenId)).snapshot).toEqual(before.snapshot);
  }finally{await move('default');}
});
test('offline notice export contains its actual referenced evidence, ambiguities, dated confirmation and no remote resources',async()=>{
  try {await expect(exportSeason(await actor('st-01'),client,year,'notice')).rejects.toMatchObject({status:404});await move('tl-29');
    const result=await exportSeason(await actor('st-02'),client,year,'notice');expect(createHash('sha256').update(result.html).digest('hex')).toBe(result.sha256);
    for(const text of ['Letter 566','2028-02-19','doc:D14#page1','doc:D15#page3','doc:D21#page1','doc:D65#page1','doc:D66#page1','doc:D72#page1','142,000','151,300','163,700','msg-08','confidence','ambiguous'])expect(result.html).toContain(text);
    expect(result.html).not.toMatch(/<(script|iframe|link)\b|(?:src|href)=["']https?:/i);expect(result.html).not.toContain('666-52-9134');expect(result.html).not.toContain('41207');
    await expect(exportSeason(await actor('cu-01'),client,year,'notice')).rejects.toMatchObject({status:403});
    const safe=await exportSeason(await actor('cu-01'),client,year,'client',frozenId);expect(safe.html).toContain('81962');expect(safe.html).not.toContain('Explicit test simulation exception');expect(safe.html).not.toContain('attestations');expect(safe.html).not.toContain('refs');
    const html=offlineHtml('<unsafe>','<p>Trusted body</p>');expect(html).toContain('&lt;unsafe&gt;');
  }finally{await move('default');}
});
test('all Phase 7 operations preserve immutable delivered packet bytes and engine versions',async()=>{
  const original=await readFile('data/okafor_lindqvist_2025_packet.json');expect(createHash('sha256').update(original).digest('hex')).toBe(PACKET_SHA256);
  const stored=(await pool.query('SELECT raw_bytes FROM packet_import')).rows[0].raw_bytes;expect(stored.equals(original)).toBe(true);
  const count=(await pool.query('SELECT count(*)::int n FROM engine_line')).rows[0].n;expect(count).toBe(1877);
});
