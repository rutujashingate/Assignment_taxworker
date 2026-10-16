import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client';
import { auditEvents,salesLotReviews,type Actor } from '../db/schema';
import { authorizeEngagement,assertStaff,HttpError } from '../auth/permissions';
import { getEvidenceWorkspace } from '../evidence/queries';
import { getStandards } from '../firm/service';
import { engagementRedactor } from '../collaboration/privacy';
import { buildLots,buildTaxArea,groupLots } from './models';
import { AREAS,type AreaId,type LotReview } from './types';
export async function getLotReviews(actor:Actor,clientId:string,taxYear:number,version:string):Promise<LotReview[]> {
  assertStaff(actor);await authorizeEngagement(actor,clientId,taxYear);
  const rows=await db.select().from(salesLotReviews).where(and(eq(salesLotReviews.clientId,clientId),eq(salesLotReviews.taxYear,taxYear),eq(salesLotReviews.version,version)));
  const redact=await engagementRedactor(clientId,taxYear);
  return redact(rows.map(r=>({key:r.lineKey,status:r.status,reason:r.reason,revision:r.revision,updatedBy:r.updatedBy,updatedAt:r.updatedAt.toISOString()})));
}
export async function getRecords(actor:Actor,clientId:string,taxYear:number,area:string) {
  assertStaff(actor);await authorizeEngagement(actor,clientId,taxYear);if(!AREAS.some(a=>a.id===area))throw new HttpError(404,'Tax area not found.');
  const [workspace,standards]=await Promise.all([getEvidenceWorkspace(actor,clientId,taxYear),getStandards(actor,clientId,taxYear)]);
  const model=buildTaxArea(workspace.index,area as AreaId,standards.record.variance_review);
  const lots=area==='sales'?buildLots(workspace.index):[];
  const reviews=area==='sales'?await getLotReviews(actor,clientId,taxYear,workspace.index.version.version):[];
  await db.insert(auditEvents).values({actorId:actor.id,clientId,taxYear,action:'tax_area_viewed',target:area,beforeJson:null,afterJson:{version:workspace.index.version.version,masked:workspace.masked}});
  return {workspace,model,lots,groups:groupLots(lots),reviews,canReview:['preparer','reviewer','partner','quality_reviewer'].includes(actor.role)};
}
const bulkCommand=z.strictObject({version:z.enum(['v1','v2','v3']),items:z.array(z.strictObject({key:z.string().max(100),expectedRevision:z.number().int().nonnegative()})).min(1).max(500),status:z.enum(['reviewed','needs_review']),reason:z.string().trim().min(10).max(2000)});
export async function bulkReviewLots(actor:Actor,clientId:string,taxYear:number,input:unknown) {
  assertStaff(actor);await authorizeEngagement(actor,clientId,taxYear);
  if(!['preparer','reviewer','partner','quality_reviewer'].includes(actor.role))throw new HttpError(403,'Bulk lot review requires a tax staff role.');
  const parsed=bulkCommand.safeParse(input);if(!parsed.success)throw new HttpError(400,'Choose actual lots, a review state, reason and expected revisions.');
  const c=parsed.data;if(new Set(c.items.map(i=>i.key)).size!==c.items.length)throw new HttpError(400,'Duplicate lot selections are not allowed.');
  const workspace=await getEvidenceWorkspace(actor,clientId,taxYear);if(workspace.index.version.version!==c.version)throw new HttpError(409,'Computed version changed. Reload before reviewing.');
  const available=new Map(buildLots(workspace.index).map(lot=>[lot.key,lot]));
  for(const item of c.items)if(!available.has(item.key))throw new HttpError(400,'Every selected key must be an actual computed lot in this version.');
  const redact=await engagementRedactor(clientId,taxYear);if(!actor.sensitiveDataClearance&&redact(c.reason)!==c.reason)throw new HttpError(403,'A cleared reviewer must enter protected identifiers.');
  await db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`season:${clientId}:${taxYear}`},0))`);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`lots:${clientId}:${taxYear}:${c.version}`},0))`);
    const current=await tx.select().from(salesLotReviews).where(and(eq(salesLotReviews.clientId,clientId),eq(salesLotReviews.taxYear,taxYear),eq(salesLotReviews.version,c.version)));
    const byKey=new Map(current.map(row=>[row.lineKey,row]));
    for(const item of c.items)if((byKey.get(item.key)?.revision??0)!==item.expectedRevision)throw new HttpError(409,'A selected lot changed in another window. The entire batch was rejected; reload before saving.');
    const changes=[];
    for(const item of c.items) {
      const revision=item.expectedRevision+1;const sourceRefs=available.get(item.key)!.sourceRefs;
      await tx.insert(salesLotReviews).values({clientId,taxYear,version:c.version,lineKey:item.key,status:c.status,reason:c.reason,revision,sourceRefs,updatedBy:actor.id})
        .onConflictDoUpdate({target:[salesLotReviews.clientId,salesLotReviews.taxYear,salesLotReviews.version,salesLotReviews.lineKey],set:{status:c.status,reason:c.reason,revision,sourceRefs,updatedBy:actor.id,updatedAt:new Date()}});
      changes.push({key:item.key,before:byKey.get(item.key)??null,after:{status:c.status,revision,sourceRefs}});
    }
    await tx.insert(auditEvents).values({actorId:actor.id,clientId,taxYear,action:'sales_lots_reviewed',target:c.version,beforeJson:null,afterJson:{reason:c.reason,changes}});
  });
  return getLotReviews(actor,clientId,taxYear,c.version);
}
