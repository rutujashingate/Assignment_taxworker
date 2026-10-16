import type { EvidenceIndex } from '../evidence/resolver';
import type { PacketValue } from '../packet/schema';
import { AREAS, type AreaId, type Lot, type LotGroup, type TaxArea } from './types';
export const object=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
export const array=(value:unknown):unknown[]=>Array.isArray(value)?value:[];
export function dataAt(index:EvidenceIndex,ref:string) {const r=index.resolve(ref);return r.status==='resolved'&&'data' in r?r.data:undefined;}
export const moneySum=(values:(number|null)[])=>values.reduce<number>((total,value)=>total+Math.round((value??0)*100),0)/100;
const numeric=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:null;
const pointerToken=(key:string)=>key.replaceAll('~','~0').replaceAll('/','~1');
export const childRef=(ref:string,key:string)=>ref.startsWith('py:')||ref.startsWith('agency:')||ref.startsWith('household:/')||ref.startsWith('computed:')?`${ref}/${pointerToken(key)}`:ref;
export function buildLots(index:EvidenceIndex):Lot[] {
  const fieldsByDocLot=new Map<string,PacketValue[]>();
  for(const v of index.values.values()) {const match=/^([A-Za-z]+\d+)_(.+)$/u.exec(v.field);if(!match)continue;const key=`${v.document_id}:${match[1]}`;const list=fieldsByDocLot.get(key)??[];list.push(v);fieldsByDocLot.set(key,list);}
  return [...index.lines.values()].filter(l=>l.form==='F8949'&&l.rule==='R-8949-LOT'&&l.sources.some(ref=>index.values.has(ref))).map(line=>{
    const [,category,id]=line.key.split('.');const direct=line.sources.flatMap(ref=>{const r=index.resolve(ref);return r.status==='resolved'&&r.kind==='extracted_value'?[r.extraction]:[];});
    const description=direct.find(v=>new RegExp(`^${id}_(?:description|desc)$`,'u').test(v.field));
    const primary=description?.document_id??direct[0]?.document_id??'';
    const docs=[...new Set([primary,...direct.map(v=>v.document_id)])];
    const fields=docs.flatMap(doc=>fieldsByDocLot.get(`${doc}:${id}`)??[]);
    const get=(names:string[])=>fields.find(v=>names.some(name=>v.field===`${id}_${name}`));
    const acquired=get(['acquired','acq'])?.value;const basis=numeric(get(['basis'])?.value);const wash=numeric(get(['wash'])?.value);
    const adjustment=/adjustment ([A-Z]) /u.exec(line.label)?.[1];
    const exception=basis===null||acquired===null?'Missing basis/date':adjustment?`Adjustment ${adjustment}`:wash!==null&&wash!==0?'Adjustment W':'No reported adjustment';
    return {key:line.key,id,category,exception,description:String(description?.value??get(['asset'])?.value??line.label),documentId:primary,page:description?.page??direct[0]?.page??1,
      proceeds:numeric(get(['proceeds'])?.value),basis,wash,quantity:numeric(get(['quantity','units'])?.value),acquired:typeof acquired==='string'?acquired:null,sold:typeof get(['sold'])?.value==='string'?String(get(['sold'])?.value):null,
      gain:numeric(line.value),sourceRefs:line.sources,fieldRefs:fields.map(f=>f.id)};
  });
}
export function groupLots(lots:Lot[]):LotGroup[] {
  const groups=new Map<string,Lot[]>();for(const lot of lots){const key=`${lot.category} · ${lot.exception}`;groups.set(key,[...(groups.get(key)??[]),lot]);}
  return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([key,rows])=>({key,category:rows[0].category,exception:rows[0].exception,count:rows.length,
    proceeds:moneySum(rows.map(r=>r.proceeds)),knownBasis:moneySum(rows.map(r=>r.basis)),basisComplete:rows.every(r=>r.basis!==null),wash:moneySum(rows.map(r=>r.wash)),engineGain:moneySum(rows.map(r=>r.gain))}));
}
export function buildTaxArea(index:EvidenceIndex,id:AreaId,variance={flag_if_change_over_percent:10,and_over_amount:1000}):TaxArea {
  const def=AREAS.find(a=>a.id===id)!;
  const model:TaxArea={id,title:def.title,description:def.description,trace:def.trace,lines:[...index.lines.values()].filter(l=>(def.forms as readonly string[]).includes(l.form)).map(l=>({key:l.key,label:l.label,value:l.value})),metrics:[],records:[],gaps:[],comparisons:[]};
  const metric=(ref:string,label?:string)=>{const line=index.lines.get(ref);if(line)model.metrics.push({ref,label:label??line.label,value:line.value});};
  const record=(title:string,ref:string)=>{const data=dataAt(index,ref);if(data!==undefined)model.records.push({title,ref,data});else model.gaps.push({title,ref,detail:'This record is not supplied or is unavailable at the source date.'});};
  const computed=(path:string)=>`computed:${index.version.version}:/${path}`;
  const documents=(types:string[])=>{for(const doc of index.documents.values())if(types.includes(doc.document_type)){
    const fields=[...index.values.values()].filter(v=>v.document_id===doc.id);
    model.records.push({title:`${doc.id} · ${doc.title}`,ref:`doc:${doc.id}#page${doc.pages[0].page}`,data:{issuer:doc.issuer,tax_year:doc.tax_year,extraction:doc.extraction.status,pages:doc.page_count,
      unverified_pipeline_fields:fields.map(v=>({reference:v.id,label:v.label??v.field,value:v.value,confidence:v.confidence}))}});
    const refs=new Set(fields.map(v=>v.id));for(const line of index.lines.values())if(line.sources.some(ref=>refs.has(ref))&&!model.lines.some(l=>l.key===line.key))model.lines.push({key:line.key,label:line.label,value:line.value});
  }};
  switch(id) {
    case 'comparison': {
      const prior=object(dataAt(index,'py:/return_2024/lines'));const labels=object(dataAt(index,'py:/return_2024/line_labels'));
      for(const [key,value] of Object.entries(prior)) {const current=index.lines.get(key);const before=numeric(value);const after=numeric(current?.value);
        const changedDetailLabel=/^SchB\.(?:1|5)\.\d+$/u.test(key)&&labels[key]!==current?.label;
        const delta=!changedDetailLabel&&before!==null&&after!==null?after-before:null;const percent=delta!==null&&before!==null&&before!==0?delta/Math.abs(before)*100:null;
        model.comparisons.push({key,label:String(labels[key]??key),prior:value,current:current?.value??null,delta,percent,flagged:!(/miles|days|percent|ratio|hours/iu.test(String(labels[key])))&&delta!==null&&Math.abs(delta)>variance.and_over_amount&&(percent===null||Math.abs(percent)>variance.flag_if_change_over_percent),priorRef:`py:/return_2024/lines/${pointerToken(key)}`});}
      record('Prior preparer and filing context','py:/return_2024/prepared_by');record('2024 residency','py:/return_2024/residency');metric('F1040.11');metric('F1040.24');
      model.gaps.push({title:'Compare matching line meanings',detail:'A 2024 California resident return is not directly interchangeable with the 2025 part-year return. Missing counterpart lines stay unavailable. A variance flag is a prompt for review, not proof of error.'});break;
    }
    case 'computation':metric('F1040.11');metric('F1040.15');metric('F1040.24');metric('F6251.11');record('Original engine summary',computed('summary'));break;
    case 'documents':model.gaps.push({title:'Extraction is not verification',detail:'The document index retains all extraction states and original pages. A source can be used by the engine and still need human review.'});break;
    case 'depreciation':
      for(const asset of index.version.assets)model.records.push({title:String(asset.description),ref:`asset:${asset.asset_id}`,data:asset});
      record('Prior asset schedules by year','py:/asset_records');metric('F4562-C.22');metric('F4797.25');
      model.gaps.push({title:'Six prior asset provenance gaps',detail:'The label prior_preparer_depreciation_schedule does not identify an exact original document/page. It remains unresolved; no link to D07 is invented.',ref:'prior_preparer_depreciation_schedule'});break;
    case 'sales':metric('SchD.7');metric('SchD.15');metric('SchD.16');model.gaps.push({title:'Unextracted M18 lot',detail:'D31 page 32 prints an additional M18 lot, proceeds $250 and basis $310. There is no extracted lot or computed F8949 contribution for it. D30 is superseded.',ref:'doc:D31#page32'},{title:'Crypto missing basis',detail:'A missing basis/date is unknown, even if the engine uses zero. Later client clarification is unavailable at this source date.',ref:'doc:D35#page1'});break;
    case 'business':{
      documents(['books_profit_loss','books_transaction_detail','books_report']);metric('SchC.1');metric('SchC.28');metric('SchC.31');record('Client expense-use explanations','call-01');
      const booksDoc=[...index.documents.values()].find(d=>d.document_type==='books_profit_loss');const values=[...index.values.values()].filter(v=>v.document_id===booksDoc?.id);
      const net=values.find(v=>v.field==='net_income');const receipts=values.find(v=>v.field==='total_income');const expenses=values.find(v=>v.field==='total_expenses');
      const gross=numeric(index.lines.get('SchC.1')?.value),cost=numeric(index.lines.get('SchC.28')?.value),home=numeric(index.lines.get('SchC.30')?.value),profit=numeric(index.lines.get('SchC.31')?.value);
      if(net&&receipts&&expenses&&[net.value,receipts.value,expenses.value,gross,cost,home,profit].every(v=>typeof v==='number'))model.bridge=[
        {label:'Book net income · pipeline reading',value:Number(net.value),refs:[net.id]},
        {label:'Engine receipts minus book receipts',value:gross!-Number(receipts.value),refs:[receipts.id,'SchC.1']},
        {label:'Less engine expenses above book expenses',value:-(cost!-Number(expenses.value)),refs:[expenses.id,'SchC.28']},
        {label:'Less supplied home-office deduction',value:-home!,refs:['SchC.30']},
        {label:'Original engine net profit',value:profit!,refs:['SchC.31']},
      ];
      model.gaps.push({title:'Books-to-tax discrepancies remain open',detail:'Book receipts, card receipts already included, mileage duplication, personal subscriptions and shared-use expenses require disposition. The bridge reconciles supplied totals arithmetically; it does not correct or recompute taxable income.',ref:`doc:${booksDoc?.id??'D14'}#page1`});break;
    }
    case 'rentals':metric('SchE.21A');metric('SchE.21B');metric('SchE.26');metric('F8582.4');documents(['rental_owner_statement','rental_ledger','closing_statement_seller','1099-S']);record('Opening passive losses','py:/carryovers_into_2025');break;
    case 'k1':documents(['K-1-1065','K-1-state-supplement','K-1-1120S']);metric('SchE.28A');metric('SchE.28B');metric('F7203.excess');record('Prior S-corp K-1','py:/return_2024/K1_1120S');record('Prior partnership K-1','py:/return_2024/K1_1065');record('Related returns · evidence stubs','household:/related_returns');model.gaps.push({title:'Related entity returns are not supplied',detail:'Only the described K-1s/supplement are present, not the entity federal/composite returns or the dependent’s own return. These are evidence stubs, not navigable invented returns.'});break;
    case 'retirement-foreign':documents(['1099-R','5498','1099-SA','5498-SA','retirement_contribution','foreign_bank_statement']);metric('F8606.18');metric('F8938.1.max');metric('F8938.1.ye');record('IRA opening basis','py:/basis_records/ira_nondeductible_basis_ngozi');record('SEK conversion parameters','ref:param.fx');model.gaps.push({title:'Outside foreign filings',detail:'FBAR and prior foreign-inheritance reporting require separate scope and evidence. The packet’s prior-preparer open items are not proof of completed outside filings.',ref:'py:/prior_preparer_workpaper/open_items_left_by_prior_preparer'});break;
    case 'deductions-credits':metric('SchA.17');metric('F8812.12');metric('F2441.31');documents(['1098-T','1098','donation_receipt','1098-C','dependent_care_statement']);model.gaps.push({title:'D64 amount remains unresolved',detail:'Handwritten $?,500 is not a proven $1,500 deduction. Credits and deductions show supplied limits; due-diligence sign-offs and election commands are not implemented.',ref:'doc:D64#page1'});break;
    case 'payments':
      for(const line of index.lines.values())if(/^(F1040\.(25|26|3[3-8])|F540NR\.(7[1-8]|97))/u.test(line.key)&&!model.lines.some(l=>l.key===line.key))model.lines.push({key:line.key,label:line.label,value:line.value});
      record('Available federal account transcript','agency:/irs_account_transcript_2025');record('FTB account and tax-year designation','agency:/ftb_account');metric('F1040.33');metric('F540NR.72');model.gaps.push({title:'Agency reconciliation discrepancy',detail:'The available FTB 2025 estimates total $10,500; the engine claims $14,000. D68’s $3,500 September payment is designated to 2024.',ref:'doc:D68#page1'});break;
    case 'california':metric('F540NR.17');metric('F540NR.32');metric('F540NR.64');record('Household residency periods','household:/residency');record('California opening carryovers','py:/carryovers_into_2025/california');model.gaps.push({title:'Allocation is supplied engine treatment',detail:'The engine’s California allocation and additions are inspectable, not independently recomputed here. Federal, total-under-California-law and California-source amounts remain distinct.'});break;
    case 'carryovers':record('Opening carryovers, including state differences','py:/carryovers_into_2025');record('Original computed carryovers out',computed('carryovers_out'));metric('F8606.14');model.gaps.push({title:'Carryovers out are computed, not approved',detail:'These balances are original engine output. No next-year return or accepted filing snapshot has been created.'});break;
    case 'basis':record('Basis history by entity/year','py:/basis_records');record('Selected engine basis and carryover output',computed('carryovers_out/federal'));metric('F7203.1');metric('F7203.15');metric('F8606.14');model.gaps.push({title:'2023 S-corp ending basis missing',detail:'The prior history explicitly leaves 2023 and 2024 ending stock basis unknown. D40’s 2023 K-1 is now available, but that does not supply a completed basis rollforward. The engine’s $2,300 opening basis is a separate computed assumption to inspect.',ref:'py:/basis_records/scorp_lindqvist_family_woodworks/1'},{title:'Partnership capital is not outside basis',detail:'The 2024 capital account is $60,000; outside basis was never computed and remains null.',ref:'py:/basis_records/partnership_ridgeline/0'});break;
    case 'prior-treatment':record('Prior workpaper memo and unresolved items','py:/prior_preparer_workpaper');record('Prior basis history','py:/basis_records');record('Related return stubs','household:/related_returns');metric('F7203.1');metric('F8606.2');metric('SchC.30');model.gaps.push({title:'Current treatment is original engine treatment',detail:'Prior assumptions and current computation are shown separately. Phase 4 human corrections are absent; this page does not claim the firm changed or approved the treatment.'});break;
  }
  return model;
}
