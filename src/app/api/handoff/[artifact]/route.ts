import { requireActor } from '@/lib/auth/session';
import { downloadArtifact } from '@/lib/delivery/service';
import { failure,privateHeaders } from '@/lib/collaboration/http';
export const runtime='nodejs';
export async function GET(_:Request,{params}:{params:Promise<{artifact:string}>}) {
  try{const actor=await requireActor(),{artifact}=await params,result=await downloadArtifact(actor,artifact);
    return new Response(new Uint8Array(result.bytes),{headers:{...privateHeaders,'Content-Type':result.type,'Content-Disposition':`attachment; filename="${result.filename}"`,'X-Content-Type-Options':'nosniff','X-Artifact-SHA256':result.sha256,'Content-Security-Policy':"default-src 'none'; sandbox"}});
  }catch(e){return failure(e);}
}
