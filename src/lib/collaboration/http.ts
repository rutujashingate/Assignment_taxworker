import { apiError, HttpError } from '../auth/permissions';
export const privateHeaders={'Cache-Control':'private, no-store','Vary':'Cookie'};
export function failure(error:unknown) {const r=apiError(error);for(const [key,value] of Object.entries(privateHeaders))r.headers.set(key,value);return r;}
export async function boundedBody(request:Request,max=65536) {
  if(Number(request.headers.get('content-length'))>max)throw new HttpError(413,'Request exceeds the supported size.');
  const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'Request body is required.');
  const chunks:Uint8Array[]=[];let size=0;
  try { for(;;) {const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>max){await reader.cancel();throw new HttpError(413,'Request exceeds the supported size.');}chunks.push(next.value);} }
  finally {reader.releaseLock();}
  const body=new Uint8Array(size);let offset=0;for(const part of chunks){body.set(part,offset);offset+=part.length;}
  return body;
}
export async function jsonBody(request:Request) {
  const bytes=await boundedBody(request);
  try{return JSON.parse(new TextDecoder().decode(bytes)) as unknown;}catch{throw new HttpError(400,'Provide valid JSON.');}
}
