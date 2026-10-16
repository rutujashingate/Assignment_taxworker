import { requireActor } from '@/lib/auth/session';
import { assertSameOrigin } from '@/lib/auth/permissions';
import { getSeason,seasonCommand } from '@/lib/season/service';
import { failure,jsonBody,privateHeaders } from '@/lib/collaboration/http';
type Context={params:Promise<{clientId:string;taxYear:string}>};
export const runtime='nodejs';
export async function GET(request:Request,{params}:Context) {
  try {const actor=await requireActor(),p=await params,q=new URL(request.url).searchParams;
    return Response.json(await getSeason(actor,p.clientId,Number(p.taxYear),{before:q.get('before')??undefined,after:q.get('after')??undefined,scenario:q.get('scenario')??undefined}),{headers:privateHeaders});
  }catch(e){return failure(e);}
}
export async function POST(request:Request,{params}:Context) {
  try {assertSameOrigin(request);const actor=await requireActor(),p=await params;return Response.json(await seasonCommand(actor,p.clientId,Number(p.taxYear),await jsonBody(request)),{headers:privateHeaders});}catch(e){return failure(e);}
}
