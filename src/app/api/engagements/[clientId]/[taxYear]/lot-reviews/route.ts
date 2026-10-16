import { requireActor } from '@/lib/auth/session';
import { assertSameOrigin } from '@/lib/auth/permissions';
import { bulkReviewLots } from '@/lib/records/queries';
import { failure,jsonBody,privateHeaders } from '@/lib/collaboration/http';
export async function POST(request:Request,{params}:{params:Promise<{clientId:string;taxYear:string}>}) {
  try{assertSameOrigin(request);const actor=await requireActor();const p=await params;return Response.json(await bulkReviewLots(actor,p.clientId,Number(p.taxYear),await jsonBody(request)),{headers:privateHeaders});}catch(e){return failure(e);}
}
