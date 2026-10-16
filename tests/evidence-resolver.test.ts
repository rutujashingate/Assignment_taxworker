import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, test } from "vitest";
import { packetSchema, type Packet } from "../src/lib/packet/schema";
import { createEvidenceIndex, type TraceNode } from "../src/lib/evidence/resolver";
import { parseReference, pointerTokens, readPointer } from "../src/lib/evidence/references";
import { locatePrintedField, printedFields } from "../src/lib/evidence/printed-fields";
import { maskEvidence } from "../src/lib/evidence/privacy";

let packet: Packet;
beforeAll(async () => { packet = packetSchema.parse(JSON.parse(await readFile("data/okafor_lindqvist_2025_packet.json", "utf8"))); });
function flatten(tree: TraceNode): TraceNode[] { return [tree, ...tree.children.flatMap(flatten)]; }

describe("typed reference syntax", () => {
  test("recognizes every delivered reference family and rejects invalid syntax", () => {
    const cases = { "F1040.2b":"line", "ev-0538":"extracted_value", D29:"document", "doc:D31#page32":"page", "qa-01":"questionnaire", "msg-01":"message", "call-01":"call", "py:/asset_records/0":"pointer", "agency:/efile/0":"pointer", "asset:SAC-BLDG":"asset", "household:ngozi":"household", "ref:param.std_deduction_mfj":"parameter", "ref:fx.SEK.2025_average":"fx", "timeline:extension-2026-04-14":"timeline", v3:"version" };
    for (const [ref, kind] of Object.entries(cases)) expect(parseReference(ref)?.kind).toBe(kind);
    for (const invalid of ["", " doc:D31#page32", "doc:D31#page0", "doc:D31#page-1", "doc:D31#page32x", "py:/bad~2escape", "asset:", "x".repeat(501)]) expect(parseReference(invalid)).toBeNull();
    expect(parseReference("prior_preparer_depreciation_schedule")?.kind).toBe("unknown");
  });
  test("RFC 6901 handles escaped keys, empty keys, null, arrays and prototype boundaries", () => {
    const root = { "a/b": { "~key": [0,false,null] }, "": 7, "a~1b": 9 };
    expect(readPointer(root,pointerTokens("/a~1b/~0key/2")!)).toEqual({found:true,value:null});
    expect(readPointer(root,pointerTokens("/")!)).toEqual({found:true,value:7});
    expect(readPointer(root,pointerTokens("/a~01b")!)).toEqual({found:true,value:9});
    expect(readPointer(root,[]).value).toBe(root);
    expect(readPointer(root,["a/b","~key","01"]).found).toBe(false);
    expect(readPointer(root,["a/b","~key","-"]).found).toBe(false);
    expect(readPointer(root,["__proto__"]).found).toBe(false);
  });
});
describe("actual packet evidence graph", () => {
  test("all v3 line inputs and direct sources resolve without changing their relationships", () => {
    const index = createEvidenceIndex(packet);
    expect(index.lines.size).toBe(627);
    const lines = [...index.lines.values()];
    expect(lines.reduce((n,line)=>n+line.inputs.length,0)).toBe(682);
    expect(lines.reduce((n,line)=>n+line.sources.length,0)).toBe(2015);
    for (const ref of new Set(lines.flatMap(line=>[...line.inputs,...line.sources]))) expect(index.resolve(ref).status,ref).toBe("resolved");
    const tree = flatten(index.trace("F1040.2b"));
    for (const ref of ["SchB.4","SchB.2","SchB.1.1","SchB.1.2","ev-0492","ev-0538","doc:D28#page1","doc:D29#page1","D28","D29"]) expect(tree.some(node=>node.resolution.ref===ref),ref).toBe(true);
    expect(index.lines.get("F1040.2b")?.value).toBe(6450);
    expect(index.lines.get("SchB.4")?.inputs).toEqual(["SchB.2"]);
    expect(tree.some(node=>node.cycle)).toBe(false);
  });
  test("reverse usage follows actual extraction, page, document and downstream edges", () => {
    const index = createEvidenceIndex(packet);
    const usages = index.usage("ev-0538");
    expect(usages.find(item=>item.line.key==="SchB.1.2")?.direct).toBe(true);
    expect(usages.find(item=>item.line.key==="F1040.2b")?.direct).toBe(false);
    for (const ref of ["D29","doc:D29#page1"]) expect(index.usage(ref).map(item=>item.line.key)).toContain("F1040.2b");
    expect(usages.map(item=>item.line.key)).not.toContain("SchB.1.1");
    expect(index.usage("ev-0492").map(item=>item.line.key)).toContain("SchB.1.1");
  });
  test("resolves actual non-document evidence and preserves six unresolved asset provenance labels", () => {
    const index = createEvidenceIndex(packet);
    for (const ref of ["qa-01","msg-01","call-01","py:/return_2024/lines/F1040.2b","agency:/irs_account_transcript_2025/0","asset:SAC-BLDG","household:ngozi","ref:param.std_deduction_mfj","ref:fx.SEK.2025_average","timeline:extension-2026-04-14","v3"]) expect(index.resolve(ref).status,ref).toBe("resolved");
    const fx = index.resolve("ref:fx.SEK.2025_average");
    expect(fx.status === "resolved" && "data" in fx && fx.data).toBe(9.86);
    expect(index.resolve("py:/return_2024/lines/F1040.2b").relatedRefs.length).toBeGreaterThan(0);
    expect(index.resolve("prior_preparer_depreciation_schedule").status).toBe("missing_source");
    expect((packet.prior_years.asset_records as {sources:string[]}[]).filter(asset=>asset.sources.includes("prior_preparer_depreciation_schedule"))).toHaveLength(6);
    expect(flatten(index.trace("asset:SAC-BLDG")).some(node=>node.resolution.ref==="prior_preparer_depreciation_schedule" && node.resolution.status==="missing_source")).toBe(true);
  });
  test("D30 and D31 page 32 resolve even without an extraction or computed lot link", () => {
    const index = createEvidenceIndex(packet);
    for (const document of ["D30","D31"]) {
      const ref = `doc:${document}#page32`;
      const result = index.resolve(ref);
      expect(result.status).toBe("resolved");
      if (result.status !== "resolved" || result.kind !== "page") throw new Error("Expected page target");
      expect(result.missingExtraction).toBe(true);
      expect(result.page.printed_content).toMatch(/M18 Ironwood REIT.*250.00 basis 310.00/u);
      expect(index.pageValues(document,32)).toEqual([]);
      expect(index.usage(ref)).toEqual([]);
    }
    expect(index.version.documents_superseded).toContain("D30");
  });
  test("version scope, missing targets and cycle/size guards are explicit", () => {
    const changed = structuredClone(packet);
    changed.return_versions[0].lines.find(line=>line.key==="F1040.2b")!.value = 123;
    expect(createEvidenceIndex(changed,"v1").lines.get("F1040.2b")?.value).toBe(123);
    expect(createEvidenceIndex(changed,"v3").lines.get("F1040.2b")?.value).toBe(6450);
    const loop = changed.return_versions[2].lines.find(line=>line.key==="SchB.4")!;
    loop.inputs = ["F1040.2b","NoForm.999"];
    const index = createEvidenceIndex(changed);
    expect(flatten(index.trace("F1040.2b")).some(node=>node.cycle)).toBe(true);
    expect(index.resolve("NoForm.999").status).toBe("missing_source");
    expect(index.resolve("doc:D31#page99").status).toBe("missing_source");
    expect(index.resolve("py:/bad~9").status).toBe("invalid_reference");
    expect(index.usage("F1040.2b").length).toBeLessThan(627);
    const limited = flatten(createEvidenceIndex(packet).trace("F1040.11",5));
    expect(limited.length).toBeLessThanOrEqual(5); expect(limited.some(node=>node.truncated)).toBe(true);
  });
  test("default clock withholds future evidence, while the renderer can address every supplied page", () => {
    const index = createEvidenceIndex(packet);
    expect(index.documents.size).toBe(72);
    for (const ref of ["D71","D72","doc:D72#page1","ev-1080","msg-08","agency:/efile/0","timeline:tl-29"]) expect(index.resolve(ref).status,ref).toBe("missing_source");
    const complete = createEvidenceIndex(packet,"v3","2028-12-31T23:59:59Z");
    let pages=0;
    for (const document of packet.documents) for (const page of document.pages) {
      const resolved = complete.resolve(`doc:${document.id}#page${page.page}`);
      expect(resolved.status).toBe("resolved");
      if (resolved.status === "resolved" && resolved.kind === "page") expect(resolved.page.printed_content).toBe(page.printed_content);
      pages++;
    }
    expect(pages).toBe(199);
  });
});
describe("printed truth and pipeline readings", () => {
  test("locates both exact interest fields and never relies on synthetic coordinates", () => {
    for (const id of ["ev-0492","ev-0538"]) {
      const value = packet.extracted_values.find(item=>item.id===id)!;
      const text = packet.documents.find(doc=>doc.id===value.document_id)!.pages.find(page=>page.page===value.page)!.printed_content;
      const location = locatePrintedField(text,value);
      expect(location.status).toBe("matched");
      if (location.status === "matched") expect(text.slice(location.start,location.end)).toMatch(/box 1 interest.*1,840\.00/iu);
      expect(locatePrintedField(text,{...value,position:{x0:99,y0:99,x1:99,y1:99}})).toEqual(location);
    }
  });
  test("ambiguous, wrong, repeated or unanchored readings never create a false highlight", () => {
    const gift = packet.extracted_values.find(value=>value.id==="ev-1049")!;
    const printed = packet.documents.find(doc=>doc.id==="D64")!.pages[0].printed_content;
    expect(locatePrintedField(printed,gift).status).toBe("unlocalized");
    const interest = packet.extracted_values.find(value=>value.id==="ev-0538")!;
    for (const content of ["An unrelated payment 1,840.00", "Box 1 interest 1,840.00; another 1,840.00", "Box 1 interest 7,840.00", "Box 1 interest 1,000.00. Total balance 1,840.00"]) expect(locatePrintedField(content,interest).status).toBe("unlocalized");
    expect(printedFields("Box 1 interest 1,840.00",[interest,{...interest,id:"ev-9999"}])).toEqual([]);
    expect(gift.value).toBe(1500); expect(printed).toContain("$?,500.00");
  });
  test("uncleared staff masking covers printed text, extraction and nested records without mutating originals", () => {
    const masked = maskEvidence(packet);
    const serialized = JSON.stringify(masked);
    for (const person of packet.household.people) for (const key of ["ssn","ip_pin","dob"]) if (person[key]) expect(serialized).not.toContain(String(person[key]));
    const bank = packet.household.bank_account_for_refund_or_payment as {account:string;routing:string};
    expect(serialized).not.toContain(bank.account); expect(serialized).not.toContain(bank.routing);
    expect(masked.extracted_values.find(value=>value.id==="ev-0015")?.value).toBe("[REDACTED]");
    expect(packet.extracted_values.find(value=>value.id==="ev-0015")?.value).not.toBe("[REDACTED]");
    const index = createEvidenceIndex(masked);
    expect(index.resolve("ev-0538").status).toBe("resolved");
    expect(index.documents.get("D29")?.pages[0].printed_content).toContain("1,840.00");
  });
});
