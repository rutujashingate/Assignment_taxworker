import { requireActor } from '@/lib/auth/session';
import { assertSameOrigin, HttpError } from '@/lib/auth/permissions';
import { revealCollaboration } from '@/lib/collaboration/service';
import { failure, jsonBody, privateHeaders } from '@/lib/collaboration/http';
export async function POST(request:Request,{params}:{params:Promise<{clientId:string;taxYear:string}>}) {
  try{assertSameOrigin(request);const actor=await requireActor();const p=await params;const input=await jsonBody(request);if(!input||typeof input!=='object'||!('id' in input)||typeof input.id!=='string')throw new HttpError(400,'Provide a record ID.');
    return Response.json(await revealCollaboration(actor,p.clientId,Number(p.taxYear),input.id),{headers:privateHeaders});
  }catch(e){return failure(e);}
}
