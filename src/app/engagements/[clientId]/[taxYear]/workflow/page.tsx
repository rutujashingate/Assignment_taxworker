import { redirect } from 'next/navigation';
import { currentActor } from '@/lib/auth/session';
import { getCollaboration } from '@/lib/collaboration/service';
import { WorkflowDesk } from '@/components/workflow-desk';
import { getFilings } from '@/lib/season/service';
import { FilingPanel } from '@/components/filing-panel';
export default async function Workflow({params,searchParams}:{params:Promise<{clientId:string;taxYear:string}>;searchParams:Promise<{item?:string}>}) {
  const actor=await currentActor();if(!actor)redirect('/firm');
  const [p,search]=await Promise.all([params,searchParams]);const data=await getCollaboration(actor,p.clientId,Number(p.taxYear));
  const base=`/engagements/${p.clientId}/${p.taxYear}`;
  const filings=await getFilings(actor,p.clientId,Number(p.taxYear));
  return <><WorkflowDesk key={actor.id} initial={data} initialItem={typeof search.item==='string'?search.item:undefined} base={base}/><FilingPanel data={filings} base={base}/></>;
}
