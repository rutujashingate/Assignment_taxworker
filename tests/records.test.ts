import { beforeAll,expect,test } from 'vitest';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import type { Packet } from '../src/lib/packet/schema';
import { createEvidenceIndex,type TraceNode } from '../src/lib/evidence/resolver';
import { AREAS } from '../src/lib/records/types';
import { buildLots,buildTaxArea,groupLots,moneySum } from '../src/lib/records/models';
import { searchIndex,amountQuery } from '../src/lib/records/search';
import { parseReference } from '../src/lib/evidence/references';
let packet:Packet;let index:ReturnType<typeof createEvidenceIndex>;
beforeAll(async()=>{packet=JSON.parse(await readFile('data/okafor_lindqvist_2025_packet.json','utf8'));index=createEvidenceIndex(packet);});
function nodes(trace:TraceNode):TraceNode[]{return [trace,...trace.children.flatMap(nodes)];}
test.each(AREAS)('every tax area has supplied records and a representative source trace: $id',area=>{
  const model=buildTaxArea(index,area.id);expect(model.title).toBe(area.title);expect(index.resolve(model.trace).status).toBe('resolved');
  const trace=nodes(index.trace(model.trace));expect(trace.some(n=>n.resolution.status==='resolved'&&['document','page','extracted_value'].includes(n.resolution.kind)),area.id).toBe(true);
  expect(trace.every(n=>!n.cycle)).toBe(true);
  if(area.id!=='documents')expect(model.lines.length+model.records.length+model.metrics.length).toBeGreaterThan(0);
});
test('D74 groups reconcile exactly to supplied summary and retain all 260 original lots',()=>{
  const lots=buildLots(index).filter(l=>l.documentId==='D74');expect(lots).toHaveLength(260);expect(new Set(lots.map(l=>l.key)).size).toBe(260);
  expect(lots.every(l=>l.fieldRefs.length===7&&l.sourceRefs.length>0)).toBe(true);
  expect(moneySum(lots.map(l=>l.proceeds))).toBe(334728.52);expect(moneySum(lots.map(l=>l.basis))).toBe(338300.26);expect(moneySum(lots.map(l=>l.wash))).toBe(2906.29);
  const groups=groupLots(lots);expect(groups.reduce((n,g)=>n+g.count,0)).toBe(260);expect(new Set(groups.map(g=>g.category))).toEqual(new Set(['A','D']));expect(groups.some(g=>g.exception==='Adjustment W')).toBe(true);
  expect(groups.every(g=>g.basisComplete)).toBe(true);expect(moneySum(groups.map(g=>g.engineGain))).toBeCloseTo(moneySum(lots.map(l=>l.gain)),2);
  for(const lot of lots)for(const ref of lot.sourceRefs)expect(index.resolve(ref).status).toBe('resolved');
});
test('294 source-backed trades exclude seven totals and the computed S-corp entry, retaining missing crypto basis and M18 gap',()=>{
  const lots=buildLots(index);expect(lots).toHaveLength(294);expect(lots.some(l=>l.id==='SCORP')).toBe(false);expect(buildTaxArea(index,'sales').lines.some(l=>l.key==='F8949.F.SCORP')).toBe(true);const c6=lots.find(l=>l.id==='C6')!;expect(c6.basis).toBeNull();expect(c6.acquired).toBeNull();expect(c6.exception).toBe('Missing basis/date');expect(c6.gain).toBe(5325);
  expect(groupLots([c6])[0]).toMatchObject({basisComplete:false,knownBasis:0});expect(lots.some(l=>l.id==='M18')).toBe(false);
  expect(buildTaxArea(index,'sales').gaps.some(g=>g.ref==='doc:D31#page32')).toBe(true);
});
test('basis history and absent related returns stay explicit gaps, separate from computed assumptions',()=>{
  const model=buildTaxArea(index,'basis');expect(model.gaps.map(g=>g.title)).toContain('2023 S-corp ending basis missing');
  const history=model.records.find(r=>r.ref==='py:/basis_records')!.data as {scorp_lindqvist_family_woodworks:{year:number;ending_stock_basis:number|null}[]};expect(history.scorp_lindqvist_family_woodworks.find(r=>r.year===2023)?.ending_stock_basis).toBeNull();
  expect(index.resolve('F7203.1')).toMatchObject({status:'resolved',line:{value:2300}});
  const k1=buildTaxArea(index,'k1');const related=k1.records.find(r=>r.ref==='household:/related_returns')!.data as {in_this_packet:unknown}[];expect(related).toHaveLength(3);expect(related[0].in_this_packet).toBe(false);
});
test('prior-year variances respect firm thresholds without equating changed payer/detail meanings',()=>{
  const model=buildTaxArea(index,'comparison');const agi=model.comparisons.find(r=>r.key==='F1040.11')!;expect(agi).toMatchObject({prior:228409,current:445590,delta:217181,flagged:true});
  expect(model.comparisons.find(r=>r.key==='SchB.1.2')?.delta).toBeNull();expect(model.comparisons.find(r=>r.key==='SchC.44a')?.flagged).toBe(false);
  expect(buildTaxArea(index,'comparison',{and_over_amount:1e9,flag_if_change_over_percent:1000}).comparisons.every(r=>!r.flagged)).toBe(true);
});
test('books-to-engine bridge reconciles supplied totals without changing them',()=>{
  const before=JSON.stringify(index.version);const bridge=buildTaxArea(index,'business').bridge!;
  expect(bridge.map(step=>step.value)).toEqual([89834,12400,-19180,-1200,81854]);
  expect(moneySum(bridge.slice(0,-1).map(step=>step.value))).toBe(bridge.at(-1)!.value);
  for(const step of bridge)for(const ref of step.refs)expect(index.resolve(ref).status).toBe('resolved');
  expect(JSON.stringify(index.version)).toBe(before);
});
test('asset regimes, credits, state allocation and carryovers retain supplied distinctions',()=>{
  const depreciation=buildTaxArea(index,'depreciation');const printer=depreciation.records.find(r=>r.ref==='asset:STU-PRINTER')!;
  expect(printer.data).toMatchObject({federal:{depreciation_2025:14200},california:{depreciation_2025:2840},amt:{depreciation_2025:14200}});
  expect(depreciation.records.find(r=>r.ref==='asset:AUS-BLDG')?.data).toMatchObject({disposed:'2025-10-15',disposition:{unrecaptured_1250_depreciation:49599.99}});
  expect(buildTaxArea(index,'deductions-credits').metrics.find(m=>m.ref==='F8812.12')?.value).toBe(400);
  const ca=buildTaxArea(index,'california');expect(ca.metrics.find(m=>m.ref==='F540NR.17')?.value).toBe(481096);expect(ca.metrics.find(m=>m.ref==='F540NR.32')?.value).toBe(305349);
  const opening=buildTaxArea(index,'carryovers').records.find(r=>r.ref==='py:/carryovers_into_2025')?.data;expect(opening).toMatchObject({passive_1450_fremont:6300});
  const computed=buildTaxArea(index,'carryovers').records.find(r=>r.ref==='computed:v3:/carryovers_out')?.data;expect(computed).toMatchObject({federal:{passive_1450_fremont:0,minimum_tax_credit_from_2025_amt:3871}});
});
test('computed and household pointers use RFC 6901 own-property resolution without exposing future versions',()=>{
  expect(parseReference('computed:v3:/carryovers_out/federal/scorp_stock_basis_end')).toMatchObject({kind:'computed',version:'v3'});
  expect(index.resolve('computed:v3:/carryovers_out/federal/scorp_stock_basis_end')).toMatchObject({status:'resolved',data:0});expect(index.resolve('household:/related_returns/0')).toMatchObject({status:'resolved'});
  for(const ref of ['computed:v3:/__proto__','computed:v4:/summary','computed:v3:/assets/~2','household:/__proto__'])expect(index.resolve(ref).status).not.toBe('resolved');
  expect(createEvidenceIndex(packet,'v1','2026-03-26T20:00:00Z').resolve('computed:v3:/summary').status).toBe('missing_source');
});
test('exact amount, line, document and lot searches produce usable typed deep links',()=>{
  const base='/engagements/CL-20417/2025';const search=(q:string,amount=false)=>searchIndex(index,q,base,'CL-20417',2025,amount);
  expect(amountQuery('($1,840.00)')).toBe(-1840);expect(search('$1,840',true).filter(h=>h.kind==='field').map(h=>h.ref)).toEqual(expect.arrayContaining(['ev-0492','ev-0538']));
  expect(search('$1,840',true).filter(h=>h.kind==='line').map(h=>h.ref)).not.toContain('SchE.28A');
  expect(search('X260').some(h=>h.kind==='lot'&&h.href.includes('lot=F8949.'))).toBe(true);expect(search('F1040.2b').some(h=>h.kind==='line'&&h.ref==='F1040.2b')).toBe(true);expect(search('D29').some(h=>h.kind==='document')).toBe(true);
  for(const q of ['D71','D72','msg-08'])expect(search(q).some(h=>h.ref===q)).toBe(false);
  expect(search('M18').some(h=>h.kind==='page'&&h.ref==='doc:D31#page32')).toBe(true);expect(search('M18').some(h=>h.kind==='lot')).toBe(false);
  expect(search('X1').filter(h=>h.kind==='lot').map(h=>h.ref)).toEqual(['F8949.D.X1']);
  expect(search('$11,800',true).some(h=>h.ref==='SchC.44a')).toBe(false);
});
test('260-lot model performance smoke preserves cardinality on repeated grouping',()=>{
  const start=performance.now();for(let i=0;i<50;i++){const lots=buildLots(index).filter(l=>l.documentId==='D74');expect(groupLots(lots).reduce((n,g)=>n+g.count,0)).toBe(260);}expect(performance.now()-start).toBeLessThan(5000);
});
