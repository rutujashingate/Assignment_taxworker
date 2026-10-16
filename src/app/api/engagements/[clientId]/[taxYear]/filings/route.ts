import { requireActor } from '@/lib/auth/session';
import { getFilings } from '@/lib/season/service';
import { failure,privateHeaders } from '@/lib/collaboration/http';
type Context={params:Promise<{clientId:string;taxYear:string}>};
export const runtime='nodejs';
export async function GET(_:Request,{params}:Context) {
  try{const actor=await requireActor(),p=await params;return Response.json(await getFilings(actor,p.clientId,Number(p.taxYear)),{headers:privateHeaders});}catch(e){return failure(e);}
}
