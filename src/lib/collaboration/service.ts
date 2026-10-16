import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client';
import { auditEvents, collaborationItems as items, collaborationMessages as messages, collaborationAttachments as attachments,
  collaborationNotifications as notifications, engagements, engagementAccess, identities, packetAuxiliary, sourceDocuments, sourceValues, workpaperIssues, type Actor } from '../db/schema';
import { authorizeEngagement, assertStaff, HttpError } from '../auth/permissions';
import { DEFAULT_AS_OF, type Packet, type PacketValue } from '../packet/schema';
import { availableClientEvidence } from '../packet/availability';
import { getEvidenceWorkspace } from '../evidence/queries';
import { parseReference } from '../evidence/references';
import { engagementRedactor } from './privacy';
import { ITEM_KINDS, type CollaborationData, type ItemView } from './types';

type Item = typeof items.$inferSelect;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const uuid = z.string().uuid();
const text = z.string().trim().min(3).max(8000);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s).nullable();
export const createCommand = z.strictObject({action:z.literal('create'),kind:z.enum(ITEM_KINDS),audience:z.enum(['internal','client']),
  title:z.string().trim().min(3).max(160),body:text,sourceRefs:z.array(z.string().min(1).max(500)).max(20),assigneeId:z.string().max(20).nullable(),dueDate:date});
export const updateCommand = z.strictObject({action:z.literal('update'),id:uuid,expectedRevision:z.number().int().positive(),
  title:z.string().trim().min(3).max(160),body:text,assigneeId:z.string().max(20).nullable(),dueDate:date,status:z.enum(['open','answered','closed']),reason:z.string().trim().min(3).max(2000)});
// Audience and source links are immutable; an internal thread can never be
// published accidentally by editing a visibility selector.
export const replyCommand = z.strictObject({action:z.literal('reply'),id:uuid,expectedRevision:z.number().int().positive(),body:text,kind:z.enum(['reply','answer'])});
const readCommand = z.strictObject({action:z.literal('read_notification'),id:uuid});
const commandSchema = z.discriminatedUnion('action',[createCommand,updateCommand,replyCommand,readCommand]);
const scope = (clientId:string,taxYear:number) => and(eq(items.clientId,clientId),eq(items.taxYear,taxYear));
const visibleScope = (actor:Actor,clientId:string,taxYear:number) => and(scope(clientId,taxYear),actor.role==='client'?eq(items.audience,'client'):undefined);
const canReview = (actor:Actor) => ['reviewer','partner','quality_reviewer'].includes(actor.role);
const canTaxWork = (actor:Actor) => ['preparer','reviewer','partner','quality_reviewer'].includes(actor.role);
const invalidId = () => new HttpError(404,'Record not found or not shared with this identity.');
const stamp = (value:Date|null) => value?.toISOString()??null;

async function people(clientId:string,taxYear:number,executor:typeof db|Tx=db) {
  return executor.select({id:identities.id,name:identities.name,role:identities.role}).from(identities)
    .innerJoin(engagementAccess,eq(engagementAccess.actorId,identities.id))
    .where(and(eq(engagementAccess.clientId,clientId),eq(engagementAccess.taxYear,taxYear),lte(identities.activeFrom,DEFAULT_AS_OF.slice(0,10)))).orderBy(identities.id);
}
async function audit(tx:Tx,actor:Actor,clientId:string,taxYear:number,action:string,target:string,before:unknown,after:unknown) {
  await tx.insert(auditEvents).values({actorId:actor.id,clientId,taxYear,action,target,beforeJson:before,afterJson:after});
}
async function notify(tx:Tx,actor:Actor,item:Item,event:string) {
  const recipients=(await people(item.clientId,item.taxYear,tx)).filter(p=>p.id!==actor.id&&(item.audience==='client'||p.role!=='client'));
  if(recipients.length) await tx.insert(notifications).values(recipients.map(p=>({id:randomUUID(),itemId:item.id,recipientId:p.id,event})));
}
async function getRow(actor:Actor,clientId:string,taxYear:number,id:string,tx:typeof db|Tx=db,lock=false) {
  if(!uuid.safeParse(id).success) throw invalidId();
  const query=tx.select().from(items).where(and(visibleScope(actor,clientId,taxYear),eq(items.id,id))).limit(1);
  const [row]=lock?await query.for('update'):await query;
  if(!row) throw invalidId(); return row;
}
function assertRevision(row:Item,revision:number) {
  if(row.revision!==revision) throw new HttpError(409,'This record changed in another window. Your draft has not been saved. Reload the current record before retrying.');
}
async function assertAssignee(clientId:string,taxYear:number,audience:Item['audience'],assigneeId:string|null,reviewNote=false) {
  if(assigneeId===null)return;
  const person=(await people(clientId,taxYear)).find(p=>p.id===assigneeId);
  if(!person||(audience==='internal'&&person.role==='client')||(reviewNote&&!['preparer','reviewer','partner','quality_reviewer'].includes(person.role)))
    throw new HttpError(400,'Choose an active, authorized assignee for this thread.');
}
async function assertSources(actor:Actor,clientId:string,taxYear:number,refs:string[],audience:Item['audience']) {
  const workspace=await getEvidenceWorkspace(actor,clientId,taxYear);
  for(const ref of refs) {
    if(/^(answer|attachment):/u.test(ref)) {
      const evidence=await getCollaborationEvidence(actor,clientId,taxYear,ref);
      if(audience==='client'&&evidence.audience!=='client')throw new HttpError(400,'Internal evidence cannot be shared with a client.');
      continue;
    }
    const resolved=workspace.index.resolve(ref);
    if(resolved.status!=='resolved')throw new HttpError(400,'Source references must resolve at the current source date.');
    if(audience==='client'&&!['document','page','extracted_value','questionnaire','message'].includes(resolved.kind))
      throw new HttpError(400,'Share a source document, page, extracted field, questionnaire answer or client message. Internal calculations and notes stay in the staff workspace.');
  }
}
async function protectedWrite(actor:Actor,clientId:string,taxYear:number,value:unknown) {
  if(!actor.sensitiveDataClearance) {
    const redact=await engagementRedactor(clientId,taxYear);
    if(JSON.stringify(redact(value))!==JSON.stringify(value))throw new HttpError(403,'A cleared staff member must enter or edit protected identifiers.');
  }
}

export async function getFilingGate(actor:Actor,clientId:string,taxYear:number) {
  assertStaff(actor);await authorizeEngagement(actor,clientId,taxYear);
  const rows=await db.select({id:items.id}).from(items).where(and(scope(clientId,taxYear),eq(items.kind,'review_note'),eq(items.blocksFiling,true),sql`${items.status} <> 'closed'`));
  return {blocked:rows.length>0,openNoteIds:rows.map(r=>r.id),message:rows.length?'Open internal review notes block filing.':'No open blocking review notes. Other filing requirements have not been evaluated.'};
}
export async function assertFilingUnblocked(actor:Actor,clientId:string,taxYear:number) {
  if((await getFilingGate(actor,clientId,taxYear)).blocked)throw new HttpError(409,'Filing is blocked by open internal review notes.');
}

export async function getCollaboration(actor:Actor,clientId:string,taxYear:number,query=''):Promise<CollaborationData> {
  await authorizeEngagement(actor,clientId,taxYear);
  if(query.length>200)throw new HttpError(400,'Search is limited to 200 characters.');
  // Filter BEFORE loading children, searching, hashing, counting or serializing.
  const rows=await db.select().from(items).where(visibleScope(actor,clientId,taxYear)).orderBy(items.createdAt,items.id);
  const ids=rows.map(r=>r.id);
  const [messageRows,fileRows,notificationRows,allPeople,engagement]=await Promise.all([
    ids.length?db.select().from(messages).where(inArray(messages.itemId,ids)).orderBy(messages.createdAt,messages.id):[],
    ids.length?db.select({id:attachments.id,itemId:attachments.itemId,kind:attachments.kind,name:attachments.name,note:attachments.note,sensitive:attachments.sensitive,
      createdBy:attachments.createdBy,createdAt:attachments.createdAt,sha256:attachments.sha256}).from(attachments).where(inArray(attachments.itemId,ids)).orderBy(attachments.createdAt,attachments.id):[],
    ids.length?db.select().from(notifications).where(and(eq(notifications.recipientId,actor.id),inArray(notifications.itemId,ids))).orderBy(notifications.createdAt,notifications.id):[],
    people(clientId,taxYear),db.select().from(engagements).where(and(eq(engagements.clientId,clientId),eq(engagements.taxYear,taxYear))).limit(1),
  ]);
  const [firm]=await db.select({record:packetAuxiliary.record}).from(packetAuxiliary).where(and(eq(packetAuxiliary.packetHash,engagement[0].packetHash),eq(packetAuxiliary.section,'firm'))).limit(1);
  const supplied=firm.record as {deadlines:{what:string;date:string}[];assignment_at_start:Record<string,string>};
  const redact=await engagementRedactor(clientId,taxYear);
  // A safe allow-list, never a database row spread. Defaults are masked for all;
  // explicit authorized reveals use their own audited operation.
  let views:ItemView[]=rows.map(row=>({id:row.id,kind:row.kind,audience:row.audience,title:row.title,body:row.body,sourceRefs:row.sourceRefs,
    assigneeId:row.assigneeId,dueDate:row.dueDate,blocksFiling:row.blocksFiling,status:row.status,revision:row.revision,
    createdBy:row.createdBy,updatedBy:row.updatedBy,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString(),
    messages:messageRows.filter(m=>m.itemId===row.id).map(m=>({id:m.id,ref:`${m.kind==='answer'?'answer':'message'}:${m.id}`,kind:m.kind,body:m.body,createdBy:m.createdBy,createdAt:m.createdAt.toISOString()})),
    attachments:fileRows.filter(f=>f.itemId===row.id).map(f=>({id:f.id,ref:`attachment:${f.id}`,kind:f.kind,name:f.name,
      note:f.sensitive&&actor.role!=='client'&&!actor.sensitiveDataClearance?null:f.note,sensitive:f.sensitive,
      restricted:f.sensitive&&actor.role!=='client'&&!actor.sensitiveDataClearance,createdBy:f.createdBy,createdAt:f.createdAt.toISOString(),
      sha256:f.sensitive&&actor.role!=='client'&&!actor.sensitiveDataClearance?null:f.sha256})),
  }));
  views=redact(views);
  const q=query.normalize('NFKC').trim().toLowerCase();
  const matched=views.filter(v=>JSON.stringify(v).normalize('NFKC').toLowerCase().includes(q));
  const visibleTitles=new Map(views.map(v=>[v.id,v.title]));
  const notices=notificationRows.map(n=>({id:n.id,itemId:n.itemId,title:visibleTitles.get(n.itemId)!,event:n.event,readAt:stamp(n.readAt),createdAt:n.createdAt.toISOString()}));
  const filingGate=actor.role==='client'?null:await getFilingGate(actor,clientId,taxYear);
  const issueRevisions=actor.role==='client'?[]:await db.select({key:workpaperIssues.issueKey,version:workpaperIssues.version,revision:workpaperIssues.revision}).from(workpaperIssues)
    .where(and(eq(workpaperIssues.clientId,clientId),eq(workpaperIssues.taxYear,taxYear))).orderBy(workpaperIssues.version,workpaperIssues.issueKey);
  const cursor=createHash('sha256').update(JSON.stringify({views,notices,issueRevisions})).digest('hex');
  return {items:matched,people:allPeople,notifications:notices,
    deadlines:supplied.deadlines.filter(d=>actor.role!=='client'||!d.what.startsWith('Internal:')),
    assignments:actor.role==='client'?[]:Object.entries(supplied.assignment_at_start).map(([role,actorId])=>({role,actorId})),
    filingGate,canCreate:actor.role!=='client',canReview:canReview(actor),canReveal:actor.role!=='client'&&actor.sensitiveDataClearance,cursor,actorId:actor.id,client:actor.role==='client'};
}

export async function getCollaborationItem(actor:Actor,clientId:string,taxYear:number,id:string) {
  await authorizeEngagement(actor,clientId,taxYear);await getRow(actor,clientId,taxYear,id);
  return (await getCollaboration(actor,clientId,taxYear)).items.find(item=>item.id===id)!;
}

export async function collaborationCommand(actor:Actor,clientId:string,taxYear:number,input:unknown) {
  await authorizeEngagement(actor,clientId,taxYear);
  const parsed=commandSchema.safeParse(input);if(!parsed.success)throw new HttpError(400,'Provide a valid collaboration command, dated task fields and current revision.');
  const c=parsed.data;
  if(c.action==='read_notification') {
    return db.transaction(async tx=>{
      const [row]=await tx.select({notification:notifications}).from(notifications).innerJoin(items,eq(items.id,notifications.itemId))
        .where(and(eq(notifications.id,c.id),eq(notifications.recipientId,actor.id),visibleScope(actor,clientId,taxYear))).limit(1).for('update');
      if(!row)throw invalidId();
      if(!row.notification.readAt) {
        await tx.update(notifications).set({readAt:new Date()}).where(eq(notifications.id,c.id));
        await audit(tx,actor,clientId,taxYear,'notification_read',c.id,null,{itemId:row.notification.itemId});
      }
      return {id:c.id};
    });
  }
  if(c.action==='create') {
    assertStaff(actor);
    if(c.kind==='review_note'&&!canReview(actor))throw new HttpError(403,'Only a reviewer or partner may create blocking review notes.');
    if(c.kind==='review_note'&&c.audience!=='internal')throw new HttpError(400,'Review notes are internal.');
    if(c.kind==='question'&&!c.sourceRefs.length)throw new HttpError(400,'Link the question to at least one real evidence reference.');
    if(!canTaxWork(actor)&&c.kind==='question')throw new HttpError(403,'Tax questions require a tax staff role.');
    await assertAssignee(clientId,taxYear,c.audience,c.assigneeId,c.kind==='review_note');
    await assertSources(actor,clientId,taxYear,c.sourceRefs,c.audience);
    await protectedWrite(actor,clientId,taxYear,{title:c.title,body:c.body});
    const row=await db.transaction(async tx=>{
      const [created]=await tx.insert(items).values({id:randomUUID(),clientId,taxYear,kind:c.kind,audience:c.audience,title:c.title,body:c.body,
        sourceRefs:[...new Set(c.sourceRefs)],assigneeId:c.assigneeId,dueDate:c.dueDate,blocksFiling:c.kind==='review_note',createdBy:actor.id,updatedBy:actor.id}).returning();
      await audit(tx,actor,clientId,taxYear,'collaboration_created',created.id,null,created);await notify(tx,actor,created,'created');return created;
    });
    return getCollaborationItem(actor,clientId,taxYear,row.id);
  }
  // Both replies and edits lock the same parent revision, including attachments.
  const row=await getRow(actor,clientId,taxYear,c.id);
  if(c.action==='update') {
    assertStaff(actor);
    if(row.kind==='review_note'&&!canReview(actor))throw new HttpError(403,'Only a reviewer or partner may edit or close review notes.');
    if(row.kind==='question'&&!canTaxWork(actor))throw new HttpError(403,'Tax questions require a tax staff role.');
    if(c.status==='answered') {
      const [answer]=await db.select({id:messages.id}).from(messages).where(and(eq(messages.itemId,row.id),eq(messages.kind,'answer'))).limit(1);
      if(row.kind!=='question'||!answer)throw new HttpError(400,'Only an actual client answer can establish answered status.');
    }
    if(row.kind==='review_note'&&c.status==='closed'&&c.reason.length<10)throw new HttpError(400,'Explain the review-note closure in at least 10 characters.');
    await assertAssignee(clientId,taxYear,row.audience,c.assigneeId,row.kind==='review_note');
    const redact=await engagementRedactor(clientId,taxYear);
    if(redact(row.body)!==row.body||redact(row.title)!==row.title)throw new HttpError(403,'Protected identifiers in this record must be handled through an appended, audited reply rather than overwriting masked text.');
    await protectedWrite(actor,clientId,taxYear,{title:c.title,body:c.body,reason:c.reason});
  } else {
    if(row.status==='closed')throw new HttpError(409,'This thread is closed. Ask the tax team to reopen it.');
    if(c.kind==='answer'&&row.kind!=='question')throw new HttpError(400,'Only a linked question accepts an evidence answer.');
    if(c.kind==='answer'&&row.audience==='client'&&actor.role!=='client')throw new HttpError(403,'A client question must be answered by a client identity. Staff can append a reply.');
    if(c.kind==='answer'&&row.audience==='internal'&&!canTaxWork(actor))throw new HttpError(403,'A colleague question requires an authorized tax staff answer.');
    // Client replies can contain their own identifiers; the read serializer masks
    // them, and only a cleared member may reveal the original with an audit log.
    if(actor.role!=='client')await protectedWrite(actor,clientId,taxYear,c.body);
  }
  await db.transaction(async tx=>{
    const before=await getRow(actor,clientId,taxYear,c.id,tx,true);assertRevision(before,c.expectedRevision);
    if(c.action==='reply'&&before.status==='closed')throw new HttpError(409,'This thread was closed in another window.');
    if(c.action==='update') {
      const [after]=await tx.update(items).set({title:c.title,body:c.body,assigneeId:c.assigneeId,dueDate:c.dueDate,status:c.status,revision:before.revision+1,updatedBy:actor.id,updatedAt:new Date()}).where(eq(items.id,c.id)).returning();
      await audit(tx,actor,clientId,taxYear,'collaboration_updated',c.id,before,{...after,reason:c.reason});await notify(tx,actor,after,'updated');
    } else {
      const [message]=await tx.insert(messages).values({id:randomUUID(),itemId:c.id,body:c.body,kind:c.kind,createdBy:actor.id}).returning();
      const [after]=await tx.update(items).set({status:c.kind==='answer'?'answered':before.status,revision:before.revision+1,updatedBy:actor.id,updatedAt:new Date()}).where(eq(items.id,c.id)).returning();
      await audit(tx,actor,clientId,taxYear,c.kind==='answer'?(actor.role==='client'?'client_answer_recorded':'colleague_answer_recorded'):'thread_reply_added',message.id,{revision:before.revision},{...message,sourceRefs:before.sourceRefs,revision:after.revision});
      await notify(tx,actor,after,c.kind==='answer'?'answered':'replied');
    }
  });
  return getCollaborationItem(actor,clientId,taxYear,c.id);
}

const attachCommand=z.strictObject({itemId:uuid,expectedRevision:z.number().int().positive(),kind:z.enum(['file','note']),name:z.string().trim().min(1).max(160),note:z.string().trim().min(3).max(8000).optional()});
export async function addAttachment(actor:Actor,clientId:string,taxYear:number,input:unknown,file?:{bytes:Buffer;type:string}) {
  await authorizeEngagement(actor,clientId,taxYear);
  const parsed=attachCommand.safeParse(input);if(!parsed.success)throw new HttpError(400,'Provide an attachment name, content and current parent revision.');
  const c=parsed.data;
  await getRow(actor,clientId,taxYear,c.itemId);
  if(c.kind==='file'&&(!file||file.bytes.length===0||file.bytes.length>2097152))throw new HttpError(413,'Upload a nonempty file of at most 2 MiB.');
  if(c.kind==='note'&&!c.note)throw new HttpError(400,'Write the note attachment.');
  if(c.kind==='note'&&file)throw new HttpError(400,'A note attachment cannot contain a file.');
  const allowed=['text/plain','text/csv','application/pdf','image/png','image/jpeg'];
  if(c.kind==='file'&&!allowed.includes(file!.type))throw new HttpError(400,'Supported attachments: text, CSV, PDF, PNG and JPEG.');
  if(c.kind==='file'&&actor.role!=='client'&&!actor.sensitiveDataClearance)throw new HttpError(403,'File attachments require sensitive-data clearance. You can attach a text note.');
  if(actor.role!=='client')await protectedWrite(actor,clientId,taxYear,{name:c.name,note:c.note});
  const id=randomUUID();const content=c.kind==='file'?file!.bytes:Buffer.from(c.note!,'utf8');
  await db.transaction(async tx=>{
    const before=await getRow(actor,clientId,taxYear,c.itemId,tx,true);assertRevision(before,c.expectedRevision);
    if(before.status==='closed')throw new HttpError(409,'Reopen the thread before attaching evidence.');
    await tx.insert(attachments).values({id,itemId:c.itemId,kind:c.kind,name:c.name,note:c.kind==='note'?c.note:null,content:c.kind==='file'?file!.bytes:null,
      mediaType:c.kind==='file'?file!.type:'text/plain',sha256:createHash('sha256').update(content).digest('hex'),sensitive:c.kind==='file',createdBy:actor.id});
    const [after]=await tx.update(items).set({revision:before.revision+1,updatedBy:actor.id,updatedAt:new Date()}).where(eq(items.id,c.itemId)).returning();
    await audit(tx,actor,clientId,taxYear,'attachment_added',id,{revision:before.revision},{itemId:c.itemId,kind:c.kind,sha256:createHash('sha256').update(content).digest('hex'),revision:after.revision});
    await notify(tx,actor,after,'attachment added');
  });
  return getCollaborationItem(actor,clientId,taxYear,c.itemId);
}

export async function downloadAttachment(actor:Actor,clientId:string,taxYear:number,id:string) {
  await authorizeEngagement(actor,clientId,taxYear);if(!uuid.safeParse(id).success)throw invalidId();
  const [row]=await db.select({attachment:attachments}).from(attachments).innerJoin(items,eq(attachments.itemId,items.id))
    .where(and(visibleScope(actor,clientId,taxYear),eq(attachments.id,id))).limit(1);
  if(!row)throw invalidId();const a=row.attachment;
  if(a.sensitive&&actor.role!=='client'&&!actor.sensitiveDataClearance)throw new HttpError(403,'Sensitive file attachments require clearance.');
  const redact=await engagementRedactor(clientId,taxYear);
  const content=a.kind==='note'?Buffer.from(redact(a.note!),'utf8'):a.content!;
  await db.insert(auditEvents).values({actorId:actor.id,clientId,taxYear,action:a.sensitive?'sensitive_attachment_viewed':'attachment_viewed',target:id,beforeJson:null,afterJson:{itemId:a.itemId,sha256:a.sha256,masked:a.kind==='note'}});
  return {bytes:content,name:redact(a.name),type:a.mediaType};
}

export async function getCollaborationEvidence(actor:Actor,clientId:string,taxYear:number,ref:string) {
  await authorizeEngagement(actor,clientId,taxYear);
  const match=/^(answer|attachment):([a-f0-9-]{36})$/u.exec(ref);if(!match||!uuid.safeParse(match[2]).success)throw invalidId();
  const data=await getCollaboration(actor,clientId,taxYear);
  for(const item of data.items) {
    const record=match[1]==='answer'?item.messages.find(m=>m.id===match[2]&&m.kind==='answer'):item.attachments.find(a=>a.id===match[2]);
    if(record) {
      if('restricted' in record&&record.restricted)throw new HttpError(403,'Sensitive attachment evidence requires clearance.');
      return {ref,audience:item.audience,itemId:item.id,question:item.title,sourceRefs:item.sourceRefs,record,
        description:'Dated workpaper evidence entered by a person. Original packet and computed tax lines are unchanged.'};
    }
  }
  throw invalidId();
}

export async function sharedSource(actor:Actor,clientId:string,taxYear:number,itemId:string,ref:string) {
  await authorizeEngagement(actor,clientId,taxYear);const row=await getRow(actor,clientId,taxYear,itemId);
  if(!row.sourceRefs.includes(ref))throw invalidId();
  if(/^(answer|attachment):/u.test(ref))return getCollaborationEvidence(actor,clientId,taxYear,ref);
  // Clients cannot enter the general evidence resolver. A shared source has a
  // tightly limited, masked projection and no reverse usage or internal trace.
  const parsed=parseReference(ref);if(!parsed)throw invalidId();
  const [engagement]=await db.select().from(engagements).where(and(eq(engagements.clientId,clientId),eq(engagements.taxYear,taxYear))).limit(1);
  const redact=await engagementRedactor(clientId,taxYear);
  let record:unknown;let label=ref;
  if(['document','page','extracted_value'].includes(parsed.kind)) {
    let documentId=parsed.kind==='document'?parsed.id:parsed.kind==='page'?parsed.documentId:'';
    let pageNumber=parsed.kind==='page'?parsed.page:1;let extraction:PacketValue|undefined;
    if(parsed.kind==='extracted_value') {
      const [value]=await db.select().from(sourceValues).where(and(eq(sourceValues.packetHash,engagement.packetHash),eq(sourceValues.valueId,parsed.id))).limit(1);
      if(!value)throw invalidId();extraction=value.record as PacketValue;documentId=extraction.document_id;pageNumber=extraction.page;
    }
    const [document]=await db.select().from(sourceDocuments).where(and(eq(sourceDocuments.packetHash,engagement.packetHash),eq(sourceDocuments.documentId,documentId),lte(sourceDocuments.receivedAt,new Date(DEFAULT_AS_OF)))).limit(1);
    const page=document?.record.pages.find(p=>p.page===pageNumber);if(!page)throw invalidId();
    label=document.record.title;record=extraction?{pipelineReading:extraction,printedPage:page}:page;
  } else if(parsed.kind==='questionnaire'||parsed.kind==='message') {
    const [aux]=await db.select().from(packetAuxiliary).where(and(eq(packetAuxiliary.packetHash,engagement.packetHash),eq(packetAuxiliary.section,'client'))).limit(1);
    const evidence=availableClientEvidence(aux.record as Packet['client']);
    record=(parsed.kind==='questionnaire'?evidence.questionnaire:evidence.messages).find(r=>r.id===parsed.id);if(!record)throw invalidId();
  } else if(actor.role!=='client') {
    const workspace=await getEvidenceWorkspace(actor,clientId,taxYear);const result=workspace.index.resolve(ref);if(result.status!=='resolved')throw invalidId();label=result.label;record={label,ref};
  } else throw invalidId();
  await db.insert(auditEvents).values({actorId:actor.id,clientId,taxYear,action:'shared_source_viewed',target:ref,beforeJson:null,afterJson:{itemId,masked:true,asOf:DEFAULT_AS_OF}});
  return {ref,label:redact(label),record:redact(record),masked:true};
}

export async function revealCollaboration(actor:Actor,clientId:string,taxYear:number,id:string) {
  assertStaff(actor);await authorizeEngagement(actor,clientId,taxYear);
  if(!actor.sensitiveDataClearance)throw new HttpError(403,'Sensitive-data clearance is required.');
  const row=await getRow(actor,clientId,taxYear,id);
  const replies=await db.select().from(messages).where(eq(messages.itemId,id)).orderBy(messages.createdAt,messages.id);
  await db.insert(auditEvents).values({actorId:actor.id,clientId,taxYear,action:'sensitive_collaboration_revealed',target:id,beforeJson:null,afterJson:{reference:id,reason:'Explicit reveal of linked collaboration text'}});
  return {id,title:row.title,body:row.body,messages:replies.map(r=>({id:r.id,body:r.body,createdAt:r.createdAt.toISOString()}))};
}
