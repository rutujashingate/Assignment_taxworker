import { redirect } from 'next/navigation';
import { currentActor } from '@/lib/auth/session';
import { getSeason,getFilings } from '@/lib/season/service';
import { SeasonDesk } from '@/components/season-desk';
import { FilingPanel } from '@/components/filing-panel';
export default async function History({params,searchParams}:{params:Promise<{clientId:string;taxYear:string}>;searchParams:Promise<{before?:string;after?:string;scenario?:string}>}) {
  const actor=await currentActor();if(!actor)redirect('/firm');
  const [p,q]=await Promise.all([params,searchParams]);const base=`/engagements/${p.clientId}/${p.taxYear}`;
  if(actor.role==='client')redirect(`${base}/workflow`);
  const data=await getSeason(actor,p.clientId,Number(p.taxYear),q),filings=await getFilings(actor,p.clientId,Number(p.taxYear));
  return <><SeasonDesk data={data} base={base}/><FilingPanel data={filings} base={base}/></>;
}
