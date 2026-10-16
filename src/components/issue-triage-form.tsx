"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ISSUE_STATES, STATE_LABELS, type IssueState, type IssueView } from "@/lib/review/types";

export function IssueTriageForm({ issue, assignees, clientId, taxYear }: {
  issue:IssueView; assignees:{id:string;name:string;role:string}[]; clientId:string; taxYear:number;
}) {
  const router=useRouter(); const [status,setStatus]=useState<IssueState>(issue.status);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[conflict,setConflict]=useState(false);
  const [revision,setRevision]=useState(issue.revision);
  const endpoint=`/api/engagements/${clientId}/${taxYear}/issues/${encodeURIComponent(issue.key)}`;
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form=new FormData(event.currentTarget);
    setBusy(true);setError("");
    try {
      const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({version:issue.version,status,assigneeId:form.get("assigneeId")||null,note:form.get("note"),evidenceRefs:form.getAll("evidenceRefs"),expectedRevision:revision})});
      const result=await response.json();
      if(!response.ok) {if(response.status===409)setConflict(true);throw new Error(result.error??"Triage could not be saved.");}
      setRevision(result.revision);router.refresh();
    } catch(cause) {setError(cause instanceof Error?cause.message:"Please try again.");}
    finally {setBusy(false);}
  }
  return <form className="triage-form" action={endpoint} method="post" onSubmit={event=>void save(event)} aria-label="Issue triage">
    <input name="version" type="hidden" value={issue.version}/><input name="expectedRevision" type="hidden" value={revision}/>
    <div className="triage-controls"><div><label htmlFor="issue-status">Review state</label><select id="issue-status" name="status" value={status} onChange={event=>setStatus(event.target.value as IssueState)} disabled={busy||conflict}>{ISSUE_STATES.map(state=><option key={state} value={state} disabled={state==="resolved_with_evidence"&&issue.finding.outcome==="needs_information"}>{STATE_LABELS[state]}{state==="resolved_with_evidence"&&issue.finding.outcome==="needs_information"?" · clarification needed":""}</option>)}</select></div>
    <div><label htmlFor="issue-assignee">Assignee</label><select id="issue-assignee" name="assigneeId" defaultValue={issue.assigneeId??""} disabled={busy||conflict}><option value="">Unassigned</option>{assignees.map(person=><option key={person.id} value={person.id}>{person.name} · {person.role.replaceAll("_"," ")}</option>)}</select></div></div>
    <label htmlFor="issue-note">Disposition / waiting reason</label><textarea id="issue-note" name="note" defaultValue={issue.note} rows={3} maxLength={2000} disabled={busy||conflict} placeholder="Record what you investigated, what is pending, or why this disposition is supported."/>
    <fieldset disabled={busy||conflict}><legend>Supporting evidence</legend><p>Link available source records for a resolution. A computed line alone is insufficient.</p><div className="triage-evidence">{issue.finding.inputRefs.map(ref=><label key={ref}><input type="checkbox" name="evidenceRefs" value={ref} defaultChecked={issue.evidenceRefs.includes(ref)}/><code>{ref}</code></label>)}</div></fieldset>
    <p className="triage-scope">Saving triage records a review disposition. It does not change a source value, correct the tax return or establish filing readiness.</p>
    {issue.finding.outcome==="needs_information"&&<p className="triage-scope">The donation amount is not established by current evidence. Mark waiting or explain your review; resolution requires clarification evidence in a later phase.</p>}
    <div className="triage-save"><button className="button" type="submit" disabled={busy||conflict}>{busy?"Saving…":"Save triage"}</button><span role="status" aria-label="Triage save status">{busy?"Saving triage…":`Triage stored · revision ${revision}`}</span></div>
    {error&&<p role="alert" className="error-text">{error}</p>}{conflict&&<button type="button" className="text-button" onClick={()=>window.location.reload()}>Reload current issue</button>}
  </form>;
}
