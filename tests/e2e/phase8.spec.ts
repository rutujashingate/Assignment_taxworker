import { test,expect,type Page,type Locator } from '@playwright/test';
import { readFileSync,mkdirSync,writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { issuePresentation } from '../../src/lib/review/presentation';
import { packetSchema } from '../../src/lib/packet/schema';
import { createEvidenceRedactor } from '../../src/lib/evidence/privacy';
import type { buildFindingsReport } from '../../src/lib/delivery/findings';
const base='/engagements/CL-20417/2025',api=`/api${base}`;
const packet=packetSchema.parse(JSON.parse(readFileSync('data/okafor_lindqvist_2025_packet.json','utf8'))),redact=createEvidenceRedactor(packet);
async function enter(page:Page,who='st-01'){
  expect((await page.request.post('/api/demo-session',{data:{identityId:who}})).status()).toBe(200);
  if(who.startsWith('st-')){const pref=await(await page.request.get(`${api}/preferences`)).json();if(pref.selectedVersion!=='v3')expect((await page.request.post(`${api}/preferences`,{data:{selectedVersion:'v3',expectedRevision:pref.revision}})).status()).toBe(200);}
}
async function clock(page:Page,eventId='default'){
  expect((await page.request.post('/api/demo-session',{data:{identityId:'st-02'}})).status()).toBe(200);
  const data=await(await page.request.get(`${api}/season`)).json();expect((await page.request.post(`${api}/season`,{data:{action:'clock',eventId,expectedRevision:data.clock.revision}})).status()).toBe(200);
}
async function tabTo(page:Page,target:Locator){
  for(let i=0;i<240;i++){if(await target.evaluate(el=>el===document.activeElement))return;await page.keyboard.press('Tab');}
  throw new Error('Keyboard target was not reached through normal tab order.');
}
test.beforeEach(async({page})=>{await clock(page);});
test.afterEach(async({page})=>{await clock(page);});

test('desktop, landscape tablet, portrait tablet and mobile navigation remain reachable with text statuses',async({page})=>{
  test.setTimeout(120000);await enter(page);
  for(const [name,width,height] of [['desktop',1536,960],['tablet-landscape',1024,768],['tablet-portrait',768,1024],['mobile',390,844]] as const){
    await page.setViewportSize({width,height});await page.goto(`${base}/review`);
    for(const [label,route] of [['Tax Return','return'],['Documents','documents'],['Tasks & Approvals','workflow'],['History','history'],['Review','review']]){
      await page.getByRole('navigation',{name:'Engagement',exact:true}).getByRole('link',{name:label,exact:true}).click();await expect(page).toHaveURL(new RegExp(`${base}/${route}$`));await expect(page.getByRole('main')).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`${name}/${route} horizontal overflow`).toBe(true);
    }
    for(const status of await page.locator('.finding-priority,.issue-state,.status-label').all()){await expect(status).toHaveText(/\S/u);}
    await page.screenshot({path:`test-results/phase8-${name}-navigation.png`,fullPage:false});
  }
  await page.goto(`${base}/documents`);for(const tag of await page.locator('.extraction-tag').all())await expect(tag).toHaveText(/extracted|partial|not extracted/u);
});
test('keyboard-only evidence trace reaches printed D29 field and reverses to actual return usage',async({page})=>{
  test.setTimeout(60000);await enter(page);await page.goto(`${base}/return?line=F1040.2b&ref=F1040.2b`);
  for(const [label,ref] of [['Follow input SchB.4','SchB.4'],['Follow input SchB.2','SchB.2'],['Follow input SchB.1.2','SchB.1.2'],['Open source ev-0538','ev-0538']]){
    const target=page.locator('#evidence-inspector').getByRole('link',{name:label,exact:true});await tabTo(page,target);await expect(target).toBeFocused();expect(await target.evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none');await page.keyboard.press('Enter');await expect(page.locator('.inspector-ref')).toHaveText(ref);
  }
  await expect(page.getByTestId('printed-content')).toContainText('1,840.00');await expect(page.locator('.printed-selection')).toContainText('1,840.00');
  const open=page.getByRole('link',{name:'Open D29 document',exact:true});await tabTo(page,open);await page.keyboard.press('Enter');await expect(page).toHaveURL(/\/documents\/D29/u);
  const field=page.getByTestId('printed-field-ev-0538');await tabTo(page,field);await page.keyboard.press('Enter');await expect(page.locator('.inspector-ref')).toHaveText('ev-0538');
  const usage=page.locator('#evidence-inspector').getByRole('link',{name:'Open return line F1040.2b',exact:true});await tabTo(page,usage);await page.keyboard.press('Enter');await expect(page.locator('.inspector-ref')).toHaveText('F1040.2b');await expect(page.locator('.inspector-amount').first()).toContainText('6,450');
});
test('every reported finding and negative control has a real masked UI source screenshot',async({page})=>{
  test.setTimeout(60000);await enter(page,'st-04');await page.setViewportSize({width:1536,height:1200});
  const report=JSON.parse(readFileSync('docs/FINDINGS_REPORT.json','utf8')) as ReturnType<typeof buildFindingsReport>;
  mkdirSync('docs/screenshots/findings',{recursive:true});const manifest=[];
  for(const finding of report.checks){
    await page.goto(`${finding.route}#evidence-inspector`);const inspector=page.locator('#evidence-inspector');
    if(finding.outcome!=='pass'){await expect(page.locator('#finding-title')).toHaveText(issuePresentation(finding).title);await expect(page.locator('.finding-certainty')).toContainText(finding.certainty);}
    else {const value=finding.inputRefs.find(ref=>ref.startsWith('ev-'))!;await inspector.getByRole('link',{name:`Open source ${value}`,exact:true}).click();await expect(inspector.locator('.inspector-ref')).toHaveText(value);}
    const ref=await inspector.locator('.inspector-ref').innerText();const value=packet.extracted_values.find(v=>v.id===ref);const pageRef=value?`doc:${value.document_id}#page${value.page}`:ref;
    const printed=finding.printedEvidence.find(p=>p.ref===pageRef)!;expect(printed,`${finding.code} source`).toBeTruthy();expect(await inspector.getByTestId('printed-content').textContent()).toBe(printed.printed_content);
    expect(await inspector.innerText()).not.toMatch(/666-\d{2}-\d{4}/u);expect(printed.printed_content).toBe(redact(packet.documents.find(d=>d.id===printed.documentId)!.pages.find(p=>p.page===printed.page)!.printed_content));
    const path=`docs/${finding.screenshot}`;await page.screenshot({path,fullPage:false});manifest.push({code:finding.code,outcome:finding.outcome,route:new URL(page.url()).pathname+new URL(page.url()).search,sourceRef:ref,sourcePage:pageRef,screenshot:finding.screenshot,sha256:createHash('sha256').update(readFileSync(path)).digest('hex'),masked:true});
  }
  writeFileSync('docs/screenshots/findings/manifest.json',JSON.stringify(manifest,null,2)+'\n');expect(manifest).toHaveLength(7);
});
test('boundary and unavailable controls are disabled or explained; submission downloads are real',async({page})=>{
  await enter(page);await page.goto(`${base}/records/sales`);await expect(page.getByRole('button',{name:'Previous window',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Clear selection',exact:true})).toBeDisabled();
  await page.getByRole('searchbox',{name:'Find lot / amount',exact:true}).fill('no-such-lot');for(const name of ['Previous window','Next window','Last window','Select all 0 matching lots'])await expect(page.getByRole('button',{name,exact:true})).toBeDisabled();
  await clock(page,'tl-01');await page.goto(`${base}/history`);await expect(page.getByRole('button',{name:'Create filing simulation',exact:true})).toHaveCount(0);await page.getByText('Custom rate-based estimate',{exact:true}).click();await expect(page.getByRole('combobox',{name:'Rate category',exact:true})).toBeDisabled();await expect(page.getByRole('status').filter({hasText:'Rate-based estimate only:'})).toContainText('No computed rate');
  await clock(page);await enter(page);await page.goto('/handoff');await expect(page.getByRole('heading',{name:'Submission & audit',exact:true})).toBeVisible();await expect(page.locator('.delivery-state').first()).toContainText('Public deployment: blocked.');
  const downloadEvent=page.waitForEvent('download');await page.getByRole('link',{name:'Download one-page Markdown',exact:true}).click();const download=await downloadEvent;expect(download.suggestedFilename()).toBe('PRODUCT_AND_DATA_MODEL.md');
  const response=await page.request.get('/api/handoff/product');expect(response.status()).toBe(200);expect(response.headers()['cache-control']).toContain('no-store');expect(await response.text()).toContain('packet_import');
  for(const a of await page.locator('a[href^="/api/handoff/"]').all()){const href=await a.getAttribute('href');const r=await page.request.get(href!);expect(r.status(),href!).toBe(200);}
  await enter(page,'st-02');await page.goto(`${base}/history`);await expect(page.getByRole('button',{name:'Create filing simulation',exact:true})).toHaveCount(0);await expect(page.getByText('New simulations and amendment branches require',{exact:false})).toBeVisible();
});
test('APIs, search, handoff and client export omit internal notes and protected identifiers',async({page,browser})=>{
  test.setTimeout(60000);await enter(page,'st-02');const secret=`PHASE8_PRIVATE_NOTE_${Date.now()}`;
  const created=await page.request.post(`${api}/collaboration`,{data:{action:'create',kind:'review_note',audience:'internal',title:secret,body:`${secret} Internal simulation gate audit; no tax fact is asserted.`,sourceRefs:['D64'],assigneeId:'st-01',dueDate:null}});expect(created.status()).toBe(200);const note=await created.json();
  try {
    await enter(page,'cu-01');
    for(const url of [`${api}/collaboration/${note.id}`,`${api}/issues`,`${api}/evidence?ref=D29`,`${api}/preferences`,`${api}/season`,`${api}/records/business`,'/api/firm/admin',`/api/search?q=${secret}`,'/api/handoff/findings','/api/handoff/product','/api/handoff/../../.env']){
      const r=await page.request.get(url);expect([403,404]).toContain(r.status());expect(await r.text()).not.toContain(secret);
    }
    const collab=await(await page.request.get(`${api}/collaboration?q=${secret}`)).text();expect(collab).not.toContain(secret);expect(JSON.stringify((await(await page.request.get(`${api}/filings`)).json()).filings)).not.toContain('attestations');
    const anonymous=await browser.newContext();expect((await anonymous.request.get('/api/handoff/findings')).status()).toBe(401);await anonymous.close();
    await page.goto('/handoff');await expect(page).toHaveURL(new RegExp(`${base}/workflow$`));
    await enter(page,'st-04');const ssn=packet.extracted_values.find(v=>v.document_id==='D09'&&v.value_type==='ssn')!;const source=await page.request.get(`${api}/evidence?ref=${ssn.id}`);expect(source.status()).toBe(200);expect(await source.text()).not.toContain(String(ssn.value));expect((await page.request.post(`${api}/sensitive-reveal`,{data:{ref:ssn.id}})).status()).toBe(403);
    const q=await(await page.request.get(`/api/search?q=${encodeURIComponent(String(ssn.value))}`)).json();expect(q.total).toBe(0);
  }finally{
    await enter(page,'st-02');const current=await(await page.request.get(`${api}/collaboration/${note.id}`)).json();expect((await page.request.post(`${api}/collaboration`,{data:{action:'update',id:note.id,expectedRevision:current.revision,title:current.title,body:current.body,assigneeId:current.assigneeId,dueDate:current.dueDate,status:'closed',reason:'Closing only the automated Phase 8 privacy audit note.'}})).status()).toBe(200);
  }
  await clock(page,'tl-20');await enter(page);const create=await page.request.post(`${api}/season`,{data:{action:'create',parentId:null}});expect(create.status()).toBe(200);const id=(await create.json()).id;
  async function current(){return (await(await page.request.get(`${api}/filings`)).json()).filings.find((f:{id:string})=>f.id===id);}
  const draft=await current();const model={adjustments:[],simulationAcknowledged:true,exceptions:draft.readiness.findings.map((f:{key:string;inputRefs:string[]})=>({key:f.key,reason:`${secret} Simulation exception only; original source mismatch remains open.`,refs:[f.inputRefs[0]]}))};
  expect((await page.request.post(`${api}/season`,{data:{action:'model',id,expectedRevision:draft.revision,model}})).status()).toBe(200);
  for(const who of ['st-02','st-03','cu-01']){await enter(page,who);expect((await page.request.post(`${api}/season`,{data:{action:who==='cu-01'?'approve':'attest',id,expectedRevision:(await current()).revision}})).status()).toBe(200);}
  await enter(page);expect((await page.request.post(`${api}/season`,{data:{action:'submit',id,expectedRevision:(await current()).revision}})).status()).toBe(200);
  await enter(page,'cu-01');const safe=await page.request.get(`${api}/exports?kind=client&id=${id}`);expect(safe.status()).toBe(200);const html=await safe.text();for(const forbidden of [secret,'666-52-9134','attestations','sourceRefs'])expect(html).not.toContain(forbidden);expect(html).toContain('81962');expect((await page.request.get(`${api}/exports?kind=notice`)).status()).toBe(403);
});
test('a saved linked answer survives refresh and a genuinely new signed session without browser storage',async({page,browser})=>{
  await enter(page);const title=`Phase 8 persistence question ${Date.now()}`;
  const created=await page.request.post(`${api}/collaboration`,{data:{action:'create',kind:'question',audience:'client',title,body:'Please confirm whether a legible D64 receipt is available. This audit does not establish the donation amount.',sourceRefs:['doc:D64#page1'],assigneeId:'cu-01',dueDate:null}});expect(created.status()).toBe(200);const question=await created.json();
  await enter(page,'cu-01');await page.goto(`${base}/workflow?item=${question.id}`);const answer='Phase 8 test answer: a legible receipt still needs to be supplied; no gift amount is verified.';
  expect((await page.request.post(`${api}/collaboration`,{data:{action:'reply',id:question.id,expectedRevision:question.revision,body:answer,kind:'answer'}})).status()).toBe(200);await page.reload();await expect(page.locator('.collab-messages')).toContainText(answer);
  const fresh=await browser.newContext();const next=await fresh.newPage();await enter(next);await next.goto(`${base}/workflow?item=${question.id}`);await expect(next.locator('.collab-messages')).toContainText(answer);expect(await next.evaluate(()=>localStorage.length)).toBe(0);await fresh.close();
});
