import Link from 'next/link';
import { childRef,object } from '@/lib/records/models';
import { displayValue } from '@/lib/evidence/format';
export function RecordFacts({value,reference,href,depth=0,sourceList=false}:{value:unknown;reference:string;href:(ref:string)=>string;depth?:number;sourceList?:boolean}) {
  if(value===null||value===undefined)return <span className="missing-ref">Not supplied · evidence gap</span>;
  if(typeof value!=='object')return <Link prefetch={false} href={href(reference)} className="fact-value">{displayValue(value)}</Link>;
  const entries=Array.isArray(value)?value.map((v,i)=>[String(i),v] as const):Object.entries(value);
  if(!entries.length)return <span className="fine-print">No entries supplied.</span>;
  const ownReference=typeof object(value).reference==='string'?String(object(value).reference):reference;
  return <dl className="record-facts">{entries.map(([key,child])=>{
    if(key==='reference')return <div key={key}><dt>Evidence</dt><dd><Link prefetch={false} href={href(String(child))}>{String(child)}</Link></dd></div>;
    const ref=childRef(ownReference,key);const nested=child!==null&&typeof child==='object';
    const label=key.replaceAll('_',' ');const sources=sourceList||['sources','source','source_document','refs'].includes(key);
    return <div key={key}><dt>{label}</dt><dd>{nested?<details open={depth<1}><summary>{Array.isArray(child)?`${child.length} records`:'Supplied details'}</summary><RecordFacts value={child} reference={ref} href={href} depth={depth+1} sourceList={sources}/></details>:child===null?<span className="missing-ref">Not supplied · evidence gap</span>:<Link prefetch={false} href={href(sources&&typeof child==='string'?child:ref)} className="fact-value">{typeof child==='number'&&/year$/u.test(key)?String(child):displayValue(child)}</Link>}</dd></div>;
  })}</dl>;
}
