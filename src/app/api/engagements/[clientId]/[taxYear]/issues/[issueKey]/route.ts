import { requireActor } from "@/lib/auth/session";
import { apiError, assertSameOrigin, HttpError } from "@/lib/auth/permissions";
import { updateIssue } from "@/lib/review/issues";

export const runtime="nodejs";
export async function POST(request:Request,{params}:{params:Promise<{clientId:string;taxYear:string;issueKey:string}>}) {
  try {
    assertSameOrigin(request);
    const actor=await requireActor(),{clientId,taxYear,issueKey}=await params;
    if(!/^\d{4}$/u.test(taxYear)||issueKey.length>200)throw new HttpError(400,"Invalid issue scope.");
    const native=request.headers.get("content-type")?.split(";")[0].trim()==="application/x-www-form-urlencoded";
    let input:unknown;
    if(native){const form=await request.formData();if(["version","status","assigneeId","note","expectedRevision"].some(key=>form.getAll(key).length!==1))throw new HttpError(400,"Provide one value for each triage field.");
      input={...Object.fromEntries(form),assigneeId:form.get("assigneeId")||null,evidenceRefs:form.getAll("evidenceRefs"),expectedRevision:Number(form.get("expectedRevision"))};
    }else input=await request.json().catch(()=>null);
    const issue=await updateIssue(actor,clientId,Number(taxYear),issueKey,input);
    return native?new Response(null,{status:303,headers:{Location:`/engagements/${clientId}/${taxYear}/review?${new URLSearchParams({issue:issue.key})}`,"Cache-Control":"private, no-store"}}):Response.json(issue,{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){const response=apiError(error);response.headers.set("Cache-Control","private, no-store");return response;}
}
