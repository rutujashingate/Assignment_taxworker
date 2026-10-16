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
export function recommendIssue(issues:IssueView[],actorId:string){
  return issues.filter(needsAttention).toSorted((a,b)=>{
    const rank=(i:IssueView)=>(i.finding.severity==='blocking'?0:10)+(i.status==='waiting'?4:0)+(i.assigneeId===actorId?0:i.assigneeId===null?1:2);
    return rank(a)-rank(b)||a.key.localeCompare(b.key);
  })[0];
}
