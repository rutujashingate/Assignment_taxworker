import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, sql, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client';
import { auditEvents, engagements, firmStandards, identities, packetAuxiliary, timeEntries, workpaperIssues, type Actor } from '../db/schema';
import { assertStaff, authorizeEngagement, HttpError } from '../auth/permissions';
import { engagementRedactor } from '../collaboration/privacy';
import { getFilingGate } from '../collaboration/service';
import { object } from '../records/models';
export type Standards={note:string;verification_types:string[];review_levels:string[];rules:string[];required_steps:string[];variance_review:{compare_to:string;flag_if_change_over_percent:number;and_over_amount:number}};
export async function firmSource(actor:Actor,clientId='CL-20417',taxYear=2025) {
  assertStaff(actor);await authorizeEngagement(actor,clientId,taxYear);
  const [engagement]=await db.select().from(engagements).where(and(eq(engagements.clientId,clientId),eq(engagements.taxYear,taxYear))).limit(1);
  if(!engagement)throw new HttpError(404,'Engagement not found.');
  const [row]=await db.select().from(packetAuxiliary).where(and(eq(packetAuxiliary.packetHash,engagement.packetHash),eq(packetAuxiliary.section,'firm'))).limit(1);
  return {engagement,firm:object(row.record)};
}
export async function getStandards(actor:Actor,clientId='CL-20417',taxYear=2025) {
  const {engagement,firm}=await firmSource(actor,clientId,taxYear);
  const [row]=await db.select().from(firmStandards).where(eq(firmStandards.packetHash,engagement.packetHash)).limit(1);
  return {record:(row?.record??firm.starter_standards) as Standards,revision:row?.revision??0,updatedAt:row?.updatedAt.toISOString()??null};
}
export function assertAdmin(actor:Actor) {if(actor.role!=='firm_administrator')throw new HttpError(403,'Firm administration requires the firm administrator identity.');}
const standardCommand=z.strictObject({expectedRevision:z.number().int().nonnegative(),variancePercent:z.number().min(0).max(1000),varianceAmount:z.number().min(0).max(1e9),
  requiredSteps:z.array(z.string().trim().min(3).max(300)).min(1).max(40),rules:z.array(z.string().trim().min(3).max(500)).min(1).max(40)});
export async function updateStandards(actor:Actor,input:unknown) {
  assertAdmin(actor);const {engagement}=await firmSource(actor);const parsed=standardCommand.safeParse(input);if(!parsed.success)throw new HttpError(400,'Provide variance criteria, policy rules, checklist and expected revision.');
  const c=parsed.data;const before=await getStandards(actor);const redact=await engagementRedactor(engagement.clientId,engagement.taxYear);
  if(JSON.stringify(redact(c))!==JSON.stringify(c))throw new HttpError(400,'Policy text must not contain taxpayer identifiers.');
  return db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`season:${engagement.clientId}:${engagement.taxYear}`},0))`);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`standards:${engagement.packetHash}`},0))`);
    const [current]=await tx.select().from(firmStandards).where(eq(firmStandards.packetHash,engagement.packetHash)).limit(1);
    if((current?.revision??0)!==c.expectedRevision)throw new HttpError(409,'Firm standards changed. Reload before saving.');
    const record:Standards={...before.record,variance_review:{...before.record.variance_review,flag_if_change_over_percent:c.variancePercent,and_over_amount:c.varianceAmount},required_steps:c.requiredSteps,rules:c.rules};
    const revision=c.expectedRevision+1;
    await tx.insert(firmStandards).values({packetHash:engagement.packetHash,record,revision,updatedBy:actor.id}).onConflictDoUpdate({target:firmStandards.packetHash,set:{record,revision,updatedBy:actor.id,updatedAt:new Date()}});
    await tx.insert(auditEvents).values({actorId:actor.id,clientId:engagement.clientId,taxYear:engagement.taxYear,action:'firm_standards_updated',target:'firm_standards',beforeJson:before,afterJson:{record,revision}});
    return {record,revision};
  });
}
export async function getTime(actor:Actor,clientId:string,taxYear:number,all=false) {
  const {firm}=await firmSource(actor,clientId,taxYear);if(all)assertAdmin(actor);
  const rows=await db.select({id:timeEntries.id,actorId:timeEntries.actorId,category:timeEntries.category,minutes:timeEntries.minutes,workedOn:timeEntries.workedOn,note:timeEntries.note,createdAt:timeEntries.createdAt}).from(timeEntries)
    .where(and(eq(timeEntries.clientId,clientId),eq(timeEntries.taxYear,taxYear),all?undefined:eq(timeEntries.actorId,actor.id))).orderBy(desc(timeEntries.createdAt));
  const budget=firm.budget_hours as Record<string,number>;const redact=await engagementRedactor(clientId,taxYear);
  return {scope:all?'engagement':'own',budget,entries:redact(rows.map(row=>({...row,createdAt:row.createdAt.toISOString()}))),
    categories:Object.entries(budget).map(([category,hours])=>({category,budgetHours:hours,loggedMinutes:rows.filter(row=>row.category===category).reduce((n,row)=>n+row.minutes,0),entryCount:rows.filter(row=>row.category===category).length}))};
}
const timeCommand=z.strictObject({category:z.string().max(100),minutes:z.number().int().min(1).max(1440),workedOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s),note:z.string().trim().min(3).max(1000)});
export async function logTime(actor:Actor,clientId:string,taxYear:number,input:unknown) {
  const {firm}=await firmSource(actor,clientId,taxYear);const parsed=timeCommand.safeParse(input);if(!parsed.success)throw new HttpError(400,'Provide a supplied budget category, valid work date, 1–1440 minutes and description.');
  const c=parsed.data;if(!Object.hasOwn(object(firm.budget_hours),c.category))throw new HttpError(400,'Choose a supplied budget category.');
  if(c.workedOn>new Date().toISOString().slice(0,10))throw new HttpError(400,'Log work already performed, not future time.');
  const redact=await engagementRedactor(clientId,taxYear);if(!actor.sensitiveDataClearance&&redact(c.note)!==c.note)throw new HttpError(403,'Do not include protected identifiers in time descriptions.');
  const id=randomUUID();await db.transaction(async tx=>{
    await tx.insert(timeEntries).values({id,clientId,taxYear,actorId:actor.id,...c});
    await tx.insert(auditEvents).values({actorId:actor.id,clientId,taxYear,action:'work_time_logged',target:id,beforeJson:null,afterJson:c});
  });return {id};
}
export async function getFirmAdmin(actor:Actor,filters:{actor?:string;action?:string;page?:number}={}) {
  assertAdmin(actor);const {engagement}=await firmSource(actor);const page=Number.isFinite(filters.page??1)?Math.max(1,Math.min(10000,Math.trunc(filters.page??1))):1;
  const where=and(eq(auditEvents.clientId,engagement.clientId),eq(auditEvents.taxYear,engagement.taxYear),filters.actor?eq(auditEvents.actorId,filters.actor):undefined,filters.action?eq(auditEvents.action,filters.action):undefined);
  const [rows,total,statuses,standards,time,gate]=await Promise.all([
    db.select({id:auditEvents.id,actorId:auditEvents.actorId,name:identities.name,action:auditEvents.action,target:auditEvents.target,createdAt:auditEvents.createdAt}).from(auditEvents).innerJoin(identities,eq(identities.id,auditEvents.actorId)).where(where).orderBy(desc(auditEvents.id)).limit(50).offset((page-1)*50),
    db.select({count:sql<number>`count(*)`.mapWith(Number)}).from(auditEvents).where(where),
    db.select({status:workpaperIssues.status,count:sql<number>`count(*)`.mapWith(Number)}).from(workpaperIssues).where(and(eq(workpaperIssues.clientId,engagement.clientId),eq(workpaperIssues.taxYear,engagement.taxYear),eq(workpaperIssues.version,'v3'))).groupBy(workpaperIssues.status),
    getStandards(actor),getTime(actor,engagement.clientId,engagement.taxYear,true),getFilingGate(actor,engagement.clientId,engagement.taxYear),
  ]);
  await db.insert(auditEvents).values({actorId:actor.id,clientId:engagement.clientId,taxYear:engagement.taxYear,action:'firm_access_logs_viewed',target:'audit_metadata',beforeJson:null,afterJson:{page,returned:rows.length}});
  return {engagement:{clientId:engagement.clientId,taxYear:engagement.taxYear,name:engagement.name},standards,time,statuses,gate,
    access:{rows:rows.map(row=>({...row,createdAt:row.createdAt.toISOString()})),total:total[0].count,page,pageSize:50}};
}
