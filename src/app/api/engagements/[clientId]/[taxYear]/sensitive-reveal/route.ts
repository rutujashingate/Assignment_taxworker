import { requireActor } from '@/lib/auth/session';
import { assertSameOrigin, HttpError } from '@/lib/auth/permissions';
import { revealSensitiveValue } from '@/lib/evidence/queries';
import { failure, jsonBody, privateHeaders } from '@/lib/collaboration/http';
export async function POST(request:Request,{params}:{params:Promise<{clientId:string;taxYear:string}>}) {
  try{assertSameOrigin(request);const actor=await requireActor();const p=await params;const input=await jsonBody(request);if(!input||typeof input!=='object'||!('ref' in input)||typeof input.ref!=='string')throw new HttpError(400,'Provide an extracted-value reference.');
    return Response.json(await revealSensitiveValue(actor,p.clientId,Number(p.taxYear),input.ref),{headers:privateHeaders});
  }catch(e){return failure(e);}
}
