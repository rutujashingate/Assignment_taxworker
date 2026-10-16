import { requireActor } from '@/lib/auth/session';
import { getRecords } from '@/lib/records/queries';
import { failure,privateHeaders } from '@/lib/collaboration/http';
export async function GET(_request:Request,{params}:{params:Promise<{clientId:string;taxYear:string;area:string}>}) {
  try{const actor=await requireActor();const p=await params;const {workspace,model,lots,groups,reviews,canReview}=await getRecords(actor,p.clientId,Number(p.taxYear),p.area);return Response.json({model,lots,groups,reviews,canReview,version:workspace.index.version.version,masked:workspace.masked},{headers:privateHeaders});}catch(e){return failure(e);}
}
