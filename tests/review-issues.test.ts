import { beforeAll, expect, test } from "vitest";
import { pool } from "../src/lib/db/client";
import { getEvidenceWorkspace } from "../src/lib/evidence/queries";
import { getReviewDesk, updateIssue, filterIssues } from "../src/lib/review/issues";
import { getPreferences, updatePreferences } from "../src/lib/workpaper/preferences";
import { actor, setupDatabase } from "./helpers";

beforeAll(async()=>{await setupDatabase();for(const id of ["st-01","st-02"]){const person=await actor(id),preference=await getPreferences(person,"CL-20417",2025);if(preference.selectedVersion!=="v3")await updatePreferences(person,"CL-20417",2025,{selectedVersion:"v3",expectedRevision:preference.revision});}});
async function desk(id="st-01"){return getReviewDesk(await getEvidenceWorkspace(await actor(id),"CL-20417",2025));}
async function command(){const current=await desk();const issue=current.issues.find(item=>item.finding.code==="INTEREST_SWEEP_OVERLAP")!;return {issue,body:{version:current.version,status:"investigating",assigneeId:"st-02",note:"Comparing the sweep account records.",evidenceRefs:["ev-0492","ev-0538"],expectedRevision:issue.revision}};}
test("initialization and repeated checks do not duplicate findings or reset triage",async()=>{
  const first=await desk();expect(first.issues).toHaveLength(6);expect(first.checks.filter(item=>item.outcome==="pass")).toHaveLength(1);expect(first.diagnostics).toHaveLength(11);
  const second=await desk();expect(second.issues).toEqual(first.issues);
  const count=await pool.query("SELECT count(*)::int AS count FROM workpaper_issue WHERE client_id='CL-20417' AND tax_year=2025 AND version=$1",[first.version]);expect(count.rows[0].count).toBe(6);
});
test("triage state, assignee and supporting evidence persist with one audit per update",async()=>{
  const {issue,body}=await command();body.status=issue.status==="investigating"?"open":"investigating";
  const before=(await pool.query("SELECT count(*)::int AS count FROM audit_event WHERE action='review_issue_updated'")).rows[0].count;
  const saved=await updateIssue(await actor("st-01"),"CL-20417",2025,issue.key,body);
  expect(saved.revision).toBe(issue.revision+1);expect(saved.assigneeId).toBe("st-02");
  const reviewer=await actor("st-02"),preference=await getPreferences(reviewer,"CL-20417",2025);
  if(preference.selectedVersion!==saved.version)await updatePreferences(reviewer,"CL-20417",2025,{selectedVersion:saved.version,expectedRevision:preference.revision});
  expect((await desk("st-02")).issues.find(item=>item.key===issue.key)).toEqual(saved);
  expect((await pool.query("SELECT count(*)::int AS count FROM audit_event WHERE action='review_issue_updated'")).rows[0].count).toBe(before+1);
  expect(filterIssues([saved],{status:saved.status,blocker:"blocking",area:"interest",assignee:"st-02"})).toHaveLength(1);
  expect(filterIssues([saved],{assignee:"unassigned"})).toEqual([]);
});
test("all five review states persist while source and computed values remain unchanged",async()=>{
  const {issue:initial,body}=await command();let issue=initial;
  for(const status of ["open","investigating","waiting","explained","resolved_with_evidence"]){issue=await updateIssue(await actor("st-01"),"CL-20417",2025,issue.key,{...body,status,expectedRevision:issue.revision});expect(issue.status).toBe(status);}
  const workspace=await getEvidenceWorkspace(await actor("st-01"),"CL-20417",2025);
  expect(workspace.index.lines.get("F1040.2b")?.value).toBe(6450);expect(workspace.index.values.get("ev-0538")?.value).toBe(1840);
  expect((await getReviewDesk(workspace)).issues.find(item=>item.key===issue.key)?.status).toBe("resolved_with_evidence");
});
test("conflicting reviewers receive exactly one success and a safe 409",async()=>{
  const {issue,body}=await command();const results=await Promise.allSettled(["Concurrent review A.","Concurrent review B."].map(note=>updateIssueBody(issue.key,{...body,note})));
  expect(results.filter(result=>result.status==="fulfilled")).toHaveLength(1);const rejected=results.find(result=>result.status==="rejected") as PromiseRejectedResult;expect(rejected.reason).toMatchObject({status:409});
});
async function updateIssueBody(key:string,body:unknown){return updateIssue(await actor("st-01"),"CL-20417",2025,key,body);}
test("forbidden roles, future/client assignees and unsupported evidence are rejected",async()=>{
  const {issue,body}=await command();
  for(const id of ["cu-01","cu-02","st-05"])await expect(updateIssue(await actor(id),"CL-20417",2025,issue.key,body)).rejects.toMatchObject({status:403});
  await expect(updateIssue(await actor("st-01"),"other",2025,issue.key,body)).rejects.toMatchObject({status:403});
  await expect(updateIssueBody(issue.key,{...body,version:"v1"})).rejects.toMatchObject({status:409});
  await expect(getEvidenceWorkspace(await actor("cu-01"),"CL-20417",2025)).rejects.toMatchObject({status:403});
  for(const assigneeId of ["st-06","cu-01","st-05","invented"])await expect(updateIssueBody(issue.key,{...body,assigneeId})).rejects.toMatchObject({status:400});
  for(const evidenceRefs of [["msg-08"],["ev-1049"],["invented"]])await expect(updateIssueBody(issue.key,{...body,evidenceRefs})).rejects.toMatchObject({status:400});
  await expect(updateIssueBody(issue.key,{...body,status:"resolved_with_evidence",evidenceRefs:["F1040.2b"]})).rejects.toMatchObject({status:400});
  await expect(updateIssueBody(issue.key,{...body,status:"explained",note:""})).rejects.toMatchObject({status:400});
  await expect(updateIssueBody(issue.key,{...body,role:"partner"})).rejects.toMatchObject({status:400});
});
test("an ambiguous gift cannot be resolved with its own uncertain reading",async()=>{
  const current=await desk();const gift=current.issues.find(issue=>issue.finding.code==="CHARITY_AMOUNT_UNCLEAR")!;
  await expect(updateIssueBody(gift.key,{version:current.version,status:"resolved_with_evidence",assigneeId:null,note:"Assumed extraction is the final gift amount.",evidenceRefs:["ev-1049"],expectedRevision:gift.revision})).rejects.toMatchObject({status:400});
});
test("uncleared staff receive masked notes and cannot overwrite protected identifiers",async()=>{
  const {issue,body}=await command();const preparer=await actor("st-01"),uncleared=await actor("st-04");
  const source=await getEvidenceWorkspace(preparer,"CL-20417",2025);const ssn=String(source.index.values.get("ev-0015")!.value);
  const saved=await updateIssue(preparer,"CL-20417",2025,issue.key,{...body,note:`Check the protected taxpayer identifier ${ssn} in its source.`});
  const preference=await getPreferences(uncleared,"CL-20417",2025);if(preference.selectedVersion!==saved.version)await updatePreferences(uncleared,"CL-20417",2025,{selectedVersion:saved.version,expectedRevision:preference.revision});
  const masked=(await desk("st-04")).issues.find(item=>item.key===issue.key)!;expect(masked.note).not.toContain(ssn);expect(masked.note).toContain("[REDACTED SSN]");
  await expect(updateIssue(uncleared,"CL-20417",2025,issue.key,{...body,note:"Replace the protected note.",expectedRevision:masked.revision})).rejects.toMatchObject({status:403});
  await updateIssue(uncleared,"CL-20417",2025,issue.key,{...body,status:"waiting",note:masked.note,expectedRevision:masked.revision});
  expect((await desk()).issues.find(item=>item.key===issue.key)?.note).toBe(saved.note);
});
test("audit failure rolls back the real triage update",async()=>{
  const {issue,body}=await command();
  await pool.query("CREATE FUNCTION test_reject_issue_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='review_issue_updated' THEN RAISE EXCEPTION 'review audit unavailable'; END IF; RETURN NEW; END; $$");
  await pool.query("CREATE TRIGGER test_issue_audit_failure BEFORE INSERT ON audit_event FOR EACH ROW EXECUTE FUNCTION test_reject_issue_audit()");
  try{await expect(updateIssueBody(issue.key,{...body,note:"This update must roll back."})).rejects.toThrow();}
  finally{await pool.query("DROP TRIGGER test_issue_audit_failure ON audit_event");await pool.query("DROP FUNCTION test_reject_issue_audit()");}
  expect((await desk()).issues.find(item=>item.key===issue.key)).toEqual(issue);
});
