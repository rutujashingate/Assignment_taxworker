import { requireActor } from '@/lib/auth/session';
import { assertSameOrigin, HttpError } from '@/lib/auth/permissions';
import { addAttachment } from '@/lib/collaboration/service';
import { boundedBody, failure, privateHeaders } from '@/lib/collaboration/http';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{clientId:string;taxYear:string}>}) {
  try {
    assertSameOrigin(request);const actor=await requireActor();const p=await params;
    const bytes=await boundedBody(request,2200000);
    const form=await new Request(request.url,{method:'POST',headers:{'content-type':request.headers.get('content-type')??''},body:bytes}).formData();
    const file=form.get('file');
    if(file!==null&&typeof file==='string')throw new HttpError(400,'Provide a file upload.');
    const result=await addAttachment(actor,p.clientId,Number(p.taxYear),{itemId:form.get('itemId'),expectedRevision:Number(form.get('expectedRevision')),
      kind:form.get('kind'),name:form.get('name'),...(form.get('kind')==='note'?{note:form.get('note')}:{})},
      file&&file.size?{bytes:Buffer.from(await file.arrayBuffer()),type:file.type}:undefined);
    return Response.json(result,{headers:privateHeaders});
  }catch(e){return failure(e);}
}
