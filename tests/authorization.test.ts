import { beforeAll, describe, expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import { createSession, actorFromToken, listIdentities } from "../src/lib/auth/session";
import { assertSameOrigin, publicIdentity } from "../src/lib/auth/permissions";
import { getEngagement, searchEngagements, engagementStatistics, getImportStatus } from "../src/lib/engagements/queries";
import { availableAgencyRecords, availableClientEvidence } from "../src/lib/packet/availability";
import { setupDatabase, actor } from "./helpers";

beforeAll(setupDatabase);
describe("server authorization and sessions", () => {
  test("signed session survives another read and rejects tampering", async () => {
    const session = await createSession("st-01");
    expect((await actorFromToken(session.token))?.id).toBe("st-01");
    const replacement = session.token.endsWith("0") ? "1" : "0";
    expect(await actorFromToken(session.token.slice(0,-1)+replacement)).toBeNull();
    expect(await actorFromToken("-".repeat(36)+"."+"a".repeat(64))).toBeNull();
    expect(await actorFromToken()).toBeNull();
  });
  test("switching identities revokes the previous cookie", async () => {
    const first = await createSession("st-01");
    const second = await createSession("st-02", first.token);
    expect(await actorFromToken(first.token)).toBeNull();
    expect((await actorFromToken(second.token))?.id).toBe("st-02");
  });
  test("all active roles have engagement-scoped access; future identity is unavailable", async () => {
    const people = await listIdentities();
    expect(people).toHaveLength(7);
    expect(people.map(x => x.id)).not.toContain("st-06");
    for (const person of people) expect((await getEngagement(await actor(person.id), "CL-20417", 2025)).clientId).toBe("CL-20417");
    await expect(createSession("st-06")).rejects.toMatchObject({ status: 403 });
    await expect(createSession("invented")).rejects.toMatchObject({ status: 400 });
    await expect(getEngagement(await actor("st-01"), "CL-other", 2025)).rejects.toMatchObject({ status: 403 });
  });
  test("clients cannot retrieve firm search or internal statistics", async () => {
    for (const id of ["cu-01", "cu-02"]) {
      await expect(searchEngagements(await actor(id), "Okafor")).rejects.toMatchObject({ status: 403 });
      await expect(engagementStatistics(await actor(id), "CL-20417", 2025, "v3")).rejects.toMatchObject({ status: 403 });
      await expect(getImportStatus(await actor(id), "CL-20417", 2025)).rejects.toMatchObject({ status: 403 });
    }
  });
  test("import overview returns only scoped database metadata, never packet content", async () => {
    const person = await actor("st-04");
    const status = await getImportStatus(person, "CL-20417", 2025);
    expect(Object.keys(status).sort()).toEqual(["byteLength","documentCount","extractedValueCount","importedAt","packetHash","pageCount","versions"]);
    expect(status).toMatchObject({ packetHash: "ee01f8508bd2fd9854754b82fd9c4a055bdc55e2778a132002a25381c412ad19", byteLength: 1943262, documentCount: 74, pageCount: 199, extractedValueCount: 3012 });
    expect(status.versions.map(version => version.version)).toEqual(["v1","v2","v3"]);
    expect(Number.isFinite(Date.parse(status.importedAt))).toBe(true);
    expect(JSON.stringify(status)).not.toMatch(/printed_content|ev-0492|ssn|signing_key|raw_json|msg-08|D71|D72/);
    await expect(getImportStatus(person, "CL-other", 2025)).rejects.toMatchObject({ status: 403 });
  });
  test("response allow-lists exclude sensitive source and identity fields", async () => {
    for (const id of ["st-04", "cu-01"]) {
      const person = await actor(id);
      expect(Object.keys(publicIdentity(person)).sort()).toEqual(["id","name","role"]);
      const summary = await getEngagement(person, "CL-20417", 2025);
      expect(Object.keys(summary).sort()).toEqual(["asOf","clientId","computedVersion","jurisdictions","name","readiness","taxYear"]);
      expect(JSON.stringify(summary)).not.toMatch(/ssn|ip_pin|bank_account|signing_key|raw_json|internal_note/);
    }
  });
  test("search finds only the supplied household and has an honest empty state", async () => {
    const person = await actor("st-01");
    for (const query of ["Okafor","Lindqvist","CL-20417","2025","Okafor-Lindqvist"]) expect(await searchEngagements(person, query)).toHaveLength(1);
    expect(await searchEngagements(person, "not a client")).toEqual([]);
  });
  test("cross-origin writes are rejected", () => {
    expect(() => assertSameOrigin(new Request("http://localhost/api/demo-session", { headers: { origin: "https://example.com" } }))).toThrow("Cross-origin");
    expect(() => assertSameOrigin(new Request("http://localhost:3100/api/demo-session", { headers: { host: "127.0.0.1:3100", origin: "http://127.0.0.1:3100", "sec-fetch-site": "same-origin" } }))).not.toThrow();
  });
});
test("availability excludes future documents, answers, staff, and agency outcomes", async () => {
  const packet = JSON.parse(await readFile("data/okafor_lindqvist_2025_packet.json", "utf8"));
  const evidence = availableClientEvidence(packet.client);
  expect(evidence.messages.map(x => x.id)).toEqual(["msg-01","msg-02","msg-03","msg-04","msg-05","msg-06"]);
  const receipts = new Map<string,string>(packet.documents.map((x: { id: string; received_at: string }) => [x.id,x.received_at]));
  const agency = availableAgencyRecords(packet.tax_agency_records, receipts);
  expect(agency.irs_account_transcript_2025).toHaveLength(1);
  expect(agency.efile).toHaveLength(0);
  expect(agency.notices).toHaveLength(1);
  expect(availableAgencyRecords(packet.tax_agency_records, receipts, "2028-01-25T23:59:59Z").notices).toHaveLength(1);
  expect(availableAgencyRecords(packet.tax_agency_records, receipts, "2028-01-26T15:00:00Z").notices).toHaveLength(2);
  expect((await engagementStatistics(await actor("st-01"), "CL-20417", 2025, "v3")).documentCount).toBe(72);
});
