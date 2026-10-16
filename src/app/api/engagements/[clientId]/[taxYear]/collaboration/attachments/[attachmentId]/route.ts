import { requireActor } from '@/lib/auth/session';
import { downloadAttachment } from '@/lib/collaboration/service';
import { failure, privateHeaders } from '@/lib/collaboration/http';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{clientId:string;taxYear:string;attachmentId:string}>}) {
  try{const actor=await requireActor();const p=await params;const file=await downloadAttachment(actor,p.clientId,Number(p.taxYear),p.attachmentId);
    const name=file.name.replace(/[^a-zA-Z0-9 ._-]/gu,'_');
    return new Response(new Uint8Array(file.bytes),{headers:{...privateHeaders,'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${name}"`,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
  }catch(e){return failure(e);}
}
