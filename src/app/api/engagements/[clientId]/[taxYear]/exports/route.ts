import { requireActor } from '@/lib/auth/session';
import { exportSeason } from '@/lib/season/exports';
import { failure,privateHeaders } from '@/lib/collaboration/http';
type Context={params:Promise<{clientId:string;taxYear:string}>};
export const runtime='nodejs';
export async function GET(request:Request,{params}:Context) {
  try{const actor=await requireActor(),p=await params,q=new URL(request.url).searchParams;
    const output=await exportSeason(actor,p.clientId,Number(p.taxYear),q.get('kind')??'',q.get('id')??undefined);
    return new Response(output.html,{headers:{...privateHeaders,'Content-Type':'text/html; charset=utf-8','Content-Disposition':`attachment; filename="${output.filename}"`,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'",'X-Export-SHA256':output.sha256}});
  }catch(e){return failure(e);}
}
