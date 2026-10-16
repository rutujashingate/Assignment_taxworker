import 'server-only';
import { assertStaff, HttpError } from '../auth/permissions';
import type { Actor } from '../db/schema';
import { searchEngagements } from '../engagements/queries';
import { getEvidenceWorkspace } from '../evidence/queries';
import { getCollaboration } from '../collaboration/service';
import { searchIndex, type SearchHit } from '../records/search';
export async function globalSearch(actor:Actor,query:string,kind='all',page=1) {
  assertStaff(actor);if(query.length>200||!['all','amount','engagement','line','document','page','field','lot','asset','prior','conversation'].includes(kind))throw new HttpError(400,'Use a supported search type and a query of at most 200 characters.');
  const engagements=await searchEngagements(actor,'');const result:SearchHit[]=[];const q=query.trim().toLowerCase();
  if(q)for(const engagement of engagements) {
    const base=`/engagements/${engagement.clientId}/${engagement.taxYear}`;
    if(`${engagement.name} ${engagement.clientId} ${engagement.taxYear}`.toLowerCase().includes(q))result.push({kind:'engagement',label:engagement.name,detail:`${engagement.clientId} · ${engagement.taxYear}`,ref:engagement.clientId,href:`${base}/records`,clientId:engagement.clientId,taxYear:engagement.taxYear});
    const [workspace,collaboration]=await Promise.all([getEvidenceWorkspace(actor,engagement.clientId,engagement.taxYear,{maskSensitive:true}),getCollaboration(actor,engagement.clientId,engagement.taxYear,q)]);
    result.push(...searchIndex(workspace.index,query,base,engagement.clientId,engagement.taxYear,kind==='amount'));
    for(const item of collaboration.items)result.push({kind:'conversation',label:item.title,detail:`${item.kind} · ${item.audience} · ${item.status}`,ref:item.id,href:`${base}/workflow?item=${item.id}`,clientId:engagement.clientId,taxYear:engagement.taxYear});
  }
  const filtered=result.filter(r=>kind==='all'||(kind==='amount'?['line','page','field','lot','asset','prior'].includes(r.kind):r.kind===kind));
  const pageNumber=Number.isFinite(page)?Math.max(1,Math.min(10000,Math.trunc(page))):1;
  return {query,kind,total:filtered.length,page:pageNumber,pageSize:30,rows:filtered.slice((pageNumber-1)*30,pageNumber*30)};
}
