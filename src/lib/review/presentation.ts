import type { CheckResult, IssueView } from './types';

// Presentation only: independent checks and original calculation values stay unchanged.
const money=(value:unknown)=>typeof value==='number'?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(value):'Not established';
const miles=(value:unknown)=>typeof value==='number'?`${value.toLocaleString('en-US')} miles`:'Not established';
export function issuePresentation(finding:Pick<CheckResult,'code'|'observed'|'expected'|'title'>){
  const o=finding.observed,e=finding.expected;
  const common={title:finding.title,reported:'See supporting details',supported:'Needs review',difference:'Not established',next:'Compare the linked evidence and record your conclusion.',qualification:''};
  switch(finding.code){
    case 'CA_PAYMENT_YEAR':return {...common,title:'Check a payment applied to the wrong year',reported:money(o.returnClaimed),supported:money(e.agency2025Payments),difference:money(e.difference),next:'Compare the payment confirmation with the 2025 agency record.',qualification:'Supported amount is the available 2025 agency total. No payment transfer is assumed.'};
    case 'CARD_RECEIPTS_OVERLAP':return {...common,title:'Check receipts already included in the books',reported:money(o.returnGrossReceipts),supported:money(e.booksGrossBeforeOtherAdjustments),difference:money(e.receiptsAlreadyInBooks),next:'Check whether the card receipts were added to income a second time.',qualification:'Supported amount is book revenue before other adjustments, not a recalculated taxable total.'};
    case 'MILEAGE_DUPLICATE_PAGES':return {...common,title:'Review a duplicated mileage page',reported:miles(o.reportedMiles),supported:miles(e.uniquePageMiles),difference:miles(e.excessMiles),next:'Compare pages 2 and 3, then document how the duplicate should be handled.',qualification:'This compares printed mileage totals. The tax deduction has not been recalculated.'};
    case 'CHARITY_AMOUNT_UNCLEAR':return {...common,title:'Confirm the handwritten donation amount',reported:money(o.pipelineReading),supported:'Not established',difference:'Unknown',next:'Request a legible receipt or written confirmation of the gift amount.',qualification:`The extraction reads ${money(o.pipelineReading)}; the printed receipt is ambiguous. That reading is not a verified gift.`};
    case 'INTEREST_SWEEP_OVERLAP':return {...common,title:'Confirm whether bank interest was counted twice',reported:money(o.usedReportedTotal),supported:'Confirmation needed',difference:'Not yet established',next:'Compare the account and reporting period on both bank reports.',qualification:'Both reports contribute $1,840. Matching account evidence suggests overlap, but a CPA must confirm it before excluding income.'};
    case 'BROKER_PAGE_UNEXTRACTED':return {...common,title:'Review a sale missing from extraction',reported:`${o.extractedFields} extracted fields`,supported:'1 printed sale · M18',difference:'1 sale needs review',next:'Read page 32 and decide how the unextracted M18 sale should be handled.',qualification:`The page prints proceeds ${money(o.proceeds)} and basis ${money(o.basis)}. No extracted lot or computed contribution has been invented.`};
    default:return common;
  }
}
export function needsAttention(issue:IssueView){return ['open','investigating','waiting'].includes(issue.status);}
export function reviewGuidance(finding:Pick<CheckResult,'code'|'observed'|'expected'>) {
  const o=finding.observed,e=finding.expected;
  const fallback={summary:'The available records need to be compared before drawing a conclusion.',steps:['Open the linked evidence and check whether it supports the return amount.','Record what you found, or request the missing information.']};
  if(o.sourceState)return {...fallback,summary:String(o.sourceState)};
  switch(finding.code){
    case 'CA_PAYMENT_YEAR':return {summary:`The return claims ${money(o.returnClaimed)} in California payments. The available 2025 agency record supports ${money(e.agency2025Payments)}. A payment was designated to another tax year.`,steps:['Read the payment confirmation. Check the tax year beside the September payment, not just its payment date.','Compare the 2025 agency payments with the amount claimed on the return. Do not assume a transfer between years.']};
    case 'CARD_RECEIPTS_OVERLAP':return {summary:`The return reports ${money(o.returnGrossReceipts)} in gross receipts. The books show ${money(e.booksGrossBeforeOtherAdjustments)} and already include the card receipts.`,steps:['Open the transaction detail and find the card deposits included in sales.','Compare that detail with the books total and the 1099-K. Check timing and other adjustments before deciding on a correction.']};
    case 'MILEAGE_DUPLICATE_PAGES':return {summary:`The return uses ${miles(o.reportedMiles)}. Counting each distinct trip sheet once gives ${miles(e.uniquePageMiles)}.`,steps:['Compare the dates, destinations, business purposes and miles on pages 2 and 3.','Count each unique trip sheet once. Record how the duplicate page should be handled.']};
    case 'INTEREST_SWEEP_OVERLAP':return {summary:'Two bank reports feed separate Schedule B items. They appear to describe the same sweep account, so the interest may have been counted twice.',steps:['Open both bank reports. Compare the owner, account, reporting period and sweep-program description.','Check that each report feeds a separate Schedule B item. Confirm they describe the same interest before deciding to exclude either one.']};
    case 'CHARITY_AMOUNT_UNCLEAR':return {summary:`The receipt’s first digit is unclear. The software read ${money(o.pipelineReading)}, but the receipt does not establish that amount.`,steps:['Open the receipt and compare the handwritten amount with the software reading.','Request a legible receipt or written confirmation. Keep this item Waiting while the amount remains uncertain.']};
    case 'BROKER_PAGE_UNEXTRACTED':return {summary:`A printed sale on page ${String(o.page)} has proceeds of ${money(o.proceeds)} and basis of ${money(o.basis)}. The software did not extract it.`,steps:['Open the active brokerage statement at the linked page and read the printed sale.','Record the missing sale for follow-up. The older statement is corroboration, not another sale to add.']};
    default:return fallback;
  }
}
export function passedCheckPresentation(check:Pick<CheckResult,'code'|'observed'|'title'|'explanation'>) {
  if(check.code==='W2_CONTRIBUTION_COUNT'&&Array.isArray(check.observed.duplicateImageGroups)) {
    const groups=check.observed.duplicateImageGroups.flatMap((group:unknown)=>{
      if(!group||typeof group!=='object')return [];
      const row=group as Record<string,unknown>;
      if(!Array.isArray(row.documents)||!row.documents.every(d=>typeof d==='string')||!Array.isArray(row.usedDocuments)||!row.usedDocuments.every(d=>typeof d==='string'))return [];
      return [`${row.documents.join(' and ')} are matching copies of the same W-2. ${row.usedDocuments.length===1?`The return counts ${row.usedDocuments[0]} once.`:row.usedDocuments.length===0?'Neither copy is counted in wages.':'Review the contribution details.'}`];
    });
    if(groups.length)return {title:'Wages are counted once',summary:`${groups.join(' ')} No duplicate wage contribution was found.`};
  }
  return {title:check.title,summary:check.explanation};
}
export function recommendIssue(issues:IssueView[],actorId:string){
  return issues.filter(needsAttention).toSorted((a,b)=>{
    const rank=(i:IssueView)=>(i.finding.severity==='blocking'?0:10)+(i.status==='waiting'?4:0)+(i.assigneeId===actorId?0:i.assigneeId===null?1:2);
    return rank(a)-rank(b)||a.key.localeCompare(b.key);
  })[0];
}
