import { requireActor } from '@/lib/auth/session';
import { assertSameOrigin } from '@/lib/auth/permissions';
import { getFirmAdmin,updateStandards } from '@/lib/firm/service';
import { failure,jsonBody,privateHeaders } from '@/lib/collaboration/http';
export async function GET(r:Request) {try{const p=new URL(r.url).searchParams;return Response.json(await getFirmAdmin(await requireActor(),{actor:p.get('actor')??undefined,action:p.get('action')??undefined,page:Number(p.get('page')??1)}),{headers:privateHeaders});}catch(e){return failure(e);}}
export async function POST(r:Request) {try{assertSameOrigin(r);return Response.json(await updateStandards(await requireActor(),await jsonBody(r)),{headers:privateHeaders});}catch(e){return failure(e);}}
