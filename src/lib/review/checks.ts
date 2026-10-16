import type { EvidenceIndex } from "../evidence/resolver";
import { pageReference } from "../evidence/references";
import type { PacketDocument, PacketValue } from "../packet/schema";
import type { CheckResult, TaxArea } from "./types";
import { duplicatePages, groupBy, money, normalize, reconcile, sum } from "./reconcile";

function result(index: EvidenceIndex, code: string, subject: string, values: Omit<CheckResult,"key"|"code"|"version">): CheckResult {
  return { ...values, key: `${code}:${subject}`, code, version: index.version.version, inputRefs: [...new Set(values.inputRefs)].sort() };
}
function unavailable(index: EvidenceIndex, code: string, area: TaxArea, refs: string[]) {
  return result(index,code,"source-gap",{ title:"Required evidence is unavailable",taxArea:area,outcome:"needs_information",severity:"warning",certainty:"judgment",inputRefs:refs,
    observed:{sourceState:"Required source or calculated input could not be read."},expected:{requiredRefs:refs},
    explanation:"This check cannot establish a conclusion with the available records. Missing evidence is not a passing reconciliation.",action:{label:"Inspect required evidence",ref:refs[0]} });
}
const valuesFor = (index: EvidenceIndex, documentId: string) => [...index.values.values()].filter(value=>value.document_id===documentId).sort((a,b)=>a.id.localeCompare(b.id));
const field = (index: EvidenceIndex, documentId: string, name: string) => valuesFor(index,documentId).find(value=>value.field===name);
function reachableLines(index: EvidenceIndex, root: string) {
  const seen = new Set<string>(); const pending = [root];
  for (let offset=0;offset<pending.length;offset++) { const key=pending[offset]; if(seen.has(key)) continue; seen.add(key); pending.push(...(index.lines.get(key)?.inputs??[])); }
  return [...seen].map(key=>index.lines.get(key)).filter(line=>line!==undefined);
}
function usedAt(index: EvidenceIndex, root: string, value: PacketValue) {
  return reachableLines(index,root).filter(line=>line.sources.includes(value.id)).map(line=>line.key).sort();
}

function interestOverlap(index: EvidenceIndex): CheckResult[] {
  const target = "SchB.4";
  if (!index.lines.has(target)) return [unavailable(index,"INTEREST_SWEEP_OVERLAP","interest",[target])];
  const bankNames = [...index.documents.values()].filter(doc=>doc.document_type==="1099-INT").map(doc=>normalize(doc.issuer.replace(/,\s*(N\.?A\.?|Inc\.?|LLC).*$/iu,""))).sort();
  const reports = [...index.documents.values()].sort((a,b)=>a.id.localeCompare(b.id)).flatMap(doc=> {
    const content = doc.pages.map(page=>page.printed_content).join(" ");
    const account = /account ending\s+([a-z0-9-]+)/iu.exec(content)?.[1];
    const bank = bankNames.find(name=>normalize(content).includes(name));
    if (!account || !bank || !/bank sweep/iu.test(content)) return [];
    return valuesFor(index,doc.id).filter(value=>/^(int_1|box1)$/u.test(value.field) && typeof value.value==="number").map(value=>({ doc,value,used:usedAt(index,target,value),identity:`${doc.tax_year}|${doc.belongs_to}|${bank}|${account}` }));
  });
  return groupBy(reports,row=>row.identity).filter(group=>new Set(group.map(row=>row.doc.id)).size>1).map(group=> {
    const used = group.filter(row=>row.used.length>0);
    const duplicate = used.length>1 && new Set(used.flatMap(row=>row.used)).size>1 && new Set(used.map(row=>row.value.value)).size===1;
    return result(index,"INTEREST_SWEEP_OVERLAP",group.map(row=>row.doc.id).sort().join("+"),{
      title:"Bank sweep interest appears in two used reports",taxArea:"interest",outcome:duplicate?"candidate":"pass",severity:duplicate?"blocking":"info",certainty:duplicate?"probable":"certain",
      inputRefs:[target,"F1040.2b",...group.flatMap(row=>[row.value.id,pageReference(row.doc.id,row.value.page),...row.used])],
      observed:{documents:group.map(row=>row.doc.id),usedItems:used.map(row=>({document:row.doc.id,amount:row.value.value,lines:row.used})),usedReportedTotal:sum(used.map(row=>Number(row.value.value)))},
      expected:{economicItems:1,CPAConfirmationRequired:true},
      explanation:duplicate?"The reports identify the same bank sweep program, account ending, owner and tax year, and both extracted interest items feed separate used Schedule B lines. Matching amounts alone are not the basis for this candidate. Confirm the economic overlap before excluding a report.":"Only one matching economic report contributes to the calculation. A duplicate document is not, by itself, duplicate return income.",
      action:{label:"Compare sweep reports",ref:group[0].value.id},
    });
  });
}
function mileage(index: EvidenceIndex): CheckResult {
  const doc = index.documents.get("D23"); const line=index.lines.get("SchC.44a");
  if(!doc || typeof line?.value!=="number") return unavailable(index,"MILEAGE_DUPLICATE_PAGES","business",["D23","SchC.44a"]);
  const pages=duplicatePages(doc.pages);
  if(pages.records.some(page=>page.total===null || page.identity===null)||pages.duplicates.some(group=>new Set(group.map(page=>page.total)).size>1)) return unavailable(index,"MILEAGE_DUPLICATE_PAGES","business",doc.pages.map(page=>pageReference(doc.id,page.page)));
  const mismatch=pages.duplicates.length>0 && !reconcile(line.value,pages.unique).agrees;
  return result(index,"MILEAGE_DUPLICATE_PAGES",doc.id,{
    title:"Mileage includes a duplicated printed page",taxArea:"business",outcome:mismatch?"confirmed_mismatch":"pass",severity:mismatch?"blocking":"info",certainty:"certain",
    inputRefs:[line.key,"SchC.9",...doc.pages.map(page=>pageReference(doc.id,page.page)),...valuesFor(index,doc.id).filter(value=>value.field==="page_total").map(value=>value.id)],
    observed:{reportedMiles:line.value,printedPageTotal:pages.reported,duplicatePageGroups:pages.duplicates.map(group=>group.map(page=>page.page))},
    expected:{uniquePageMiles:pages.unique,excessMiles:reconcile(line.value,pages.unique).difference},
    explanation:mismatch?"Pages with the same dates, destinations, purposes and trip miles occur twice. Counting each unique printed trip sheet once gives the expected page total. This is a source reconciliation, not a recomputed tax deduction.":"No duplicated trip sheet increases the reported mileage relative to the unique printed page totals.",
    action:{label:"Inspect duplicate mileage pages",ref:pageReference(doc.id,pages.duplicates[0]?.[0].page??1)},
  });
}
function receipts(index: EvidenceIndex): CheckResult {
  const books=index.documents.get("D14"),detail=index.documents.get("D15"),card=index.documents.get("D21"),line=index.lines.get("SchC.1");
  const base=field(index,"D14","total_income"),gross=field(index,"D21","box1a"),overlap=field(index,"D15","atlas_paywell");
  if(!books||!detail||!card||typeof line?.value!=="number"||!base||!gross||!overlap) return unavailable(index,"CARD_RECEIPTS_OVERLAP","business",["D14","D15","D21","SchC.1"]);
  const printedBase=/Total income\s+([\d,]+\.\d{2})/iu.exec(books.pages.find(page=>page.page===1)?.printed_content??"");
  const printedGross=/Box 1a[^.]*?([\d,]+\.\d{2})/iu.exec(card.pages[0].printed_content);
  const deposits=detail.pages.find(page=>/Deposits detail/iu.test(page.printed_content));
  const overlapAmount=deposits && /of which\s+([\d,]+\.\d{2})\s+arrived through\s+([A-Za-z ]+?)\s+card processing/iu.exec(deposits.printed_content);
  const supported=printedBase && printedGross && overlapAmount && normalize(card.issuer).includes(normalize(overlapAmount[2])) && books.belongs_to===card.belongs_to && books.tax_year===card.tax_year && /deposited gross/iu.test(deposits!.printed_content) && /Client deposits are recorded as Sales - client projects/iu.test(deposits!.printed_content) && reconcile(money(printedGross[1]),money(overlapAmount[1])).agrees;
  if(!supported) return unavailable(index,"CARD_RECEIPTS_OVERLAP","business",["doc:D14#page1","doc:D15#page3","doc:D21#page1","SchC.1"]);
  const booksAmount=money(printedBase![1]), cardAmount=money(printedGross![1]);
  const used=line.sources.includes(base.id)&&line.sources.includes(gross.id);
  const duplicate=used && reconcile(line.value,sum([booksAmount,cardAmount])).agrees;
  return result(index,"CARD_RECEIPTS_OVERLAP","D14+D15+D21",{
    title:"Card receipts already appear in the business books",taxArea:"business",outcome:duplicate?"confirmed_mismatch":"pass",severity:duplicate?"blocking":"info",certainty:"certain",
    inputRefs:[line.key,base.id,gross.id,overlap.id,"doc:D14#page1",pageReference(detail.id,deposits!.page),"doc:D21#page1"],
    observed:{returnGrossReceipts:line.value,cardReceipts:cardAmount,booksRevenue:booksAmount,usedAsAdditionalSource:used},
    expected:{receiptsAlreadyInBooks:money(overlapAmount![1]),booksGrossBeforeOtherAdjustments:booksAmount},
    explanation:duplicate?"The transaction detail identifies the processor, payer, gross deposits and sales account: the card receipts are already included in books revenue. The return adds the same card report to that books total. Reconcile timing and any other adjustments before changing gross receipts.":"The source overlap is documented, but the return does not add the overlapping card amount to books revenue in the tested manner.",
    action:{label:"Reconcile card deposits to books",ref:pageReference(detail.id,deposits!.page)},
  });
}
function payments(index: EvidenceIndex): CheckResult {
  const doc=index.documents.get("D68"),line=index.lines.get("F540NR.72");
  const agency=index.resolve("agency:/ftb_account/tax_year_2025_payments");
  if(!doc||typeof line?.value!=="number"||agency.status!=="resolved"||!("data" in agency)||!Array.isArray(agency.data)) return unavailable(index,"CA_PAYMENT_YEAR","payments",["D68","F540NR.72","agency:/ftb_account/tax_year_2025_payments"]);
  const printed=[...doc.pages[0].printed_content.matchAll(/(\d{4}-\d{2}-\d{2})\s+([\d,]+\.\d{2})\s+tax year\s+(\d{4})/gu)].map(match=>({date:match[1],amount:money(match[2]),taxYear:Number(match[3])}));
  const usedValues=valuesFor(index,doc.id).filter(value=>/^pay\d+_amount$/u.test(value.field)&&line.sources.includes(value.id));
  const used=usedValues.flatMap(value=>{const prefix=value.field.replace(/_amount$/u,"");const date=field(index,doc.id,`${prefix}_date`),year=field(index,doc.id,`${prefix}_year`);if(!date||!year)return [];const record=printed.find(row=>row.date===date.value&&row.amount===value.value);return record?[{...record,refs:[value.id,date.id,year.id]}]:[];});
  if(!printed.length||used.length!==usedValues.length) return unavailable(index,"CA_PAYMENT_YEAR","payments",["doc:D68#page1",line.key]);
  const wrong=used.filter(row=>row.taxYear!==doc.tax_year);
  const agencyPayments=agency.data.filter((row): row is {date:string;amount:number}=>row && typeof row.amount==="number" && typeof row.date==="string");
  const expected=sum(agencyPayments.map(row=>row.amount));
  const comparison=reconcile(line.value,expected);
  const mismatched=!comparison.agrees;
  return result(index,"CA_PAYMENT_YEAR",doc.id,{
    title:wrong.length?"California payment was designated to a different tax year":"California payments reconciliation",taxArea:"payments",outcome:mismatched?"confirmed_mismatch":"pass",severity:mismatched?"blocking":"info",certainty:"certain",
    inputRefs:[line.key,pageReference(doc.id,1),...wrong.flatMap(row=>row.refs),"agency:/ftb_account/tax_year_2025_payments","agency:/ftb_account/tax_year_2024_payments_after_filing"],
    observed:{returnClaimed:line.value,wrongYearPaymentsUsed:wrong.map(({date,amount,taxYear})=>({date,amount,designatedTaxYear:taxYear}))},
    expected:{agency2025Payments:expected,printed2025Payments:sum(printed.filter(row=>row.taxYear===doc.tax_year).map(row=>row.amount)),difference:comparison.difference},
    explanation:mismatched?`The return's claimed payments differ from the available 2025 FTB account total. ${wrong.length?`Used payment ${wrong.map(row=>row.date).join(", ")} is explicitly designated to a different tax year in the printed confirmation. Compare the linked agency records. Calendar date alone does not determine the designated tax year; no transfer is assumed.`:"No wrong-year source was established by this check; reconcile the agency and confirmation records."}`:"The claimed amount agrees with available 2025 agency payments; no cross-year payment mismatch is established.",
    action:{label:"Inspect payment designation",ref:wrong[0]?.refs[2]??pageReference(doc.id,1)},
  });
}
function missingLots(index: EvidenceIndex): CheckResult[] {
  const active=[...index.documents.values()].filter(doc=>doc.document_type==="1099-composite"&&index.version.documents_used.includes(doc.id)&&!index.version.documents_superseded.includes(doc.id)).sort((a,b)=>a.id.localeCompare(b.id));
  const findings:CheckResult[]=[];
  for(const doc of active) for(const page of doc.pages) {
    if(index.pageValues(doc.id,page.page).length) continue;
    const lot=/\b([A-Z]\d+)\s+.+?\bproceeds\s+([\d,]+\.\d{2})\s+basis\s+([\d,]+\.\d{2})/u.exec(page.printed_content);
    if(!lot) continue;
    const old=[...index.documents.values()].filter(other=>index.version.documents_superseded.includes(other.id)&&other.issuer===doc.issuer&&other.belongs_to===doc.belongs_to&&other.tax_year===doc.tax_year).flatMap(other=>other.pages.filter(candidate=>normalize(candidate.printed_content)===normalize(page.printed_content)).map(candidate=>pageReference(other.id,candidate.page)));
    findings.push(result(index,"BROKER_PAGE_UNEXTRACTED",`${doc.id}:${lot[1]}`,{
      title:`Printed lot ${lot[1]} has no extracted fields`,taxArea:"capital_gains",outcome:"confirmed_mismatch",severity:"warning",certainty:"certain",inputRefs:[pageReference(doc.id,page.page),...old],
      observed:{activeDocument:doc.id,page:page.page,lot:lot[1],proceeds:money(lot[2]),basis:money(lot[3]),extractedFields:0},
      expected:{recordedExtractionOrDocumentedDisposition:1},explanation:"A used brokerage document contains a printed sales lot on a page with no extracted fields. The superseded report is linked as corroboration, not a second missing-lot finding. No lot, basis correction or tax effect has been created.",action:{label:"Inspect missing lot page",ref:pageReference(doc.id,page.page)},
    }));
  }
  return findings;
}
function ambiguousGift(index: EvidenceIndex): CheckResult {
  const doc=index.documents.get("D64"),value=field(index,"D64","amount");
  if(!doc||!value) return unavailable(index,"CHARITY_AMOUNT_UNCLEAR","charity",["D64"]);
  const printed=doc.pages[0].printed_content; const ambiguous=/\$\?[\d,]+(?:\.\d{2})?/u.exec(printed);
  return result(index,"CHARITY_AMOUNT_UNCLEAR",doc.id,{
    title:"Handwritten donation amount needs clarification",taxArea:"charity",outcome:ambiguous?"needs_information":"pass",severity:ambiguous?"blocking":"info",certainty:ambiguous?"judgment":"certain",
    inputRefs:[value.id,pageReference(doc.id,1),...usedAt(index,"SchA.11",value)],
    observed:{printedAmount:ambiguous?.[0]??"No ambiguous amount marker",pipelineReading:value.value,pipelineConfidence:value.confidence},expected:{verifiedGiftAmount:null,clarificationRequired:Boolean(ambiguous)},
    explanation:ambiguous?"The printed first digit is unknown. The pipeline's amount and confidence do not establish the gift amount. No amount is established by this check, and later client answers are unavailable at the workpaper date. Obtain legible, dated supporting evidence.":"The printed ambiguity tested by this check is absent. Extraction confidence alone is not proof that the source amount is wrong.",action:{label:"Inspect ambiguous receipt",ref:value.id},
  });
}
function wages(index: EvidenceIndex): CheckResult {
  const line=index.lines.get("F1040.1a");
  if(!line) return unavailable(index,"W2_CONTRIBUTION_COUNT","wages",["F1040.1a"]);
  const reports=[...index.documents.values()].filter(doc=>doc.document_type==="W-2").sort((a,b)=>a.id.localeCompare(b.id)).map((doc:PacketDocument)=>{
    const boxes=valuesFor(index,doc.id).filter(value=>value.field.startsWith("box")).map(value=>[value.field,value.value]);
    const amount=field(index,doc.id,"box1");
    return {doc,amount,identity:JSON.stringify([doc.tax_year,doc.belongs_to,normalize(doc.issuer),boxes])};
  });
  const groups=groupBy(reports,row=>row.identity).filter(group=>group.length>1);
  const used=groups.map(group=>({documents:group.map(row=>row.doc.id),usedDocuments:group.flatMap(row=>row.amount?line.sources.filter(ref=>ref===row.amount!.id).map(()=>row.doc.id):[])}));
  const duplicate=used.some(group=>group.usedDocuments.length>1);
  return result(index,"W2_CONTRIBUTION_COUNT","F1040.1a",{
    title:"Duplicate W-2 image contribution control",taxArea:"wages",outcome:duplicate?"candidate":"pass",severity:duplicate?"blocking":"info",certainty:duplicate?"probable":"certain",
    inputRefs:[line.key,...groups.flatMap(group=>group.flatMap(row=>[pageReference(row.doc.id,1),...(row.amount?[row.amount.id]:[])]))],
    observed:{duplicateImageGroups:used},expected:{maximumUsedContributionsPerMatchingReport:1},
    explanation:duplicate?"Matching employer, owner, year and W-2 box details appear in more than one used source. Confirm whether the reports represent one economic wage statement before adjusting.":`${used.map(group=>`${group.documents.join(" and ")} match on employer, owner, year and W-2 box details; used wage sources: ${group.usedDocuments.join(", ")||"none"}.`).join(" ")} No matching report has more than one used wage contribution. No duplicate engine contribution is flagged.`,
    action:{label:"Inspect wage contribution",ref:line.key},
  });
}
export function runIndependentChecks(index: EvidenceIndex): CheckResult[] {
  return [...interestOverlap(index),mileage(index),receipts(index),payments(index),...missingLots(index),ambiguousGift(index),wages(index)].sort((a,b)=>a.key.localeCompare(b.key));
}
