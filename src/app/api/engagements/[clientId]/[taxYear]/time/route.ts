import { requireActor } from '@/lib/auth/session';
import { assertSameOrigin } from '@/lib/auth/permissions';
import { getTime,logTime } from '@/lib/firm/service';
import { failure,jsonBody,privateHeaders } from '@/lib/collaboration/http';
type Context={params:Promise<{clientId:string;taxYear:string}>};
export async function GET(_r:Request,{params}:Context) {try{const a=await requireActor();const p=await params;return Response.json(await getTime(a,p.clientId,Number(p.taxYear)),{headers:privateHeaders});}catch(e){return failure(e);}}
export async function POST(r:Request,{params}:Context) {try{assertSameOrigin(r);const a=await requireActor();const p=await params;return Response.json(await logTime(a,p.clientId,Number(p.taxYear),await jsonBody(r)),{headers:privateHeaders});}catch(e){return failure(e);}}
