import { requireActor } from '@/lib/auth/session';
import { getCollaborationItem } from '@/lib/collaboration/service';
import { failure, privateHeaders } from '@/lib/collaboration/http';
export async function GET(_request:Request,{params}:{params:Promise<{clientId:string;taxYear:string;itemId:string}>}) {
  try{const actor=await requireActor();const p=await params;return Response.json(await getCollaborationItem(actor,p.clientId,Number(p.taxYear),p.itemId),{headers:privateHeaders});}catch(e){return failure(e);}
}
