import { requireActor } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/auth/permissions";
import { getEvidenceWorkspace } from "@/lib/evidence/queries";
import { getReviewDesk, filterIssues } from "@/lib/review/issues";

export const runtime="nodejs";
export async function GET(request:Request,{params}:{params:Promise<{clientId:string;taxYear:string}>}) {
  try {
    const actor=await requireActor(),{clientId,taxYear}=await params;
    if(!/^\d{4}$/u.test(taxYear))throw new HttpError(400,"Invalid tax year.");
    const desk=await getReviewDesk(await getEvidenceWorkspace(actor,clientId,Number(taxYear)));
    const query=new URL(request.url).searchParams;
    const issues=filterIssues(desk.issues,{status:query.get("status")??undefined,blocker:query.get("blocker")??undefined,area:query.get("area")??undefined,assignee:query.get("assignee")??undefined});
    return Response.json({...desk,issues},{headers:{"Cache-Control":"private, no-store"}});
  } catch(error){const response=apiError(error);response.headers.set("Cache-Control","private, no-store");return response;}
}
