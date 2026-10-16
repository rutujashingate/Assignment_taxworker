import { beforeAll, expect, test } from 'vitest';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { setupDatabase, actor } from './helpers';
import { db } from '../src/lib/db/client';
import { auditEvents, collaborationMessages, collaborationItems, collaborationAttachments } from '../src/lib/db/schema';
import { addAttachment, assertFilingUnblocked, collaborationCommand, downloadAttachment, getCollaboration, getCollaborationEvidence,
  getCollaborationItem, getFilingGate, revealCollaboration, sharedSource } from '../src/lib/collaboration/service';
import { getEvidenceWorkspace, recordEvidenceView, revealSensitiveValue } from '../src/lib/evidence/queries';
import { getPreferences, updatePreferences } from '../src/lib/workpaper/preferences';
import { boundedBody } from '../src/lib/collaboration/http';
import type { ItemView, ItemKind } from '../src/lib/collaboration/types';
const clientId='CL-20417',year=2025;
const marker=`unit-${randomUUID()}`;
beforeAll(async()=>{await setupDatabase();for(const id of ['st-01','st-02']) {const a=await actor(id);const p=await getPreferences(a,clientId,year);if(p.selectedVersion!=='v3')await updatePreferences(a,clientId,year,{selectedVersion:'v3',expectedRevision:p.revision});}});
async function create(id='st-01',kind:ItemKind='question',audience:'internal'|'client'='client') {
  return await collaborationCommand(await actor(id),clientId,year,{action:'create',kind,audience,title:`${marker} ${kind}`,body:'D64 is ambiguous. Please confirm the gift amount using a parish or bank record.',sourceRefs:['doc:D64#page1','qa-38'],assigneeId:audience==='client'?'cu-01':'st-01',dueDate:'2026-06-30'}) as ItemView;
}
function edit(item:ItemView,body:string,status='open') {return {action:'update',id:item.id,expectedRevision:item.revision,title:item.title,body,status,assigneeId:item.assigneeId,dueDate:item.dueDate,reason:'Correcting the collaboration workpaper text.'};}
async function events(action:string,target:string) {return db.select().from(auditEvents).where(and(eq(auditEvents.action,action),eq(auditEvents.target,target)));}

test('linked client question, dated answer and preparer evidence survive new reads',async()=>{
  const q=await create();const ngozi=await actor('cu-01');
  const answered=await collaborationCommand(ngozi,clientId,year,{action:'reply',id:q.id,expectedRevision:q.revision,kind:'answer',body:'I will request written confirmation from the parish; the amount is not confirmed yet.'}) as ItemView;
  expect(answered.status).toBe('answered');expect(answered.revision).toBe(q.revision+1);
  const reloaded=await getCollaborationItem(await actor('st-01'),clientId,year,q.id);const answer=reloaded.messages[0];
  expect(answer.createdBy).toBe('cu-01');expect(Date.parse(answer.createdAt)).toBeGreaterThan(Date.parse('2026-06-23'));
  const evidence=await getCollaborationEvidence(await actor('st-02'),clientId,year,answer.ref);
  expect(evidence.sourceRefs).toEqual(['doc:D64#page1','qa-38']);expect(evidence.record).toMatchObject({body:answer.body,createdAt:answer.createdAt});
  expect((await events('client_answer_recorded',answer.id))).toHaveLength(1);
  expect(JSON.stringify(await sharedSource(ngozi,clientId,year,q.id,'doc:D64#page1'))).toContain('$?,500.00');
  await expect(sharedSource(ngozi,clientId,year,q.id,'doc:D08#page1')).rejects.toMatchObject({status:404});
});

test('internal notes cannot be read, found by search, answered, revealed or observed through a client cursor',async()=>{
  const ngozi=await actor('cu-01');const before=await getCollaboration(ngozi,clientId,year);
  const note=await create('st-02','review_note','internal');
  try {
    const reply=await collaborationCommand(await actor('st-01'),clientId,year,{action:'reply',id:note.id,expectedRevision:note.revision,kind:'reply',body:'Internal reviewer analysis remains private.'}) as ItemView;
    const attached=await addAttachment(await actor('st-02'),clientId,year,{itemId:note.id,expectedRevision:reply.revision,kind:'note',name:'Internal memo',note:'Internal review attachment.'});
    await expect(collaborationCommand(await actor('st-01'),clientId,year,{action:'create',kind:'question',audience:'client',title:'Accidental internal evidence share',body:'This internal attachment must not be published.',sourceRefs:[attached.attachments[0].ref],assigneeId:'cu-01',dueDate:null})).rejects.toMatchObject({status:400});
    const after=await getCollaboration(ngozi,clientId,year);expect(after.cursor).toBe(before.cursor);expect(after.notifications).toEqual(before.notifications);expect(after.filingGate).toBeNull();
    expect(JSON.stringify(after)).not.toContain(note.id);
    expect((await getCollaboration(ngozi,clientId,year,marker)).items.map(i=>i.id)).not.toContain(note.id);
    for(const id of ['cu-01','cu-02']) {
      const a=await actor(id);await expect(getCollaborationItem(a,clientId,year,note.id)).rejects.toMatchObject({status:404});
      await expect(collaborationCommand(a,clientId,year,{action:'reply',id:note.id,expectedRevision:attached.revision,kind:'reply',body:'Trying a hidden note.'})).rejects.toMatchObject({status:404});
      await expect(downloadAttachment(a,clientId,year,attached.attachments[0].id)).rejects.toMatchObject({status:404});
      await expect(getCollaborationEvidence(a,clientId,year,attached.attachments[0].ref)).rejects.toMatchObject({status:404});
      await expect(revealCollaboration(a,clientId,year,note.id)).rejects.toMatchObject({status:403});
    }
    const reviewer=await actor('st-02');const current=await getCollaborationItem(reviewer,clientId,year,note.id);
    await collaborationCommand(reviewer,clientId,year,edit(current,current.body,'closed'));
  }finally{const a=await actor('st-02');const current=await getCollaborationItem(a,clientId,year,note.id);if(current.status!=='closed')await collaborationCommand(a,clientId,year,edit(current,current.body,'closed'));}
});

test('colleague answers become internal dated evidence; staff cannot impersonate a client answer',async()=>{
  const q=await create('st-01','question','internal');const reviewer=await actor('st-02');
  const answered=await collaborationCommand(reviewer,clientId,year,{action:'reply',id:q.id,expectedRevision:q.revision,kind:'answer',body:'Keep the handwritten amount unverified until written confirmation arrives.'}) as ItemView;
  const evidence=await getCollaborationEvidence(await actor('st-01'),clientId,year,answered.messages[0].ref);
  expect(evidence.record).toMatchObject({createdBy:'st-02',kind:'answer'});expect(evidence.audience).toBe('internal');
  expect((await events('colleague_answer_recorded',answered.messages[0].id))).toHaveLength(1);
  await expect(getCollaborationEvidence(await actor('cu-01'),clientId,year,answered.messages[0].ref)).rejects.toMatchObject({status:404});
  const shared=await create();await expect(collaborationCommand(reviewer,clientId,year,{action:'reply',id:shared.id,expectedRevision:shared.revision,kind:'answer',body:'Staff cannot author a taxpayer confirmation.'})).rejects.toMatchObject({status:403});
});

test('review notes enforce the filing gate; only a reviewer or partner can close them',async()=>{
  const note=await create('st-02','review_note','internal');
  expect((await getFilingGate(await actor('st-01'),clientId,year)).openNoteIds).toContain(note.id);
  await expect(assertFilingUnblocked(await actor('st-03'),clientId,year)).rejects.toMatchObject({status:409});
  await expect(collaborationCommand(await actor('st-01'),clientId,year,edit(note,note.body,'closed'))).rejects.toMatchObject({status:403});
  await expect(collaborationCommand(await actor('cu-01'),clientId,year,edit(note,note.body,'closed'))).rejects.toMatchObject({status:404});
  const closed=await collaborationCommand(await actor('st-03'),clientId,year,edit(note,note.body,'closed')) as ItemView;
  expect(closed.status).toBe('closed');expect((await getFilingGate(await actor('st-01'),clientId,year)).openNoteIds).not.toContain(note.id);
  expect((await events('collaboration_updated',note.id))[0].afterJson).toMatchObject({status:'closed',reason:'Correcting the collaboration workpaper text.'});
});

test('permissions reject client creation, role escalation, future refs and invalid assignees',async()=>{
  await expect(create('cu-01')).rejects.toMatchObject({status:403});await expect(create('st-01','review_note','internal')).rejects.toMatchObject({status:403});
  await expect(create('st-05')).rejects.toMatchObject({status:403});await expect(create('st-06')).rejects.toMatchObject({status:403});
  const base={action:'create',kind:'question',audience:'client',title:'Confirm real source evidence',body:'Please clarify the source record.',sourceRefs:['msg-08'],assigneeId:'cu-01',dueDate:null};
  for(const sourceRefs of [['msg-08'],['D71'],['F1040.2b'],[]])await expect(collaborationCommand(await actor('st-01'),clientId,year,{...base,sourceRefs})).rejects.toMatchObject({status:400});
  for(const assigneeId of ['st-06','invented'])await expect(collaborationCommand(await actor('st-01'),clientId,year,{...base,sourceRefs:['D64'],assigneeId})).rejects.toMatchObject({status:400});
  await expect(getCollaboration(await actor('st-01'),'CL-other',year)).rejects.toMatchObject({status:403});
  await expect(collaborationCommand(await actor('st-01'),clientId,year,{...base,sourceRefs:['D64'],dueDate:'2026-02-31'})).rejects.toMatchObject({status:400});
  const shared=await create();await expect(collaborationCommand(await actor('cu-01'),clientId,year,edit(shared,'A client cannot change staff assignment or text.'))).rejects.toMatchObject({status:403});
  await expect(collaborationCommand(await actor('st-01'),clientId,year,{...edit(shared,shared.body),status:'answered'})).rejects.toMatchObject({status:400});
});

test('parallel edits have exactly one winner and one safe 409 with a single audit event',async()=>{
  const q=await create();const a=await actor('st-01');const b=await actor('st-02');
  const outcomes=await Promise.allSettled([collaborationCommand(a,clientId,year,edit(q,'Window A corrects the requested evidence.')),collaborationCommand(b,clientId,year,edit(q,'Window B corrects the requested evidence.'))]);
  expect(outcomes.filter(x=>x.status==='fulfilled')).toHaveLength(1);
  expect(outcomes.find(x=>x.status==='rejected')).toMatchObject({reason:{status:409}});
  const stored=await getCollaborationItem(a,clientId,year,q.id);expect(stored.revision).toBe(q.revision+1);
  expect((await events('collaboration_updated',q.id))).toHaveLength(1);
});

test('answer and attachment races lock the same revision and never lose data',async()=>{
  const q=await create();const a=await actor('cu-01');
  const results=await Promise.allSettled([
    collaborationCommand(a,clientId,year,{action:'reply',id:q.id,expectedRevision:q.revision,kind:'answer',body:'I have requested the written receipt.'}),
    addAttachment(a,clientId,year,{itemId:q.id,expectedRevision:q.revision,kind:'note',name:'Evidence request log',note:'Called parish to request written confirmation.'}),
  ]);
  expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);expect(results.find(x=>x.status==='rejected')).toMatchObject({reason:{status:409}});
  const stored=await getCollaborationItem(a,clientId,year,q.id);expect(stored.messages.length+stored.attachments.length).toBe(1);
});

test('file bytes and note attachments persist with hashes and parent audience authorization',async()=>{
  let q=await create();const bytes=Buffer.from('Client-entered follow-up document, not an original packet source.');
  q=await addAttachment(await actor('cu-01'),clientId,year,{itemId:q.id,expectedRevision:q.revision,kind:'file',name:'follow-up.txt'},{bytes,type:'text/plain'});
  const file=q.attachments[0];expect((await downloadAttachment(await actor('st-01'),clientId,year,file.id)).bytes).toEqual(bytes);
  expect((await downloadAttachment(await actor('cu-02'),clientId,year,file.id)).bytes).toEqual(bytes);
  await expect(downloadAttachment(await actor('st-04'),clientId,year,file.id)).rejects.toMatchObject({status:403});
  const masked=await getCollaborationItem(await actor('st-04'),clientId,year,q.id);expect(masked.attachments[0]).toMatchObject({restricted:true,sha256:null});
  q=await addAttachment(await actor('st-01'),clientId,year,{itemId:q.id,expectedRevision:q.revision,kind:'note',name:'Follow-up note',note:'Waiting for written confirmation.'});
  expect((await getCollaborationItem(await actor('st-02'),clientId,year,q.id)).attachments).toHaveLength(2);
  expect((await events('sensitive_attachment_viewed',file.id))).toHaveLength(2);
  await expect(db.update(collaborationAttachments).set({name:'Rewritten evidence'}).where(eq(collaborationAttachments.id,file.id))).rejects.toThrow();
});

test('oversized and unsupported attachments fail without advancing the parent revision',async()=>{
  const q=await create();const a=await actor('st-01');const command={itemId:q.id,expectedRevision:q.revision,kind:'file',name:'invalid'};
  await expect(addAttachment(a,clientId,year,command,{bytes:Buffer.alloc(2097153),type:'text/plain'})).rejects.toMatchObject({status:413});
  await expect(addAttachment(a,clientId,year,command,{bytes:Buffer.from('bad'),type:'text/html'})).rejects.toMatchObject({status:400});
  expect((await getCollaborationItem(a,clientId,year,q.id)).revision).toBe(q.revision);
  const stream=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new Uint8Array(20));controller.close();}});
  await expect(boundedBody(new Request('http://localhost',{method:'POST',body:stream,duplex:'half'} as RequestInit),10)).rejects.toMatchObject({status:413});
});

test('protected collaboration text is masked in reads and search; explicit authorized reveal is logged',async()=>{
  const q=await create();const a=await actor('cu-01');const workspace=await getEvidenceWorkspace(await actor('st-01'),clientId,year);
  const ssn=String(workspace.index.values.get('ev-0015')!.value);
  const answered=await collaborationCommand(a,clientId,year,{action:'reply',id:q.id,expectedRevision:q.revision,kind:'answer',body:`Please confirm this identifier: ${ssn}.`}) as ItemView;
  for(const id of ['st-01','st-04','cu-01']) {
    const person=await actor(id);expect(JSON.stringify(await getCollaborationItem(person,clientId,year,q.id))).not.toContain(ssn);
    expect((await getCollaboration(person,clientId,year,ssn)).items).toHaveLength(0);
    expect(JSON.stringify(await getCollaborationEvidence(person,clientId,year,answered.messages[0].ref))).not.toContain(ssn);
  }
  await expect(revealCollaboration(await actor('st-04'),clientId,year,q.id)).rejects.toMatchObject({status:403});
  expect(JSON.stringify(await revealCollaboration(await actor('st-01'),clientId,year,q.id))).toContain(ssn);
  expect((await events('sensitive_collaboration_revealed',q.id))).toHaveLength(1);
  expect(JSON.stringify((await events('sensitive_collaboration_revealed',q.id))[0].afterJson)).not.toContain(ssn);
  await expect(db.update(collaborationMessages).set({body:'Changed answer'}).where(eq(collaborationMessages.id,answered.messages[0].id))).rejects.toThrow();
});

test('uncleared source reads remain masked; successful reveals and sensitive document views are logged',async()=>{
  const cleared=await actor('st-01');const uncleared=await actor('st-04');
  await expect(revealSensitiveValue(uncleared,clientId,year,'ev-0015')).rejects.toMatchObject({status:403});
  await expect(revealSensitiveValue(await actor('cu-01'),clientId,year,'ev-0015')).rejects.toMatchObject({status:403});
  const value=await revealSensitiveValue(cleared,clientId,year,'ev-0015');
  expect((await events('sensitive_value_revealed','ev-0015')).some(e=>e.actorId==='st-01')).toBe(true);
  expect(JSON.stringify((await getEvidenceWorkspace(uncleared,clientId,year)).index.resolve('ev-0015'))).not.toContain(String(value.value));
  await recordEvidenceView(await getEvidenceWorkspace(cleared,clientId,year),'doc:D08#page1');
  expect((await events('sensitive_document_viewed','D08')).some(e=>e.actorId==='st-01')).toBe(true);
});

test('notifications are persistent, recipient-owned, scoped, and audited when read',async()=>{
  const q=await create();const reviewer=await actor('st-02');const client=await actor('cu-01');
  const notifications=(await getCollaboration(reviewer,clientId,year)).notifications.filter(n=>n.itemId===q.id);
  expect(notifications).toHaveLength(1);expect(notifications[0].readAt).toBeNull();
  await expect(collaborationCommand(client,clientId,year,{action:'read_notification',id:notifications[0].id})).rejects.toMatchObject({status:404});
  await collaborationCommand(reviewer,clientId,year,{action:'read_notification',id:notifications[0].id});
  const reloaded=(await getCollaboration(reviewer,clientId,year)).notifications.find(n=>n.id===notifications[0].id)!;expect(reloaded.readAt).not.toBeNull();
  expect((await events('notification_read',notifications[0].id))).toHaveLength(1);
});

test('assignments and deadlines persist with actual initial staffing and supplied deadlines',async()=>{
  const task=await create('st-01','task','internal');
  const updated=await collaborationCommand(await actor('st-01'),clientId,year,{...edit(task,task.body),assigneeId:'st-02',dueDate:'2026-07-02'}) as ItemView;
  const reloaded=await getCollaborationItem(await actor('st-02'),clientId,year,task.id);expect(reloaded).toMatchObject({assigneeId:'st-02',dueDate:'2026-07-02',revision:updated.revision});
  const staff=await getCollaboration(await actor('st-01'),clientId,year);expect(staff.assignments).toHaveLength(3);expect(staff.assignments).toEqual(expect.arrayContaining([{role:'preparer',actorId:'st-01'},{role:'reviewer',actorId:'st-02'},{role:'partner',actorId:'st-03'}]));
  expect(staff.deadlines).toHaveLength(6);expect(staff.people.map(p=>p.id)).not.toContain('st-06');
  const client=await getCollaboration(await actor('cu-01'),clientId,year);expect(client.assignments).toEqual([]);expect(client.deadlines.every(d=>!d.what.startsWith('Internal:'))).toBe(true);
  expect((await events('collaboration_updated',task.id))[0].afterJson).toMatchObject({assigneeId:'st-02',dueDate:'2026-07-02'});
  const row=(await db.select().from(collaborationItems).where(eq(collaborationItems.id,task.id)))[0];expect(row.clientId).toBe(clientId);
});
