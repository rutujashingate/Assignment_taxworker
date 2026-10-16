'use client';
import { ReadableRecord } from './readable-record';
import { useState } from 'react';
export function SensitiveReveal({base,reference}:{base:string;reference:string}) {
  const [value,setValue]=useState<unknown>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  async function reveal(){setBusy(true);setError('');try{const r=await fetch(`/api${base}/sensitive-reveal`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ref:reference})});const data=await r.json();if(!r.ok)throw new Error(data.error);setValue(data);}catch(e){setError(e instanceof Error?e.message:'Reveal failed.');}finally{setBusy(false);}}
  return <div>{value===null?<button className="text-button" type="button" disabled={busy} onClick={()=>void reveal()}>Reveal pipeline identifier · logged</button>:<><ReadableRecord value={value}/><button type="button" className="text-button" onClick={()=>setValue(null)}>Hide identifier</button></>}{error&&<p className="form-error" role="alert">{error}</p>}</div>;
}
