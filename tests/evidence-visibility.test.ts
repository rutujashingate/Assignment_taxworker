import { beforeAll, expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import { pool } from "../src/lib/db/client";
import { getEvidenceWorkspace, inspectEvidence, recordEvidenceView, documentView, documentIndex } from "../src/lib/evidence/queries";
import { actor, setupDatabase } from "./helpers";

beforeAll(setupDatabase);
test("clients and unauthorized engagements cannot load any source workspace", async () => {
  for (const id of ["cu-01","cu-02"]) await expect(getEvidenceWorkspace(await actor(id),"CL-20417",2025)).rejects.toMatchObject({status:403});
  await expect(getEvidenceWorkspace(await actor("st-01"),"other",2025)).rejects.toMatchObject({status:403});
});
test("all-document index preserves full counts and filters availability and extraction state", async () => {
  const workspace = await getEvidenceWorkspace(await actor("st-01"),"CL-20417",2025);
  const result = documentIndex(workspace);
  expect(result.total).toEqual({total:74,extracted:68,partial:2,not_extracted:4});
  expect(result.available).toBe(72); expect(result.withheld).toBe(2);
  expect(result.states).toEqual({extracted:67,partial:2,not_extracted:3});
  expect(result.rows).toHaveLength(72);
  expect(documentIndex(workspace,"D29").rows.map(row=>row.id)).toEqual(["D29"]);
  expect(documentIndex(workspace,"","partial").rows.map(row=>row.id).sort()).toEqual(["D30","D31"]);
  expect(documentIndex(workspace,"D71").rows).toEqual([]);
  expect(()=>documentView(workspace.index,"D72")).toThrow("unavailable");
});
test("uncleared source, household and pointer responses contain no raw sensitive identifiers", async () => {
  const workspace = await getEvidenceWorkspace(await actor("st-04"),"CL-20417",2025);
  const packet = JSON.parse(await readFile("data/okafor_lindqvist_2025_packet.json","utf8"));
  const output = JSON.stringify([inspectEvidence(workspace,"D08"),inspectEvidence(workspace,"ev-0015"),inspectEvidence(workspace,"household:ngozi"),inspectEvidence(workspace,"D03"),inspectEvidence(workspace,"D36")]);
  expect(output).not.toContain(packet.household.people[0].ssn);
  expect(output).not.toContain(String(packet.household.people[0].ip_pin));
  expect(output).not.toContain(packet.extracted_values.find((item:{id:string})=>item.id==="ev-0963").value);
  expect(output).toContain("[REDACTED");
  expect(workspace.index.resolve("v2").status).toBe("resolved");
  expect(inspectEvidence(workspace,"msg-08").node.status).toBe("missing_source");
  expect(inspectEvidence(workspace,"agency:/efile").record).toEqual([]);
});
test("opening evidence appends a durable view audit with scope and no copied source values", async () => {
  const workspace = await getEvidenceWorkspace(await actor("st-05"),"CL-20417",2025);
  const before = (await pool.query("SELECT count(*)::int AS count FROM audit_event WHERE actor_id='st-05' AND action='evidence_viewed'")).rows[0].count;
  await recordEvidenceView(workspace,"ev-0538");
  const rows = await pool.query("SELECT target, after_json FROM audit_event WHERE actor_id='st-05' AND action='evidence_viewed' ORDER BY id DESC");
  expect(rows.rows).toHaveLength(before+1);
  expect(rows.rows[0]).toMatchObject({target:"ev-0538",after_json:{reference:"ev-0538",asOf:"2026-06-23T06:05:00Z",sensitiveIdentifiersMasked:false}});
  expect(JSON.stringify(rows.rows[0])).not.toMatch(/1840|1,840|printed_content|ssn/);
});
test("a failed evidence view audit is surfaced rather than silently ignored", async () => {
  const workspace = await getEvidenceWorkspace(await actor("st-05"),"CL-20417",2025);
  await pool.query("CREATE FUNCTION test_reject_evidence_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='evidence_viewed' THEN RAISE EXCEPTION 'view log unavailable'; END IF; RETURN NEW; END; $$");
  await pool.query("CREATE TRIGGER test_evidence_audit_failure BEFORE INSERT ON audit_event FOR EACH ROW EXECUTE FUNCTION test_reject_evidence_audit()");
  try { await expect(recordEvidenceView(workspace,"D08")).rejects.toThrow(); }
  finally { await pool.query("DROP TRIGGER test_evidence_audit_failure ON audit_event"); await pool.query("DROP FUNCTION test_reject_evidence_audit()"); }
});
