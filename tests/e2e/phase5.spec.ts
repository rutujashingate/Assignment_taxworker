import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { ItemView } from '../../src/lib/collaboration/types';
const base='/engagements/CL-20417/2025',api=`/api${base}/collaboration`;
async function session(browser:Browser,id:string) {
  const context=await browser.newContext();const r=await context.request.post('/api/demo-session',{data:{identityId:id}});expect(r.status()).toBe(200);
  return {context,page:await context.newPage()};
}
async function create(context:BrowserContext,kind='question',audience='client') {
  const r=await context.request.post(api,{data:{action:'create',kind,audience,title:`Browser ${kind} ${randomUUID()}`,body:'D64 has an ambiguous handwritten amount. Please request written confirmation rather than assuming the extraction.',sourceRefs:['doc:D64#page1','qa-38'],assigneeId:audience==='client'?'cu-01':'st-01',dueDate:'2026-07-02'}});expect(r.status()).toBe(200);return await r.json() as ItemView;
}
const detail=(page:Page)=>page.getByRole('article',{name:'Selected collaboration record'});
async function current(context:BrowserContext,id:string){const r=await context.request.get(`${api}/${id}`);expect(r.status()).toBe(200);return await r.json() as ItemView;}
function edit(item:ItemView,body:string){return {action:'update',id:item.id,expectedRevision:item.revision,title:item.title,body,status:'open',assigneeId:item.assigneeId,dueDate:item.dueDate,reason:'Correcting the linked question text after review.'};}

test('client answers a real linked question; preparer sees dated evidence and persistent file and note attachments',async({browser})=>{
  const prep=await session(browser,'st-01');const client=await session(browser,'cu-01');
  try {
    const question=await create(prep.context);
    await prep.page.goto(`${base}/workflow?item=${question.id}`);await client.page.goto(`${base}/workflow?item=${question.id}`);
    await expect(client.page.getByRole('heading',{name:'Questions, tasks & approvals',exact:true})).toBeVisible();
    await detail(client.page).getByRole('button',{name:'doc:D64#page1',exact:true}).click();
    await expect(client.page.getByRole('complementary',{name:'Linked answer and source evidence'})).toContainText('$?,500.00');
    const reply=client.page.getByRole('form',{name:'Thread reply',exact:true});
    await reply.getByLabel('Your answer (saved as dated evidence)',{exact:true}).fill('I will ask the parish for written confirmation; the amount is still unresolved.');
    await reply.getByRole('button',{name:'Submit answer',exact:true}).click();
    await expect(detail(client.page)).toContainText('I will ask the parish for written confirmation');
    await expect(detail(prep.page)).toContainText('I will ask the parish for written confirmation',{timeout:12000});
    await detail(prep.page).getByRole('button',{name:/View answer evidence/}).click();
    const evidence=prep.page.getByRole('complementary',{name:'Linked answer and source evidence'});
    await expect(evidence).toContainText('Entered by Ngozi Okafor');await expect(evidence.locator('time')).toHaveText(/\d{4}-\d{2}-\d{2}T/);await expect(evidence).toContainText('doc:D64#page1');
    await detail(client.page).getByText('Attach a file or note',{exact:true}).click();
    const attach=client.page.getByRole('form',{name:'Add attachment',exact:true});
    await attach.getByRole('combobox',{name:'Attachment type',exact:true}).selectOption('file');await attach.getByLabel('Attachment name',{exact:true}).fill('parish-request.txt');
    await attach.getByLabel('File (up to 2 MiB)',{exact:true}).setInputFiles({name:'parish-request.txt',mimeType:'text/plain',buffer:Buffer.from('Please provide written confirmation of the gift amount.')});
    await attach.getByRole('button',{name:'Save attachment',exact:true}).click();
    await expect(detail(client.page).getByRole('link',{name:'Download parish-request.txt',exact:true})).toBeVisible();
    await detail(client.page).getByText('Attach a file or note',{exact:true}).click();
    const note=client.page.getByRole('form',{name:'Add attachment',exact:true});await note.getByLabel('Attachment name',{exact:true}).fill('Contact note');await note.getByLabel('Attachment note',{exact:true}).fill('Written confirmation requested; awaiting a reply.');await note.getByRole('button',{name:'Save attachment',exact:true}).click();
    await expect(detail(prep.page)).toContainText('Written confirmation requested; awaiting a reply.',{timeout:12000});
    await client.page.reload();await prep.page.reload();await expect(detail(client.page)).toContainText('I will ask the parish');await expect(detail(prep.page)).toContainText('Contact note');
    const stored=await current(prep.context,question.id);const file=stored.attachments.find(a=>a.kind==='file')!;
    const download=await prep.context.request.get(`${api}/attachments/${file.id}`);expect(download.status()).toBe(200);expect(await download.text()).toBe('Please provide written confirmation of the gift amount.');
    expect((await prep.context.request.get('/api/demo-session')).ok()).toBe(true);
    const notice=(await (await prep.context.request.get(api)).json()).notifications.filter((n:{itemId:string})=>n.itemId===question.id).at(-1);
    const menu=prep.page.locator('.notification-menu');await menu.locator('summary').click();
    const entry=menu.locator('article').filter({hasText:question.title}).first();await expect(entry).toBeVisible();await entry.getByRole('button',{name:'Mark read',exact:true}).click();
    await expect.poll(async()=>{const data=await (await prep.context.request.get(api)).json();return data.notifications.find((n:{id:string})=>n.id===notice.id).readAt;}).not.toBeNull();
    await menu.locator('summary').click();
    await prep.page.screenshot({path:'test-results/phase5-collaboration-desktop.png',fullPage:true});
  } finally {await prep.context.close();await client.context.close();}
});

test('two browser windows receive a preparer question correction; a stale reviewer edit returns 409 and preserves its draft',async({browser})=>{
  const prep=await session(browser,'st-01');const reviewer=await session(browser,'st-02');
  try {
    const q=await create(prep.context);for(const p of [prep.page,reviewer.page])await p.goto(`${base}/workflow?item=${q.id}`);
    await expect(reviewer.page.getByRole('status',{name:'Live update status'})).toContainText('Updates automatically');
    await detail(reviewer.page).getByText('Edit assignment, deadline or note',{exact:true}).click();
    const stale=reviewer.page.getByRole('form',{name:'Edit collaboration record',exact:true});
    await stale.getByRole('textbox',{name:'Text',exact:true}).fill('Reviewer draft which must be preserved on conflict.');await stale.getByLabel('Reason for change',{exact:true}).fill('Reviewer draft in second window.');
    await detail(prep.page).getByText('Edit assignment, deadline or note',{exact:true}).click();const form=prep.page.getByRole('form',{name:'Edit collaboration record',exact:true});
    await form.getByRole('textbox',{name:'Text',exact:true}).fill('Preparer correction: please obtain a dated parish confirmation and supporting bank record.');await form.getByLabel('Reason for change',{exact:true}).fill('Clarify exactly which evidence is requested.');await form.getByRole('button',{name:'Save changes',exact:true}).click();
    await expect(detail(reviewer.page).locator('.collab-body')).toContainText('Preparer correction:',{timeout:12000});await expect(stale.getByRole('textbox',{name:'Text',exact:true})).toHaveValue('Reviewer draft which must be preserved on conflict.');
    const conflict=reviewer.page.waitForResponse(r=>r.url().endsWith('/collaboration')&&r.request().method()==='POST');await stale.getByRole('button',{name:'Save changes',exact:true}).click();expect((await conflict).status()).toBe(409);
    await expect(stale.getByRole('alert')).toContainText('another window');await expect(stale.getByRole('textbox',{name:'Text',exact:true})).toHaveValue('Reviewer draft which must be preserved on conflict.');
    expect((await current(prep.context,q.id)).body).toContain('Preparer correction:');
    await reviewer.page.reload();await expect(detail(reviewer.page).locator('.collab-body')).toContainText('Preparer correction:');
  } finally {await prep.context.close();await reviewer.context.close();}
});

test('internal note content, URLs, APIs, attachments, search and notification cursors stay private',async({browser})=>{
  const reviewer=await session(browser,'st-02');const client=await session(browser,'cu-01');
  let internal:ItemView|undefined;
  try {
    const before=await (await client.context.request.get(api)).json();internal=await create(reviewer.context,'review_note','internal');
    await client.page.goto(`${base}/workflow?item=${internal.id}`);expect(await client.page.content()).not.toContain(internal.title);
    const searched=await client.context.request.get(`${api}?q=${encodeURIComponent(internal.title)}`);expect((await searched.json()).items).toEqual([]);
    expect((await client.context.request.get(`${api}/${internal.id}`)).status()).toBe(404);
    expect((await client.context.request.post(api,{data:edit(internal,'Forbidden client edit.')})).status()).toBe(404);
    expect((await client.context.request.post(`${api}/reveal`,{data:{id:internal.id}})).status()).toBe(403);
    const after=await (await client.context.request.get(api)).json();expect(after.cursor).toBe(before.cursor);expect(after.notifications).toEqual(before.notifications);
    const hiddenAttachment=await reviewer.context.request.post(`${api}/attachments`,{multipart:{itemId:internal.id,expectedRevision:String(internal.revision),kind:'note',name:'Internal attachment',note:'This internal evidence must never be shared.'}});expect(hiddenAttachment.status()).toBe(200);
    const attached:ItemView=await hiddenAttachment.json();expect((await client.context.request.get(`${api}/attachments/${attached.attachments[0].id}`)).status()).toBe(404);
    expect((await client.context.request.get(`${api}/evidence?ref=${encodeURIComponent(attached.attachments[0].ref)}`)).status()).toBe(404);
    for(const endpoint of [`/api${base}/issues`,`/api${base}/evidence?ref=doc:D08%23page1`])expect((await client.context.request.get(endpoint)).status()).toBe(403);
    await reviewer.page.goto(`${base}/workflow?item=${internal.id}`);await expect(reviewer.page.getByRole('status',{name:'Review note filing gate'})).toContainText('Filing blocked');
    await expect(detail(reviewer.page)).toContainText(internal.title);
    const currentNote=await current(reviewer.context,internal.id);const close=await reviewer.context.request.post(api,{data:{...edit(currentNote,currentNote.body),status:'closed'}});expect(close.status()).toBe(200);
  } finally {
    if(internal){const n=await current(reviewer.context,internal.id);if(n.status!=='closed')await reviewer.context.request.post(api,{data:{...edit(n,n.body),status:'closed'}});}
    await reviewer.context.close();await client.context.close();
  }
});

test('masked source reads, authorized reveal UI and restricted file downloads are enforced',async({browser})=>{
  const uncleared=await session(browser,'st-04');const cleared=await session(browser,'st-01');
  try {
    const packet=JSON.parse(await readFile('data/okafor_lindqvist_2025_packet.json','utf8'));const ssn=packet.extracted_values.find((v:{id:string})=>v.id==='ev-0015').value;
    await uncleared.page.goto(`${base}/documents/D08?field=ev-0015`);expect(await uncleared.page.content()).not.toContain(ssn);
    expect((await uncleared.context.request.post(`/api${base}/sensitive-reveal`,{data:{ref:'ev-0015'}})).status()).toBe(403);
    await cleared.page.goto(`${base}/return?ref=ev-0015`);await cleared.page.getByRole('button',{name:'Reveal pipeline identifier · logged',exact:true}).click();await expect(cleared.page.locator('.extraction-reading')).toContainText(ssn);
    await cleared.page.getByRole('button',{name:'Hide identifier',exact:true}).click();
    const q=await create(cleared.context);const file=await cleared.context.request.post(`${api}/attachments`,{multipart:{itemId:q.id,expectedRevision:String(q.revision),kind:'file',name:'Evidence.txt',file:{name:'Evidence.txt',mimeType:'text/plain',buffer:Buffer.from('Supporting attachment.')}}});expect(file.status()).toBe(200);const attached:ItemView=await file.json();
    expect((await uncleared.context.request.get(`${api}/attachments/${attached.attachments[0].id}`)).status()).toBe(403);
    const unsafe=await uncleared.context.request.post(api,{data:{action:'create',kind:'thread',audience:'internal',title:'Protected identifiers',body:`Record identifier ${ssn}`,sourceRefs:[],assigneeId:null,dueDate:null}});expect(unsafe.status()).toBe(403);
  } finally {await uncleared.context.close();await cleared.context.close();}
});

test('workflow create form saves a real question and is usable on mobile',async({page})=>{
  expect((await page.request.post('/api/demo-session',{data:{identityId:'st-01'}})).status()).toBe(200);
  await page.goto(`${base}/workflow`);await page.setViewportSize({width:390,height:844});
  await page.getByText('Create a question, thread, task or review note',{exact:true}).click();await page.getByRole('button',{name:'Use real D64 donation question',exact:true}).click();
  const form=page.getByRole('form',{name:'Create collaboration record',exact:true});await expect(form.getByLabel('Linked evidence references',{exact:true})).toHaveValue('doc:D64#page1 qa-38');
  await form.getByLabel('Title',{exact:true}).fill(`D64 browser confirmation ${randomUUID()}`);await form.getByRole('button',{name:'Create record',exact:true}).click();
  await expect(detail(page)).toContainText('D64 shows an ambiguous handwritten');await expect(detail(page)).toContainText('CLIENT SHARED');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/phase5-collaboration-mobile.png',fullPage:true});
  await page.reload();await expect(detail(page)).toContainText('D64 shows an ambiguous handwritten');
});
