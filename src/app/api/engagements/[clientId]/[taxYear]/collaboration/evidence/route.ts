import { requireActor } from '@/lib/auth/session';
import { HttpError } from '@/lib/auth/permissions';
import { getCollaborationEvidence, sharedSource } from '@/lib/collaboration/service';
import { failure, privateHeaders } from '@/lib/collaboration/http';
export async function GET(request:Request,{params}:{params:Promise<{clientId:string;taxYear:string}>}) {
  try{const actor=await requireActor();const p=await params;const search=new URL(request.url).searchParams;const ref=search.get('ref');if(!ref||ref.length>500)throw new HttpError(400,'Provide a valid evidence reference.');
    const item=search.get('item');return Response.json(item?await sharedSource(actor,p.clientId,Number(p.taxYear),item,ref):await getCollaborationEvidence(actor,p.clientId,Number(p.taxYear),ref),{headers:privateHeaders});
  }catch(e){return failure(e);}
}
