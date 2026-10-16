"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ISSUE_STATES, STATE_LABELS, type IssueState, type IssueView } from "@/lib/review/types";

export function IssueTriageForm({ issue, assignees, clientId, taxYear, evidenceLabels={}, nextHref }: {
  issue:IssueView; assignees:{id:string;name:string;role:string}[]; clientId:string; taxYear:number; evidenceLabels?:Record<string,string>; nextHref?:string;
}) {
  const router=useRouter(); const [status,setStatus]=useState<IssueState>(issue.status);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[conflict,setConflict]=useState(false);
  const [revision,setRevision]=useState(issue.revision);
  const [saved,setSaved]=useState(false);
  const endpoint=`/api/engagements/${clientId}/${taxYear}/issues/${encodeURIComponent(issue.key)}`;
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form=new FormData(event.currentTarget);
    setBusy(true);setError("");
    try {
      const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({version:issue.version,status,assigneeId:form.get("assigneeId")||null,note:form.get("note"),evidenceRefs:form.getAll("evidenceRefs"),expectedRevision:revision})});
      const result=await response.json();
      if(!response.ok) {if(response.status===409)setConflict(true);throw new Error(result.error??"Triage could not be saved.");}
      setRevision(result.revision);setSaved(true);router.refresh();
    } catch(cause) {setError(cause instanceof Error?cause.message:"Please try again.");}
    finally {setBusy(false);}
  }
  return <form className="triage-form" action={endpoint} method="post" onChange={()=>setSaved(false)} onSubmit={event=>void save(event)} aria-label="Issue triage">
    <h4 className="review-step-heading"><span>3</span> Save your conclusion</h4><p className="action-instruction">Write what you checked. If you need an answer from the client, use Request information to prepare a question.</p><div className="issue-action-bar"><Link prefetch={false} className="button secondary" href={`/engagements/${clientId}/${taxYear}/workflow?${new URLSearchParams({request:issue.key})}`}>Request information</Link><a className="button secondary" href="#issue-note" onClick={()=>setStatus('explained')}>Explain</a><a className="button secondary" href="#issue-assignee">Assign</a></div>
    <input name="version" type="hidden" value={issue.version}/><input name="expectedRevision" type="hidden" value={revision}/>
    <div className="triage-controls"><div><label htmlFor="issue-status">Review state</label><select id="issue-status" name="status" value={status} onChange={event=>setStatus(event.target.value as IssueState)} disabled={busy||conflict}>{ISSUE_STATES.map(state=><option key={state} value={state} disabled={state==="resolved_with_evidence"&&issue.finding.outcome==="needs_information"}>{STATE_LABELS[state]}{state==="resolved_with_evidence"&&issue.finding.outcome==="needs_information"?" · clarification needed":""}</option>)}</select></div>
    <div><label htmlFor="issue-assignee">Assignee</label><select id="issue-assignee" name="assigneeId" defaultValue={issue.assigneeId??""} disabled={busy||conflict}><option value="">Unassigned</option>{assignees.map(person=><option key={person.id} value={person.id}>{person.name} · {person.role.replaceAll("_"," ")}</option>)}</select></div></div>
    <p className="review-state-help">{({open:'Not checked yet.',investigating:'You are still comparing the records.',waiting:'You need more information. Add what you are waiting for.',explained:'You have recorded an explanation. Add the reason; this does not mean the tax amount was corrected.',resolved_with_evidence:'You have finished this issue’s review. Add your conclusion and select the sources that support it.'})[status]}</p>
    <label htmlFor="issue-note">Reason or explanation</label><textarea id="issue-note" name="note" defaultValue={issue.note} rows={3} maxLength={2000} minLength={['waiting','explained','resolved_with_evidence'].includes(status)?10:undefined} required={['waiting','explained','resolved_with_evidence'].includes(status)} disabled={busy||conflict} placeholder="I compared… I found… The next step is…"/>
    <details className="decision-evidence" open={status==='resolved_with_evidence'||issue.evidenceRefs.length>0}><summary>Link evidence to this decision</summary><fieldset disabled={busy||conflict}><legend>Supporting evidence</legend><p>Select the documents or records you checked. A resolution needs source evidence; a return line alone is insufficient.</p><div className="triage-evidence">{issue.finding.inputRefs.map(ref=><label key={ref}><input type="checkbox" name="evidenceRefs" value={ref} defaultChecked={issue.evidenceRefs.includes(ref)}/><span>{evidenceLabels[ref]??ref}<small>{evidenceLabels[ref]&&ref}</small></span></label>)}</div></fieldset></details>
    {issue.finding.outcome==="needs_information"&&<p className="triage-scope">The donation amount is not established by current evidence. Request confirmation and mark Waiting, or explain why further review is needed. An extracted amount alone cannot resolve this item.</p>}
    <div className="triage-save"><button className="button" type="submit" disabled={busy||conflict}>{busy?"Saving…":"Save review status"}</button><span role="status" aria-label="Triage save status">{busy?'Saving…':saved?'Review saved':''}</span>{(saved||['explained','resolved_with_evidence'].includes(issue.status))&&nextHref&&<Link prefetch={false} className="button secondary" href={nextHref}>Continue to next item →</Link>}</div><p className="unavailable-actions"><strong>Not available:</strong> Record correction and Submit for review. Saving a conclusion does not correct the tax return or record a formal verification sign-off.</p>
    {error&&<p role="alert" className="error-text">{error}</p>}{conflict&&<button type="button" className="text-button" onClick={()=>window.location.reload()}>Reload current issue</button>}
  </form>;
}
