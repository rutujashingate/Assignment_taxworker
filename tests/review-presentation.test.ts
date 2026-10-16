import { beforeAll,expect,test } from 'vitest';
import { readFile } from 'node:fs/promises';
import { packetSchema,type Packet } from '../src/lib/packet/schema';
import { createEvidenceIndex } from '../src/lib/evidence/resolver';
import { runIndependentChecks } from '../src/lib/review/checks';
import { issuePresentation,recommendIssue,reviewGuidance,passedCheckPresentation } from '../src/lib/review/presentation';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReadableRecord } from '../src/components/readable-record';
import { referenceLabel } from '../src/lib/evidence/format';
import type { CheckResult,IssueView } from '../src/lib/review/types';
let packet:Packet,checks:CheckResult[];
beforeAll(async()=>{packet=packetSchema.parse(JSON.parse(await readFile('data/okafor_lindqvist_2025_packet.json','utf8')));checks=runIndependentChecks(createEvidenceIndex(packet));});
test.each([
  ['CA_PAYMENT_YEAR','$14,000.00','$10,500.00','$3,500.00'],
  ['CARD_RECEIPTS_OVERLAP','$163,700.00','$151,300.00','$12,400.00'],
  ['MILEAGE_DUPLICATE_PAGES','11,800 miles','8,100 miles','3,700 miles'],
  ['CHARITY_AMOUNT_UNCLEAR','$1,500.00','Not established','Unknown'],
  ['INTEREST_SWEEP_OVERLAP','$3,680.00','Confirmation needed','Not yet established'],
  ['BROKER_PAGE_UNEXTRACTED','0 extracted fields','1 printed sale · M18','1 sale needs review'],
])('CPA summary retains the actual check evidence and uncertainty: %s',(code,reported,supported,difference)=>{
  const check=checks.find(c=>c.code===code)!,before=JSON.stringify(check),view=issuePresentation(check);
  expect(view).toMatchObject({reported,supported,difference});expect(view.next.length).toBeGreaterThan(20);
  expect(JSON.stringify(check)).toBe(before);
});
test('candidate interest and ambiguous gift do not become proven corrected tax amounts',()=>{
  const bank=issuePresentation(checks.find(c=>c.code==='INTEREST_SWEEP_OVERLAP')!);expect(bank.qualification).toContain('CPA must confirm');
  const gift=issuePresentation(checks.find(c=>c.code==='CHARITY_AMOUNT_UNCLEAR')!);expect(gift.qualification).toContain('not a verified gift');
  const receipts=issuePresentation(checks.find(c=>c.code==='CARD_RECEIPTS_OVERLAP')!);expect(receipts.qualification).toContain('not a recalculated taxable total');
  const original=checks.find(c=>c.code==='CA_PAYMENT_YEAR')!;expect(issuePresentation({...original,observed:{},expected:{}})).toMatchObject({reported:'Not established',supported:'Not established',difference:'Not established'});
});
function issue(check:CheckResult,status:IssueView['status']='open',assigneeId:string|null=null):IssueView{return {key:check.key,version:check.version,finding:check,status,assigneeId,note:'',evidenceRefs:[],revision:1,updatedAt:'2026-06-23T06:05:00Z'};}
test('recommendation prioritizes actionable work and personal assignments without mutating the queue',()=>{
  const bank=issue(checks.find(c=>c.code==='INTEREST_SWEEP_OVERLAP')!,'open','st-01'),payment=issue(checks.find(c=>c.code==='CA_PAYMENT_YEAR')!);
  const rows=[payment,bank],before=JSON.stringify(rows);expect(recommendIssue(rows,'st-01')?.key).toBe(bank.key);expect(JSON.stringify(rows)).toBe(before);
  expect(recommendIssue([payment,{...bank,status:'waiting'}],'st-01')?.key).toBe(payment.key);
});
test('explained and resolved items do not masquerade as the next open review task',()=>{
  const rows=checks.filter(c=>c.outcome!=='pass').map((c,i)=>issue(c,i%2?'explained':'resolved_with_evidence'));
  expect(recommendIssue(rows,'st-01')).toBeUndefined();
});
test('the W-2 control explains the actual contribution without displaying internal objects',()=>{
  const check=checks.find(c=>c.code==='W2_CONTRIBUTION_COUNT')!,before=JSON.stringify(check);
  expect(passedCheckPresentation(check)).toEqual({title:'Wages are counted once',summary:'D09 and D10 are matching copies of the same W-2. The return counts D09 once. No duplicate wage contribution was found.'});
  expect(JSON.stringify(check)).toBe(before);
});
test('all six review items have concrete source-checking instructions with honest uncertainty',()=>{
  for(const check of checks.filter(c=>c.outcome!=='pass')){
    const before=JSON.stringify(check),guide=reviewGuidance(check);
    expect(guide.summary.length).toBeGreaterThan(30);expect(guide.steps).toHaveLength(2);
    expect(guide.steps.every(s=>s.length>40)).toBe(true);expect(JSON.stringify(check)).toBe(before);
  }
  expect(reviewGuidance(checks.find(c=>c.code==='CHARITY_AMOUNT_UNCLEAR')!).steps.join(' ')).toContain('Keep this item Waiting');
  expect(reviewGuidance(checks.find(c=>c.code==='INTEREST_SWEEP_OVERLAP')!).steps.join(' ')).toContain('Confirm they describe the same interest');
  expect(reviewGuidance({code:'CA_PAYMENT_YEAR',observed:{sourceState:'Required source is unavailable.'},expected:{}}).summary).toBe('Required source is unavailable.');
});
test('nested records preserve values, readable labels and missing states without raw JSON',()=>{
  const data={duplicateImageGroups:[{documents:['D09','D10'],usedDocuments:['D09']}],pipelineConfidence:0.41,verified:false,amount:null,empty:[],text:'<script>unsafe</script>'};
  const before=JSON.stringify(data),html=renderToStaticMarkup(createElement(ReadableRecord,{value:data}));
  for(const text of ['Matching document copies','Counted in the return','Pipeline Confidence','0.41','No','Not supplied','None recorded','D09','D10'])expect(html).toContain(text);
  expect(html).not.toContain('duplicateImageGroups');expect(html).not.toContain('[object Object]');expect(html).not.toContain('<script>');expect(html).toContain('&lt;script&gt;');
  expect(JSON.stringify(data)).toBe(before);
});
test('agency links use readable labels while the underlying reference remains unchanged',()=>{
  const ref='agency:/ftb_account/tax_year_2025_payments';
  expect(referenceLabel(ref,ref)).toBe('Agency record · California tax account · Tax year 2025 payments');
  expect(referenceLabel('py:/2024/a~1b~0c','raw')).toBe('Prior year · 2024 · A/b~c');
  expect(referenceLabel('ev-0538','Interest income')).toBe('Interest income');
});
