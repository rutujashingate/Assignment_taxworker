import { readFile } from "node:fs/promises";
import { beforeAll, expect, test } from "vitest";
import { packetSchema, type Packet } from "../src/lib/packet/schema";
import { createEvidenceIndex } from "../src/lib/evidence/resolver";
import { maskEvidence } from "../src/lib/evidence/privacy";
import { runIndependentChecks } from "../src/lib/review/checks";

let packet:Packet;
beforeAll(async()=>{packet=packetSchema.parse(JSON.parse(await readFile("data/okafor_lindqvist_2025_packet.json","utf8")));});
const checks=(input=packet,version="v3")=>runIndependentChecks(createEvidenceIndex(input,version));
function check(code:string,input=packet) {const result=checks(input).find(item=>item.code===code);if(!result)throw new Error(`Missing check ${code}`);return result;}
const line=(input:Packet,key:string)=>input.return_versions[2].lines.find(item=>item.key===key)!;
test("six v3 findings have complete contracts and remain separate from engine diagnostics",()=>{
  const before=JSON.stringify(packet); const results=checks();
  expect(results).toHaveLength(7);expect(results.filter(item=>item.outcome!=="pass")).toHaveLength(6);
  const index=createEvidenceIndex(packet);
  for(const result of results){expect(result.version).toBe("v3");expect(result.code).toBeTruthy();expect(result.explanation.length).toBeGreaterThan(60);expect(result.observed).toBeDefined();expect(result.expected).toBeDefined();expect(result.inputRefs).toContain(result.action.ref);for(const ref of result.inputRefs)expect(index.resolve(ref).status,ref).toBe("resolved");}
  expect(results.map(item=>item.code)).not.toContain("LOW_CONFIDENCE_READ");
  const withoutEngineMessages=structuredClone(packet);withoutEngineMessages.return_versions[2].diagnostics=[];expect(checks(withoutEngineMessages)).toEqual(results);
  expect(packet.return_versions[2].diagnostics).toHaveLength(11);expect(JSON.stringify(packet)).toBe(before);
});
test("checks are deterministic across reruns, input ordering and masked staff views",()=>{
  const reordered=structuredClone(packet);reordered.documents.reverse();reordered.extracted_values.reverse();reordered.return_versions[2].lines.reverse();
  for(const doc of reordered.documents)doc.pages.reverse();
  expect(checks()).toEqual(checks());expect(checks(reordered)).toEqual(checks());
  expect(runIndependentChecks(createEvidenceIndex(maskEvidence(packet)))).toEqual(checks());
});
test("Northlake candidate requires matching economic identity and two used contributions",()=>{
  const result=check("INTEREST_SWEEP_OVERLAP");
  expect(result).toMatchObject({outcome:"candidate",certainty:"probable",observed:{usedReportedTotal:3680}});
  expect(result.inputRefs).toEqual(expect.arrayContaining(["ev-0492","ev-0538","SchB.1.1","SchB.1.2","doc:D28#page1","doc:D29#page1"]));
  const different=structuredClone(packet);different.documents.find(doc=>doc.id==="D29")!.pages[0].printed_content=different.documents.find(doc=>doc.id==="D29")!.pages[0].printed_content.replace("7731","9999");
  expect(checks(different).some(item=>item.code==="INTEREST_SWEEP_OVERLAP"&&item.outcome!=="pass")).toBe(false);
  const oneUsed=structuredClone(packet);line(oneUsed,"SchB.2").inputs=line(oneUsed,"SchB.2").inputs.filter(key=>key!=="SchB.1.2");
  expect(check("INTEREST_SWEEP_OVERLAP",oneUsed).outcome).toBe("pass");
});
test("mileage compares exact trip identity and unique printed totals, not matching page amounts",()=>{
  const result=check("MILEAGE_DUPLICATE_PAGES");
  expect(result).toMatchObject({outcome:"confirmed_mismatch",certainty:"certain",observed:{reportedMiles:11800,duplicatePageGroups:[[2,3]]},expected:{uniquePageMiles:8100,excessMiles:3700}});
  const unique=structuredClone(packet);const page=unique.documents.find(doc=>doc.id==="D23")!.pages.find(page=>page.page===3)!;page.printed_content=page.printed_content.replace("Pixel Press print shop, Sacramento","Different client location, Sacramento");
  expect(check("MILEAGE_DUPLICATE_PAGES",unique).outcome).toBe("pass");
});
test("receipts overlap uses recorded gross-deposit context and actual SchC source usage",()=>{
  const result=check("CARD_RECEIPTS_OVERLAP");
  expect(result).toMatchObject({outcome:"confirmed_mismatch",observed:{returnGrossReceipts:163700,cardReceipts:12400,booksRevenue:151300},expected:{receiptsAlreadyInBooks:12400,booksGrossBeforeOtherAdjustments:151300}});
  expect(result.inputRefs).toContain("doc:D15#page3");
  const noOverlap=structuredClone(packet);noOverlap.documents.find(doc=>doc.id==="D15")!.pages[2].printed_content=noOverlap.documents.find(doc=>doc.id==="D15")!.pages[2].printed_content.replace("Paywell Payments","Different Processor");
  expect(check("CARD_RECEIPTS_OVERLAP",noOverlap)).toMatchObject({outcome:"needs_information",certainty:"judgment"});
  const notAdded=structuredClone(packet);line(notAdded,"SchC.1").value=151300;
  expect(check("CARD_RECEIPTS_OVERLAP",notAdded).outcome).toBe("pass");
});
test("payment designation reconciles agency amounts and excludes unused wrong-year payments",()=>{
  const result=check("CA_PAYMENT_YEAR");
  expect(result).toMatchObject({outcome:"confirmed_mismatch",observed:{returnClaimed:14000,wrongYearPaymentsUsed:[{date:"2025-09-15",amount:3500,designatedTaxYear:2024}]},expected:{agency2025Payments:10500,printed2025Payments:10500,difference:3500}});
  expect(result.inputRefs).toEqual(expect.arrayContaining(["ev-1074","ev-1075","ev-1076","agency:/ftb_account/tax_year_2025_payments"]));
  expect(result.inputRefs).not.toContain("ev-1063");
  const agrees=structuredClone(packet);line(agrees,"F540NR.72").value=10500;
  expect(check("CA_PAYMENT_YEAR",agrees).outcome).toBe("pass");
  const missing=structuredClone(packet);missing.extracted_values=missing.extracted_values.filter(value=>value.id!=="ev-1076");expect(check("CA_PAYMENT_YEAR",missing)).toMatchObject({outcome:"needs_information",certainty:"judgment"});
  const wrongReading=structuredClone(packet);wrongReading.extracted_values.find(value=>value.id==="ev-1076")!.value="2025";expect(check("CA_PAYMENT_YEAR",wrongReading).observed.wrongYearPaymentsUsed).toEqual([{date:"2025-09-15",amount:3500,designatedTaxYear:2024}]);
});
test("one active M18 finding cites both page records without fabricating an extraction",()=>{
  const findings=checks().filter(item=>item.code==="BROKER_PAGE_UNEXTRACTED");
  expect(findings).toHaveLength(1);expect(findings[0]).toMatchObject({observed:{activeDocument:"D31",page:32,lot:"M18",proceeds:250,basis:310,extractedFields:0},certainty:"certain"});
  expect(findings[0].inputRefs).toEqual(["doc:D30#page32","doc:D31#page32"]);
  const earlier=checks(packet,"v1").filter(item=>item.code==="BROKER_PAGE_UNEXTRACTED");
  expect(earlier).toHaveLength(1);expect(earlier[0].observed.activeDocument).toBe("D30");
});
test("handwritten gift stays unresolved despite extraction confidence or later answers",()=>{
  const result=check("CHARITY_AMOUNT_UNCLEAR");
  expect(result).toMatchObject({outcome:"needs_information",certainty:"judgment",observed:{printedAmount:"$?,500.00",pipelineReading:1500,pipelineConfidence:0.41},expected:{verifiedGiftAmount:null}});
  expect(result.inputRefs).not.toContain("msg-08");
  const confident=structuredClone(packet);confident.extracted_values.find(value=>value.id==="ev-1049")!.confidence=0.99;
  expect(check("CHARITY_AMOUNT_UNCLEAR",confident).outcome).toBe("needs_information");
  const readable=structuredClone(packet);readable.documents.find(doc=>doc.id==="D64")!.pages[0].printed_content="Receipt: gift $1,500.00, no goods or services.";
  expect(check("CHARITY_AMOUNT_UNCLEAR",readable).outcome).toBe("pass");
});
test("D09 and D10 duplicate images do not create a duplicate wage contribution",()=>{
  const result=check("W2_CONTRIBUTION_COUNT");
  expect(result).toMatchObject({outcome:"pass",severity:"info",observed:{duplicateImageGroups:[{documents:["D09","D10"],usedDocuments:["D09"]}]}});
  expect(line(packet,"F1040.1a").sources).toEqual(["ev-0016","ev-0035"]);
  for(const extra of ["ev-0052","ev-0035"]){const duplicated=structuredClone(packet);line(duplicated,"F1040.1a").sources.push(extra);expect(check("W2_CONTRIBUTION_COUNT",duplicated)).toMatchObject({outcome:"candidate",certainty:"probable"});}
});
