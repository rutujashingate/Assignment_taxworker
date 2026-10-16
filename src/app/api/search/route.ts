import { requireActor } from '@/lib/auth/session';
import { globalSearch } from '@/lib/firm/search';
import { failure,privateHeaders } from '@/lib/collaboration/http';
export async function GET(r:Request) {try{const p=new URL(r.url).searchParams;return Response.json(await globalSearch(await requireActor(),p.get('q')??'',p.get('kind')??'all',Number(p.get('page')??1)),{headers:privateHeaders});}catch(e){return failure(e);}}
