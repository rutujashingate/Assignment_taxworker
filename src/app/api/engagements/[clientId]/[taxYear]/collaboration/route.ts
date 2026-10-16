import { requireActor } from '@/lib/auth/session';
import { assertSameOrigin } from '@/lib/auth/permissions';
import { collaborationCommand, getCollaboration } from '@/lib/collaboration/service';
import { failure, jsonBody, privateHeaders } from '@/lib/collaboration/http';
type Context={params:Promise<{clientId:string;taxYear:string}>};
export const runtime='nodejs';
export async function GET(request:Request,{params}:Context) {
  try{const actor=await requireActor();const p=await params;return Response.json(await getCollaboration(actor,p.clientId,Number(p.taxYear),new URL(request.url).searchParams.get('q')??''),{headers:privateHeaders});}catch(e){return failure(e);}
}
export async function POST(request:Request,{params}:Context) {
  try{assertSameOrigin(request);const actor=await requireActor();const p=await params;return Response.json(await collaborationCommand(actor,p.clientId,Number(p.taxYear),await jsonBody(request)),{headers:privateHeaders});}catch(e){return failure(e);}
}
