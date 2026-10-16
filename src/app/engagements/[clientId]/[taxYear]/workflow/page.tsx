import { redirect } from 'next/navigation';
import { currentActor } from '@/lib/auth/session';
import { getCollaboration } from '@/lib/collaboration/service';
import { WorkflowDesk,type QuestionDraft } from '@/components/workflow-desk';
import { getFilings } from '@/lib/season/service';
import { FilingPanel } from '@/components/filing-panel';
import { optionalEvidenceWorkspace } from '@/lib/evidence/queries';
import { getReviewDesk } from '@/lib/review/issues';
import { issuePresentation } from '@/lib/review/presentation';
export default async function Workflow({params,searchParams}:{params:Promise<{clientId:string;taxYear:string}>;searchParams:Promise<{item?:string;request?:string}>}) {
  const actor=await currentActor();if(!actor)redirect('/firm');
  const [p,search]=await Promise.all([params,searchParams]);const data=await getCollaboration(actor,p.clientId,Number(p.taxYear));
  const base=`/engagements/${p.clientId}/${p.taxYear}`;
  const filings=await getFilings(actor,p.clientId,Number(p.taxYear));
  let questionDraft:QuestionDraft|undefined;
  if(data.canCreate&&['preparer','reviewer','partner','quality_reviewer'].includes(actor.role)&&typeof search.request==='string'&&search.request.length<=500){
    const workspace=await optionalEvidenceWorkspace(actor,p.clientId,Number(p.taxYear));
    if(workspace){const desk=await getReviewDesk(workspace),issue=desk.issues.find(i=>i.key===search.request);
      if(issue){const view=issuePresentation(issue.finding);const sourceRefs=issue.finding.inputRefs.filter(ref=>{const r=workspace.index.resolve(ref);return r.status==='resolved'&&['document','page','extracted_value','questionnaire','message'].includes(r.kind);});
        if(sourceRefs.length)questionDraft={title:`Please clarify: ${view.title}`,body:`Please help clarify this item: ${view.title}. ${view.next} Please provide the supporting record or an explanation. No amount has been corrected or verified by this request.`,sourceRefs,returnHref:`${base}/review?${new URLSearchParams({issue:issue.key})}#selected-finding`};
      }
    }
  }
  return <><WorkflowDesk key={`${actor.id}:${search.request??''}`} initial={data} initialItem={typeof search.item==='string'?search.item:undefined} base={base} questionDraft={questionDraft}/><FilingPanel data={filings} base={base}/></>;
}
