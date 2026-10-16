import type { EvidenceIndex } from '../evidence/resolver';
import { buildLots, dataAt, childRef } from './models';
import { lineValue } from '../evidence/format';
export type SearchHit={kind:string;label:string;detail:string;ref:string;href:string;clientId:string;taxYear:number};
export function amountQuery(query:string) {const q=query.trim();if(!/^\(?-?\$?\d[\d,]*(?:\.\d+)?\)?$/u.test(q))return null;const n=Number(q.replaceAll(/[,$()]/gu,''));return Number.isFinite(n)?(q.startsWith('(')?-n:n):null;}
export function searchIndex(index:EvidenceIndex,query:string,base:string,clientId:string,taxYear:number,onlyAmounts=false):SearchHit[] {
  const hits:SearchHit[]=[];const q=query.normalize('NFKC').toLowerCase().trim();if(!q)return hits;const amount=amountQuery(q);
  function add(kind:string,label:string,detail:string,ref:string,href:string,value?:unknown) {
    if((!onlyAmounts&&`${label} ${detail} ${ref}`.normalize('NFKC').toLowerCase().includes(q))||(amount!==null&&(Array.isArray(value)?value:[value]).some(v=>typeof v==='number'&&Math.abs(v-amount)<0.005)))hits.push({kind,label,detail,ref,href,clientId,taxYear});
  }
  for(const l of index.lines.values())if(!onlyAmounts||lineValue(l).includes('$'))add('line',`${l.key} · ${l.label}`,String(l.value),l.key,`${base}/return?ref=${encodeURIComponent(l.key)}&line=${encodeURIComponent(l.key)}`,l.value);
  for(const d of index.documents.values()) {
    add('document',`${d.id} · ${d.title}`,`${d.issuer} · ${d.tax_year} · ${d.extraction.status}`,d.id,`${base}/documents/${d.id}`);
    for(const page of d.pages) {
      const text=page.printed_content;const normalized=text.normalize('NFKC').toLowerCase();
      const numericMatch=amount!==null&&[...text.matchAll(/(?<![\w.-])-?(?:\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d+\.\d{2})(?![\w.-])/gu)].some(m=>Math.abs(Number(m[0].replaceAll(',',''))-amount)<0.005);
      const offset=normalized.indexOf(q);
      if((!onlyAmounts&&offset>=0)||(numericMatch)) {
        const snippet=offset>=0?text.slice(Math.max(0,offset-35),offset+115):'Numeric text matched on this printed page.';
        hits.push({kind:'page',label:`${d.id} page ${page.page} · ${d.title}`,detail:`Printed source, not an extracted field${index.version.documents_superseded.includes(d.id)?' · superseded':''} · ${snippet}`,ref:`doc:${d.id}#page${page.page}`,href:`${base}/documents/${d.id}?page=${page.page}`,clientId,taxYear});
      }
    }
  }
  for(const v of index.values.values())if(!onlyAmounts||v.value_type==='money')add('field',`${v.document_id} · ${v.label??v.field}`,String(v.value),v.id,`${base}/documents/${v.document_id}?page=${v.page}&field=${v.id}`,v.value);
  for(const lot of buildLots(index)){
    if(!onlyAmounts&&/^[a-z]+\d+$/u.test(q)&&q!==lot.id.toLowerCase())continue;
    add('lot',`${lot.id} · ${lot.description}`,`${lot.key} · ${lot.documentId} · ${lot.exception} · proceeds ${lot.proceeds??'unknown'} · basis ${lot.basis??'unknown'}`,lot.key,`${base}/records/sales?lot=${encodeURIComponent(lot.key)}`,[lot.gain,lot.proceeds,lot.basis,lot.wash]);
  }
  for(const a of index.version.assets)add('asset',`${a.asset_id} · ${a.description}`,`${a.activity} · cost ${a.cost}`,`asset:${a.asset_id}`,`${base}/records/depreciation?ref=${encodeURIComponent(`asset:${a.asset_id}`)}`,a.cost);
  function prior(value:unknown,ref:string,label:string) {
    if(Array.isArray(value))value.forEach((v,i)=>prior(v,childRef(ref,String(i)),`${label} ${i}`));
    else if(value&&typeof value==='object')for(const [key,v] of Object.entries(value))prior(v,childRef(ref,key),`${label} ${key}`);
    else {
      const priorKey=ref.startsWith('py:/return_2024/lines/')?ref.slice('py:/return_2024/lines/'.length):null;
      const fieldLabel=priorKey?String(dataAt(index,`py:/return_2024/line_labels/${priorKey}`)??label):ref.endsWith('/year')?'number of years':label;
      if(!onlyAmounts||lineValue({value,label:fieldLabel}).includes('$'))add('prior',label,String(value??'Evidence gap'),ref,`${base}/records/basis?ref=${encodeURIComponent(ref)}`,value);
    }
  }
  for(const path of ['basis_records','carryovers_into_2025','return_2024/lines'])prior(dataAt(index,`py:/${path}`),`py:/${path}`,`Prior ${path}`);
  return hits;
}
