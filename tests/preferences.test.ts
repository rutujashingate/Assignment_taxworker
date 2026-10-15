import { beforeAll, describe, expect, test } from "vitest";
import { pool } from "../src/lib/db/client";
import { getPreferences, updatePreferences } from "../src/lib/workpaper/preferences";
import { setupDatabase, actor } from "./helpers";

beforeAll(setupDatabase);
describe("durable audited preferences", () => {
  test("saved preference persists with exactly one matching audit event", async () => {
    const person = await actor("st-01"); const before = await getPreferences(person, "CL-20417", 2025);
    const prior = (await pool.query("SELECT count(*)::int AS count FROM audit_event WHERE actor_id='st-01' AND action='computed_version_preference_changed'")).rows[0].count;
    const selectedVersion = before.selectedVersion === "v1" ? "v2" : "v1";
    const saved = await updatePreferences(person,"CL-20417",2025,{ selectedVersion,expectedRevision:before.revision });
    expect(await getPreferences(person,"CL-20417",2025)).toEqual(saved);
    expect(saved).toEqual({ selectedVersion, revision: before.revision+1 });
    const audit = await pool.query("SELECT before_json,after_json FROM audit_event WHERE actor_id='st-01' AND action='computed_version_preference_changed' ORDER BY id DESC");
    expect(audit.rows).toHaveLength(prior+1); expect(audit.rows[0]).toEqual({ before_json:before,after_json:saved });
  });
  test("concurrent writes yield one success and one 409 without a second audit", async () => {
    const person = await actor("st-02"); const before = await getPreferences(person,"CL-20417",2025);
    const count = (await pool.query("SELECT count(*)::int AS count FROM audit_event WHERE actor_id='st-02' AND action='computed_version_preference_changed'")).rows[0].count;
    const results = await Promise.allSettled(["v1","v2"].map(selectedVersion => updatePreferences(person,"CL-20417",2025,{ selectedVersion, expectedRevision:before.revision })));
    expect(results.filter(x => x.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(x => x.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ status:409 });
    expect((await getPreferences(person,"CL-20417",2025)).revision).toBe(before.revision+1);
    expect((await pool.query("SELECT count(*)::int AS count FROM audit_event WHERE actor_id='st-02' AND action='computed_version_preference_changed'")).rows[0].count).toBe(count+1);
  });
  test("invalid, client, and out-of-scope writes do not succeed", async () => {
    const preparer = await actor("st-01"); const before = await getPreferences(preparer,"CL-20417",2025);
    await expect(updatePreferences(preparer,"CL-20417",2025,{selectedVersion:"v4",expectedRevision:before.revision})).rejects.toMatchObject({ status:400 });
    await expect(updatePreferences(preparer,"CL-20417",2025,{selectedVersion:"v1",expectedRevision:before.revision,role:"partner"})).rejects.toMatchObject({ status:400 });
    await expect(updatePreferences(await actor("cu-01"),"CL-20417",2025,{selectedVersion:"v1",expectedRevision:0})).rejects.toMatchObject({ status:403 });
    await expect(updatePreferences(preparer,"another-client",2025,{selectedVersion:"v1",expectedRevision:0})).rejects.toMatchObject({ status:403 });
    expect(await getPreferences(preparer,"CL-20417",2025)).toEqual(before);
  });
  test("preferences are isolated by identity and the audit is append-only", async () => {
    const first = await actor("st-03"); const second = await actor("st-04");
    const secondBefore = await getPreferences(second,"CL-20417",2025);
    const current = await getPreferences(first,"CL-20417",2025);
    await updatePreferences(first,"CL-20417",2025,{selectedVersion:"v2",expectedRevision:current.revision});
    expect(await getPreferences(second,"CL-20417",2025)).toEqual(secondBefore);
    await expect(pool.query("UPDATE audit_event SET action=action")).rejects.toThrow("immutable");
    await expect(pool.query("DELETE FROM audit_event")).rejects.toThrow("immutable");
  });
  test("an audit insertion failure rolls back the preference update", async () => {
    const person = await actor("st-04"); const before = await getPreferences(person,"CL-20417",2025);
    // Fail the real command's audit insert inside the isolated test database.
    await pool.query("CREATE FUNCTION test_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.actor_id='st-04' AND NEW.action='computed_version_preference_changed' THEN RAISE EXCEPTION 'audit unavailable'; END IF; RETURN NEW; END; $$");
    await pool.query("CREATE TRIGGER test_audit_failure BEFORE INSERT ON audit_event FOR EACH ROW EXECUTE FUNCTION test_reject_audit()");
    try {
      await expect(updatePreferences(person,"CL-20417",2025,{selectedVersion:"v1",expectedRevision:before.revision})).rejects.toThrow();
    } finally {
      await pool.query("DROP TRIGGER test_audit_failure ON audit_event");
      await pool.query("DROP FUNCTION test_reject_audit()");
    }
    expect(await getPreferences(person,"CL-20417",2025)).toEqual(before);
  });
});
