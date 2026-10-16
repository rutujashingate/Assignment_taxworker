'use client';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import type { CollaborationData, ItemView, ItemKind } from '@/lib/collaboration/types';

const labels:Record<ItemKind,string>={thread:'Thread',question:'Question',review_note:'Review note',task:'Task'};
async function result(response:Response) {const body=await response.json();if(!response.ok)throw new Error(body.error??'The change could not be saved.');return body;}
function Failure({error}:{error:string}) {return error?<p className="form-error" role="alert">{error}</p>:null;}
function EvidenceRecord({value,names}:{value:unknown;names:Map<string,string>}) {
  if(!value||typeof value!=='object')return <p>Evidence is unavailable.</p>;
  const envelope=value as Record<string,unknown>;
  const record=envelope.record&&typeof envelope.record==='object'?envelope.record as Record<string,unknown>:{};
  const page=record.printedPage&&typeof record.printedPage==='object'?record.printedPage as Record<string,unknown>:record;
  const reading=record.pipelineReading&&typeof record.pipelineReading==='object'?record.pipelineReading as Record<string,unknown>:null;
  return <div className="linked-evidence-record">
    <code>{String(envelope.ref??'')}</code>{typeof envelope.question==='string'&&<h4>{envelope.question}</h4>}
    {typeof envelope.label==='string'&&<h4>{envelope.label}</h4>}
    {typeof record.body==='string'&&<><p className="collab-body">{record.body}</p><p className="fine-print">Entered by {names.get(String(record.createdBy))??String(record.createdBy)} · <time>{String(record.createdAt)}</time></p></>}
    {typeof record.name==='string'&&<h4>{record.name}</h4>}{typeof record.note==='string'&&<p className="collab-body">{record.note}</p>}
    {typeof page.printed_content==='string'&&<><h4>Printed page {String(page.page)}</h4><pre className="printed-evidence-text">{page.printed_content}</pre></>}
    {reading&&<div className="evidence-gap"><h4>Pipeline reading · separate from printed source</h4><p>{String(reading.label??reading.field)}: {String(reading.value)} · confidence {Math.round(Number(reading.confidence)*100)}%</p><p>Human verification: not recorded.</p></div>}
    {typeof record.question==='string'&&<><h4>{record.question}</h4><p className="collab-body">{String(record.answer)}</p><p className="fine-print">{String(record.answered_by)} · {String(record.answered_at)}</p></>}
    {typeof record.text==='string'&&<><p className="collab-body">{record.text}</p><p className="fine-print">{String(record.from)} · {String(record.sent_at)}</p></>}
    {Array.isArray(envelope.sourceRefs)&&<div className="collab-sources"><h4>Linked to source evidence</h4>{envelope.sourceRefs.map(ref=><code key={String(ref)}>{String(ref)} </code>)}</div>}
    <details><summary>Evidence record details</summary><pre className="reference-record">{JSON.stringify(value,null,2)}</pre></details>
  </div>;
}
function MessageForm({item,api,client,canAnswerInternal,onSaved}:{item:ItemView;api:string;client:boolean;canAnswerInternal:boolean;onSaved:()=>void}) {
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [revision,setRevision]=useState(item.revision);
  const answering=item.kind==='question'&&(client||(item.audience==='internal'&&canAnswerInternal));
  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();const form=e.currentTarget;const fields=new FormData(form);setBusy(true);setError('');
    try{const next:ItemView=await result(await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'reply',id:item.id,expectedRevision:revision,body:fields.get('body'),kind:answering?'answer':'reply'})}));
      setRevision(next.revision);form.reset();onSaved();
    }catch(e){setError(e instanceof Error?e.message:'Reply failed.');}finally{setBusy(false);}
  }
  return <form method="post" action={api} className="collab-form" aria-label="Thread reply" onSubmit={submit}>
    <label htmlFor="reply-body">{answering?'Your answer (saved as dated evidence)':'Add a reply'}</label><textarea id="reply-body" name="body" required minLength={3} maxLength={8000} rows={3}/>
    <p className="fine-print">Reply draft uses revision {revision}. {item.revision!==revision&&'Newer changes are available. Reload the record before saving.'}</p>
    <Failure error={error}/><div className="collab-actions"><button className="button primary" disabled={busy}>{busy?'Saving…':answering?'Submit answer':'Post reply'}</button>
    {item.revision!==revision&&<button className="text-button" type="button" onClick={()=>{setRevision(item.revision);setError('');}}>Load latest revision · preserve draft</button>}</div>
  </form>;
}
function EditForm({item,api,people,onSaved}:{item:ItemView;api:string;people:CollaborationData['people'];onSaved:()=>void}) {
  const [error,setError]=useState('');const [revision,setRevision]=useState(item.revision);const [busy,setBusy]=useState(false);
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);setError('');
    try{const next:ItemView=await result(await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'update',id:item.id,expectedRevision:revision,title:f.get('title'),body:f.get('body'),status:f.get('status'),assigneeId:f.get('assigneeId')||null,dueDate:f.get('dueDate')||null,reason:f.get('reason')})}));
      setRevision(next.revision);onSaved();
    }catch(e){setError(e instanceof Error?e.message:'Save failed.');}finally{setBusy(false);}}
  return <details className="edit-collaboration"><summary>Edit assignment, deadline or note</summary><form method="post" action={api} aria-label="Edit collaboration record" className="collab-form" onSubmit={submit}>
    <label>Title<input name="title" defaultValue={item.title} required minLength={3} maxLength={160}/></label><label>Text<textarea name="body" defaultValue={item.body} required minLength={3} maxLength={8000} rows={4}/></label>
    <div className="collab-field-grid"><label>Status<select name="status" defaultValue={item.status}><option value="open">Open</option>{item.messages.some(m=>m.kind==='answer')&&<option value="answered">Answered · client responded</option>}<option value="closed">Closed</option></select></label>
    <label>Assigned to<select name="assigneeId" defaultValue={item.assigneeId??''}><option value="">Unassigned</option>{people.filter(p=>item.audience==='client'||p.role!=='client').map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Due date<input type="date" name="dueDate" defaultValue={item.dueDate??''}/></label></div>
    <label>Reason for change<textarea name="reason" required minLength={3} maxLength={2000} rows={2}/></label>
    <p className="fine-print">Expected revision {revision}. Visibility and linked sources cannot be changed.</p><Failure error={error}/>
    <div className="collab-actions"><button className="button primary" disabled={busy}>Save changes</button>{item.revision!==revision&&<button type="button" className="text-button" onClick={()=>{setRevision(item.revision);setError('');}}>Load latest revision · preserve draft</button>}</div>
  </form></details>;
}
function AttachForm({item,api,onSaved}:{item:ItemView;api:string;onSaved:()=>void}) {
  const [kind,setKind]=useState('note');const [error,setError]=useState('');const [revision,setRevision]=useState(item.revision);const [busy,setBusy]=useState(false);
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget;const f=new FormData(form);f.set('itemId',item.id);f.set('expectedRevision',String(revision));f.set('kind',kind);setBusy(true);setError('');
    try{const next:ItemView=await result(await fetch(`${api}/attachments`,{method:'POST',body:f}));setRevision(next.revision);form.reset();onSaved();}catch(e){setError(e instanceof Error?e.message:'Attachment failed.');}finally{setBusy(false);}}
  return <details className="edit-collaboration"><summary>Attach a file or note</summary><form method="post" action={`${api}/attachments`} encType="multipart/form-data" className="collab-form" aria-label="Add attachment" onSubmit={submit}>
    <label>Attachment type<select value={kind} onChange={e=>setKind(e.target.value)}><option value="note">Note</option><option value="file">File</option></select></label>
    <label>Attachment name<input name="name" required maxLength={160}/></label>{kind==='file'?<label>File (up to 2 MiB)<input type="file" name="file" accept=".txt,.csv,.pdf,.png,.jpg,.jpeg" required/></label>:<label>Attachment note<textarea name="note" required minLength={3} maxLength={8000} rows={3}/></label>}
    <p className="fine-print">Saved in this thread’s visibility. Files require staff clearance to download. Expected revision {revision}.</p><Failure error={error}/><div className="collab-actions"><button disabled={busy} className="button primary">Save attachment</button>{item.revision!==revision&&<button type="button" className="text-button" onClick={()=>{setRevision(item.revision);setError('');}}>Load latest revision · preserve draft</button>}</div>
  </form></details>;
}
function CreateForm({api,data,onSaved}:{api:string;data:CollaborationData;onSaved:(id?:string)=>void}) {
  const taxStaff=['preparer','reviewer','partner','quality_reviewer'].includes(data.people.find(p=>p.id===data.actorId)?.role??'');
  const [kind,setKind]=useState<ItemKind>(taxStaff?'question':'task');const [audience,setAudience]=useState('client');const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [seed,setSeed]=useState(false);
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget;const f=new FormData(form);setBusy(true);setError('');
    try{const next:ItemView=await result(await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',kind,audience:kind==='review_note'?'internal':audience,title:f.get('title'),body:f.get('body'),sourceRefs:String(f.get('sourceRefs')??'').split(/[\s,]+/u).filter(Boolean),assigneeId:f.get('assigneeId')||null,dueDate:f.get('dueDate')||null})}));form.reset();onSaved(next.id);}catch(e){setError(e instanceof Error?e.message:'Creation failed.');}finally{setBusy(false);}}
  return <details className="panel create-collaboration"><summary>Create a question, thread, task or review note</summary>
    {taxStaff&&<button className="text-button" type="button" onClick={()=>{setSeed(true);setKind('question');setAudience('client');}}>Use real D64 donation question</button>}
    <form method="post" action={api} key={seed?'donation':'blank'} className="collab-form" aria-label="Create collaboration record" onSubmit={submit}>
      <div className="collab-field-grid"><label>Record type<select value={kind} onChange={e=>{const k=e.target.value as ItemKind;setKind(k);if(k==='review_note')setAudience('internal');}}>{taxStaff&&<option value="question">Question</option>}<option value="thread">Thread</option><option value="task">Task</option>{data.canReview&&<option value="review_note">Review note · blocks filing</option>}</select></label>
      <label>Visibility<select value={kind==='review_note'?'internal':audience} disabled={kind==='review_note'} onChange={e=>setAudience(e.target.value)}><option value="internal">Internal · staff only</option><option value="client">Client · shared with both taxpayers</option></select></label></div>
      <label>Title<input name="title" required minLength={3} maxLength={160} defaultValue={seed?'Confirm St. Brigid donation amount':''}/></label>
      <label>Question / note<textarea name="body" required minLength={3} maxLength={8000} rows={4} defaultValue={seed?'D64 shows an ambiguous handwritten $?,500. Please confirm the gift amount with the parish or your bank record and attach supporting evidence. The extracted $1,500 is not yet verified.':''}/></label>
      <label>Linked evidence references<input name="sourceRefs" placeholder="doc:D64#page1, qa-38" defaultValue={seed?'doc:D64#page1 qa-38':''}/></label>
      <p className="fine-print">Separate references with spaces or commas. Questions require a real available source. Client visibility explicitly shares the linked source page or answer; internal return traces stay private.</p>
      <div className="collab-field-grid"><label>Assigned to<select name="assigneeId" defaultValue={seed?'cu-01':''}><option value="">Unassigned</option>{data.people.filter(p=>(audience==='client'||p.role!=='client')&&(kind!=='review_note'||['preparer','reviewer','partner','quality_reviewer'].includes(p.role))).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Due date<input name="dueDate" type="date"/></label></div>
      <Failure error={error}/><button disabled={busy} className="button primary">{busy?'Saving…':'Create record'}</button>
    </form>
  </details>;
}

export function WorkflowDesk({initial,base,initialItem}:{initial:CollaborationData;base:string;initialItem?:string}) {
  const [data,setData]=useState(initial);const [selected,setSelected]=useState(initialItem??initial.items.at(-1)?.id??'');const [query,setQuery]=useState('');const [kind,setKind]=useState('all');const [status,setStatus]=useState('all');const [assignee,setAssignee]=useState('all');
  const [error,setError]=useState('');const [evidence,setEvidence]=useState<unknown>(null);const [revealed,setRevealed]=useState<unknown>(null);const [editorGeneration,setEditorGeneration]=useState(0);
  const api=`/api${base}/collaboration`;
  useEffect(()=>{const listener=(event:Event)=>{const next=(event as CustomEvent<CollaborationData>).detail;if(next.actorId===initial.actorId)setData(next);};window.addEventListener('workpaper-change',listener);return()=>window.removeEventListener('workpaper-change',listener);},[initial.actorId]);
  const names=new Map(data.people.map(p=>[p.id,p.name]));
  const visible=data.items.filter(i=>(kind==='all'||i.kind===kind)&&(status==='all'||i.status===status)&&(assignee==='all'||(i.assigneeId??'unassigned')===assignee)&&JSON.stringify(i).toLowerCase().includes(query.toLowerCase()));
  const item=data.items.find(i=>i.id===selected);
  const inspectableSource=item?.sourceRefs.find(ref=>!/^(answer|attachment):/u.test(ref));
  async function reload(id?:string){try{const next=await result(await fetch(api,{cache:'no-store'}));setData(next);if(id)setSelected(id);setError('');setEditorGeneration(n=>n+1);window.dispatchEvent(new Event('workpaper-saved'));}catch(e){setError(e instanceof Error?e.message:'Reload failed.');}}
  async function inspect(ref:string,itemId?:string){setRevealed(null);try{setEvidence(await result(await fetch(`${api}/evidence?ref=${encodeURIComponent(ref)}${itemId?`&item=${itemId}`:''}`,{cache:'no-store'})));setError('');}catch(e){setError(e instanceof Error?e.message:'Evidence unavailable.');}}
  async function reveal(){if(!item)return;try{setRevealed(await result(await fetch(`${api}/reveal`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id})})));setError('');}catch(e){setError(e instanceof Error?e.message:'Reveal denied.');}}
  function select(id:string){setSelected(id);setEvidence(null);setRevealed(null);setEditorGeneration(n=>n+1);window.history.replaceState(null,'',`${base}/workflow?item=${id}`);}
  return <section className="workflow-desk" aria-labelledby="workflow-title">
    <noscript><p className="evidence-gap">Enable JavaScript to create or edit conversations, answer questions, upload attachments and receive live updates. Existing records remain readable below.</p></noscript>
    <div className="section-heading page-section-heading"><div><span className="eyebrow">PEOPLE & EVIDENCE</span><h2 id="workflow-title">{data.client?'Questions, tasks & approvals':'Workflow & collaboration'}</h2><p>{data.client?'Answer your tax team’s linked questions and add supporting evidence.':'Internal discussions, client questions and review hand-offs.'}</p></div><span className="count-tag">{data.items.length} {data.client?'shared':'records'}</span></div>
    <p className="fine-print workflow-clock">Source availability follows the season clock. New workpaper activity records its actual entry date. Simulated approval is available in the filing panel below.</p>
    {data.filingGate&&<aside className={`filing-gate ${data.filingGate.blocked?'blocked':''}`} role="status" aria-label="Review note filing gate"><strong>{data.filingGate.blocked?`Filing blocked · ${data.filingGate.openNoteIds.length} open review notes`:'Review notes clear'}</strong><p>{data.filingGate.message} The separate filing simulation below evaluates its own approval gate.</p></aside>}
    {data.canCreate&&<CreateForm api={api} data={data} onSaved={id=>void reload(id)}/>}
    <Failure error={error}/>
    <form className="panel collab-filters" aria-label="Collaboration search" onSubmit={e=>e.preventDefault()}><label>Search shared records<input type="search" value={query} onChange={e=>setQuery(e.target.value)} maxLength={200} placeholder="Question, note, answer or attachment"/></label><label>Type<select value={kind} onChange={e=>setKind(e.target.value)}><option value="all">All types</option>{Object.entries(labels).filter(([k])=>!data.client||k!=='review_note').map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option><option value="open">Open</option><option value="answered">Answered</option><option value="closed">Closed</option></select></label><label>Assigned to<select value={assignee} onChange={e=>setAssignee(e.target.value)}><option value="all">Everyone</option><option value="unassigned">Unassigned</option>{data.people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></form>
    <div className="collab-workspace"><div><nav className="panel collab-queue" aria-label="Collaboration records">{visible.length?visible.map(i=><button type="button" key={i.id} aria-current={item?.id===i.id?'true':undefined} onClick={()=>select(i.id)}><span>{labels[i.kind]} · {i.audience==='internal'?'Staff only':'Shared with client'} · {i.status}</span><strong>{i.title}</strong><small>{names.get(i.assigneeId??'')??'Unassigned'}{i.dueDate?` · Due ${i.dueDate}`:''}</small>{i.blocksFiling&&i.status!=='closed'&&<em>Blocks filing</em>}</button>):<p>No records match. {data.client?'Your tax team has not shared a matching question or task.':'Create a linked question to begin.'}</p>}</nav>
    <details className="panel supplied-deadlines" open><summary>Supplied deadlines & assignments</summary>{data.assignments.map(a=><p key={a.role}><strong>{a.role}</strong> · {names.get(a.actorId)}</p>)}{data.deadlines.map(d=><p key={d.what}><time>{d.date}</time><span>{d.what}</span></p>)}</details></div>
    <div>{item?<article className="panel collaboration-detail" aria-label="Selected collaboration record">
      <header><span className="eyebrow">{labels[item.kind]} · {item.audience==='internal'?'INTERNAL':'CLIENT SHARED'}</span><h3>{item.title}</h3><p>{names.get(item.createdBy)} · <time>{new Date(item.createdAt).toLocaleString('en-US',{timeZone:'UTC'})+' UTC'}</time> · revision <span data-testid="collaboration-revision">{item.revision}</span></p><span className="status-label neutral">{item.status}</span></header>
      <p className="collab-body">{item.body}</p><p className="fine-print">Assigned to {names.get(item.assigneeId??'')??'nobody'}{item.dueDate?` · due ${item.dueDate}`:''} · Last edited by {names.get(item.updatedBy)}</p>
      <div className="collab-sources"><h4>Linked source evidence</h4>{item.sourceRefs.length?item.sourceRefs.map(ref=><button type="button" className="source-chip" key={ref} onClick={()=>void inspect(ref,item.id)}>{ref}</button>):<p>No original evidence linked.</p>}</div>
      <ol className="collab-messages">{item.messages.map(m=><li key={m.id}><span>{m.kind==='answer'?(data.people.find(p=>p.id===m.createdBy)?.role==='client'?'Client answer · dated evidence':'Colleague answer · dated evidence'):'Reply'} · {names.get(m.createdBy)}</span><time>{new Date(m.createdAt).toLocaleString('en-US',{timeZone:'UTC'})+' UTC'}</time><p>{m.body}</p>{m.kind==='answer'&&<button type="button" className="text-button" onClick={()=>void inspect(m.ref)}>View answer evidence · {m.ref}</button>}</li>)}</ol>
      {item.attachments.length>0&&<section className="collab-attachments"><h4>Persistent attachments</h4>{item.attachments.map(a=><article key={a.id}><strong>{a.name}</strong><small>{a.kind} · {names.get(a.createdBy)} · {new Date(a.createdAt).toLocaleString('en-US',{timeZone:'UTC'})+' UTC'}</small>{a.note&&<p>{a.note}</p>}{a.restricted?<p>Clearance required</p>:<><a href={`${api}/attachments/${a.id}`} className="text-button">Download {a.name}</a><button type="button" className="text-button" onClick={()=>void inspect(a.ref)}>View attachment evidence</button></>}</article>)}</section>}
      {item.status!=='closed'&&<><MessageForm key={`reply-${item.id}-${editorGeneration}`} item={item} api={api} client={data.client} canAnswerInternal={['preparer','reviewer','partner','quality_reviewer'].includes(data.people.find(p=>p.id===data.actorId)?.role??'')} onSaved={()=>void reload()}/><AttachForm key={`attach-${item.id}-${editorGeneration}`} item={item} api={api} onSaved={()=>void reload()}/></>}
      {!data.client&&(item.kind!=='review_note'||data.canReview)&&<EditForm key={`edit-${item.id}-${editorGeneration}`} item={item} api={api} people={data.people} onSaved={()=>void reload()}/>}
      {!data.client&&<details className="edit-collaboration"><summary>Protected text</summary><p className="fine-print">Identifiers are masked by default. Only cleared firm staff can reveal the original; each reveal is logged.</p>{data.canReveal?<button type="button" className="text-button" onClick={()=>void reveal()}>Reveal protected thread text</button>:<p className="fine-print">Your identity does not have sensitive-data clearance.</p>}{revealed!==null&&<><button className="text-button" type="button" onClick={()=>setRevealed(null)}>Hide protected text</button><pre className="reference-record">{JSON.stringify(revealed,null,2)}</pre></>}</details>}
    </article>:<div className="panel empty-panel"><h3>Select a conversation</h3><p>Questions, notes and their supporting evidence appear here.</p></div>}
    {evidence!==null&&<aside className="panel collaboration-evidence" aria-label="Linked answer and source evidence"><div className="section-heading"><h3>Linked evidence</h3><button className="text-button" type="button" onClick={()=>setEvidence(null)}>Close evidence</button></div><EvidenceRecord value={evidence} names={names}/><p className="fine-print">Human-entered evidence does not alter original engine results. Source pages are simulated printed content.</p>{!data.client&&inspectableSource&&<Link prefetch={false} className="text-button" href={`${base}/return?ref=${encodeURIComponent(inspectableSource)}`}>Open Evidence Inspector</Link>}</aside>}
    </div></div>
  </section>;
}
