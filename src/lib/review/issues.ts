import "server-only";
import { createHash } from "node:crypto";
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { engagementRedactor } from '../collaboration/privacy';
import { db } from "../db/client";
import { auditEvents, engagementAccess, identities, workpaperIssues, type Actor } from "../db/schema";
import { assertStaff, authorizeEngagement, HttpError } from "../auth/permissions";
import { DEFAULT_AS_OF } from "../packet/schema";
import { getEvidenceWorkspace, type EvidenceWorkspace } from "../evidence/queries";
import { runIndependentChecks } from "./checks";
import { ISSUE_STATES, type IssueView } from "./types";

const triageRoles=["preparer","reviewer","partner","quality_reviewer"];
export const canTriage = (actor: Pick<Actor,"role">) => triageRoles.includes(actor.role);
const scopeWhere = (workspace: EvidenceWorkspace) => and(eq(workpaperIssues.clientId,workspace.clientId),eq(workpaperIssues.taxYear,workspace.taxYear),eq(workpaperIssues.version,workspace.index.version.version));
const lockName = (workspace: EvidenceWorkspace) => `review:${workspace.clientId}:${workspace.taxYear}:${workspace.index.version.version}`;
type Row = typeof workpaperIssues.$inferSelect;
function maskNote(note: string) { return note.replace(/\b\d{3}-\d{2}-\d{4}\b/gu,"[REDACTED SSN]").replace(/(\b(?:IP[ _-]?PIN|routing|account(?: number)?)\s*[:#]?\s*)[\d -]{6,}/giu,"$1[REDACTED]"); }
function issueView(row: Row, actor: Actor): IssueView {
  return {key:row.issueKey,version:row.version,finding:row.finding,status:row.status,assigneeId:row.assigneeId,
    note:actor.sensitiveDataClearance?row.note:maskNote(row.note),evidenceRefs:row.evidenceRefs,revision:row.revision,updatedAt:row.updatedAt.toISOString()};
}
export async function getAssignees(workspace: EvidenceWorkspace) {
  assertStaff(workspace.actor); await authorizeEngagement(workspace.actor,workspace.clientId,workspace.taxYear);
  return db.select({id:identities.id,name:identities.name,role:identities.role}).from(identities)
    .innerJoin(engagementAccess,eq(engagementAccess.actorId,identities.id))
    .where(and(eq(engagementAccess.clientId,workspace.clientId),eq(engagementAccess.taxYear,workspace.taxYear),inArray(identities.role,triageRoles),lte(identities.activeFrom,DEFAULT_AS_OF.slice(0,10)))).orderBy(identities.id);
}
export async function getReviewDesk(workspace: EvidenceWorkspace) {
  assertStaff(workspace.actor); await authorizeEngagement(workspace.actor,workspace.clientId,workspace.taxYear);
  const checks=runIndependentChecks(workspace.index);
  const findings=checks.filter(check=>check.outcome!=="pass");
  const issues=await db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockName(workspace)}, 0))`);
    const existing=await tx.select().from(workpaperIssues).where(scopeWhere(workspace));
    const rows=new Map(existing.map(row=>[row.issueKey,row]));
    const result:IssueView[]=[];
    for(const finding of findings) {
      const fingerprint=createHash("sha256").update(JSON.stringify(finding)).digest("hex");
      let row=rows.get(finding.key);
      if(!row) {
        const [created]=await tx.insert(workpaperIssues).values({clientId:workspace.clientId,taxYear:workspace.taxYear,version:finding.version,issueKey:finding.key,finding,fingerprint,updatedBy:workspace.actor.id}).returning();
        row=created;
        await tx.insert(auditEvents).values({actorId:workspace.actor.id,clientId:workspace.clientId,taxYear:workspace.taxYear,action:"independent_finding_created",target:finding.key,beforeJson:null,afterJson:issueView(row,workspace.actor)});
      } else if(row.fingerprint!==fingerprint) {
        const before=issueView(row,workspace.actor);
        const [changed]=await tx.update(workpaperIssues).set({finding,fingerprint,status:"open",note:"",evidenceRefs:[],revision:row.revision+1,updatedBy:workspace.actor.id,updatedAt:new Date()}).where(and(scopeWhere(workspace),eq(workpaperIssues.issueKey,finding.key))).returning();
        row=changed;
        await tx.insert(auditEvents).values({actorId:workspace.actor.id,clientId:workspace.clientId,taxYear:workspace.taxYear,action:"independent_finding_refreshed",target:finding.key,beforeJson:before,afterJson:issueView(row,workspace.actor)});
      }
      result.push(issueView(row,workspace.actor));
    }
    return result;
  });
  const assignees=await getAssignees(workspace);
  const diagnostics=workspace.index.version.diagnostics.map(diagnostic=>({code:String(diagnostic.code),severity:String(diagnostic.severity),message:String(diagnostic.message),refs:Array.isArray(diagnostic.refs)?diagnostic.refs.filter((ref):ref is string=>typeof ref==="string"):[]}));
  const redact=await engagementRedactor(workspace.clientId,workspace.taxYear);
  return {version:workspace.index.version.version,checks,issues:workspace.actor.sensitiveDataClearance?issues:redact(issues),assignees,diagnostics,canTriage:canTriage(workspace.actor)};
}
export type ReviewDeskData = Awaited<ReturnType<typeof getReviewDesk>>;
export type ReviewFilters = {status?:string;blocker?:string;area?:string;assignee?:string};
export function filterIssues(issues:IssueView[], filters:ReviewFilters) {
  return issues.filter(issue=>(!filters.status||filters.status==="all"||issue.status===filters.status)&&
    (!filters.blocker||filters.blocker==="all"||(issue.finding.severity==="blocking")===(filters.blocker==="blocking"))&&
    (!filters.area||filters.area==="all"||issue.finding.taxArea===filters.area)&&
    (!filters.assignee||filters.assignee==="all"||(filters.assignee==="unassigned"?issue.assigneeId===null:issue.assigneeId===filters.assignee)));
}
export const issueCommand=z.strictObject({version:z.enum(["v1","v2","v3"]),status:z.enum(ISSUE_STATES),assigneeId:z.string().max(20).nullable(),note:z.string().trim().max(2000),evidenceRefs:z.array(z.string().min(1).max(500)).max(20),expectedRevision:z.number().int().positive()});
export async function updateIssue(actor:Actor,clientId:string,taxYear:number,key:string,input:unknown) {
  assertStaff(actor); await authorizeEngagement(actor,clientId,taxYear);
  if(!canTriage(actor)) throw new HttpError(403,"Tax review dispositions require a preparer, reviewer or partner role.");
  const parsed=issueCommand.safeParse(input);
  if(!parsed.success) throw new HttpError(400,"Provide a valid issue state, assignee, evidence references and revision.");
  const command=parsed.data;
  const workspace=await getEvidenceWorkspace(actor,clientId,taxYear);
  if(command.version!==workspace.index.version.version) throw new HttpError(409,"Your computed-version view changed. Reload before saving.");
  const desk=await getReviewDesk(workspace);
  const current=desk.issues.find(issue=>issue.key===key);
  if(!current) throw new HttpError(404,"Independent finding not found for this version.");
  if(command.assigneeId!==null&&!desk.assignees.some(person=>person.id===command.assigneeId)) throw new HttpError(400,"Choose an active tax reviewer assigned to this engagement.");
  if(["waiting","explained","resolved_with_evidence"].includes(command.status)&&command.note.length<10) throw new HttpError(400,"Describe the waiting reason or review disposition in at least 10 characters.");
  const evidenceRefs=[...new Set(command.evidenceRefs)].sort();
  for(const ref of evidenceRefs) if(!current.finding.inputRefs.includes(ref)||workspace.index.resolve(ref).status!=="resolved") throw new HttpError(400,"Use available evidence linked to this finding; unrelated or future evidence is not accepted.");
  if(command.status==="resolved_with_evidence") {
    if(current.finding.outcome==="needs_information") throw new HttpError(400,"The amount remains unestablished in available evidence. Mark waiting or explained until clarification evidence is available.");
    const sources=evidenceRefs.map(ref=>workspace.index.resolve(ref));
    if(!sources.some(source=>source.status==="resolved"&&!["line","parameter","fx","version"].includes(source.kind))) throw new HttpError(400,"Resolution requires at least one linked source record, not only a computed line.");
  }
  const redact=await engagementRedactor(clientId,taxYear);
  const safeView=(row:Row)=>actor.sensitiveDataClearance?issueView(row,actor):redact(issueView(row,actor));
  return db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockName(workspace)}, 0))`);
    const [before]=await tx.select().from(workpaperIssues).where(and(scopeWhere(workspace),eq(workpaperIssues.issueKey,key))).limit(1);
    if(!before||before.revision!==command.expectedRevision) throw new HttpError(409,"This issue changed in another window. Reload before saving again.");
    let note=command.note;
    if(!actor.sensitiveDataClearance&&redact(maskNote(before.note))!==before.note) {
      if(command.note!==redact(maskNote(before.note))) throw new HttpError(403,"A cleared reviewer must edit this note's protected identifiers.");
      note=before.note;
    }
    if(!actor.sensitiveDataClearance&&redact(note)!==note&&note!==before.note)throw new HttpError(403,'A cleared reviewer must enter protected identifiers.');
    if(before.status===command.status&&before.assigneeId===command.assigneeId&&before.note===note&&JSON.stringify(before.evidenceRefs)===JSON.stringify(evidenceRefs)) return safeView(before);
    const [after]=await tx.update(workpaperIssues).set({status:command.status,assigneeId:command.assigneeId,note,evidenceRefs,revision:before.revision+1,updatedBy:actor.id,updatedAt:new Date()}).where(and(scopeWhere(workspace),eq(workpaperIssues.issueKey,key),eq(workpaperIssues.revision,command.expectedRevision))).returning();
    if(!after) throw new HttpError(409,"This issue changed. Reload before saving again.");
    await tx.insert(auditEvents).values({actorId:actor.id,clientId,taxYear,action:"review_issue_updated",target:key,beforeJson:issueView(before,actor),afterJson:issueView(after,actor)});
    return safeView(after);
  });
}
