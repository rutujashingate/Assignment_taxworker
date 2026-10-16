import { test,expect,type Page } from '@playwright/test';
import type { FilingModel } from '../../src/lib/season/service';
const base='/engagements/CL-20417/2025',api=`/api${base}`;
async function enter(page:Page,id:string){expect((await page.request.post('/api/demo-session',{data:{identityId:id}})).status()).toBe(200);}
async function clock(page:Page,eventId:string){await enter(page,'st-02');const data=await(await page.request.get(`${api}/season`)).json();expect((await page.request.post(`${api}/season`,{data:{action:'clock',eventId,expectedRevision:data.clock.revision}})).status()).toBe(200);}
async function filing(page:Page,id:string){const data=await(await page.request.get(`${api}/filings`)).json();return data.filings.find((f:{id:string})=>f.id===id);}
function card(page:Page,id:string){return page.getByTestId('filing-card').filter({has:page.locator('code',{hasText:id})});}
async function approval(page:Page,id:string){
  for(const who of ['st-02','st-03','cu-01']){
    await enter(page,who);await page.goto(`${base}/${who==='cu-01'?'workflow':'history'}`);const target=card(page,id);
    await target.getByRole('button',{name:who==='cu-01'?'Approve & authorize simulation':`Approve simulation as ${who==='st-02'?'reviewer':'partner'}`,exact:true}).click();
    await expect.poll(async()=>{const f=await filing(page,id);return who==='cu-01'?f.approval?.current:Boolean(f.attestations?.[who==='st-02'?'reviewer':'partner']);}).toBe(true);
  }
}
test.afterEach(async({page})=>{await clock(page,'default');});
test('versions and all five scenarios are browsable, isolated and clearly precomputed',async({page})=>{
  await clock(page,'default');await enter(page,'st-01');const originalPreference=await(await page.request.get(`${api}/preferences`)).json();await page.goto(`${base}/history`);
  await expect(page.getByRole('heading',{name:'History & Scenarios',exact:true})).toBeVisible();await expect(page.locator('.version-cards')).toContainText('2026-06-23T06:05:00Z');
  await page.getByRole('combobox',{name:'Compare from',exact:true}).selectOption('v1');await page.getByRole('combobox',{name:'Compare to',exact:true}).selectOption('v3');await page.getByRole('button',{name:'Compare versions',exact:true}).click();await expect(page.locator('.season-diffs')).toContainText('F1040.2b');
  const ids=['equipment_section179','equipment_no_bonus','hvac_improvement','standard_deduction','penalty_annualized'];
  const outputs=['17824','92207','85595','94268','81962'];
  for(const [i,id] of ids.entries()){await page.locator(`.scenario-links a[href="?scenario=${id}"]`).click();await expect(page.locator('.scenario-result')).toContainText('PRECOMPUTED · ISOLATED');await expect(page.locator('.scenario-result')).toContainText(outputs[i]);await expect(page.getByRole('heading',{name:'Federal · supplied outcome',exact:true})).toBeVisible();await expect(page.locator('.scenario-outcomes')).toContainText(Number(outputs[i]).toLocaleString('en-US'));}
  await page.getByText('Custom rate-based estimate',{exact:true}).click();await page.getByRole('combobox',{name:'Rate category',exact:true}).selectOption('interest');await page.getByRole('spinbutton',{name:'Hypothetical dollar change',exact:true}).fill('-1840');await expect(page.getByRole('status').filter({hasText:'Rate-based estimate only:'})).toContainText('-640.32');
  const preferences=await(await page.request.get(`${api}/preferences`)).json();expect(preferences).toEqual(originalPreference);
  await page.screenshot({path:'test-results/phase7-desktop-history.png',fullPage:false});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/phase7-mobile-history.png',fullPage:false});
});
test('clock UI and direct APIs preserve historical availability, including pre-computation events',async({page})=>{
  await clock(page,'default');await page.goto(`${base}/history`);await expect(page.locator('.season-timeline li')).toHaveCount(29);
  await page.getByRole('button',{name:'Replay through tl-01',exact:true}).click();await expect(page.getByText('No return had been computed at this date.',{exact:false})).toBeVisible();await page.goto(`${base}/return`);await expect(page.getByRole('heading',{name:'No computed return at this date',exact:true})).toBeVisible();await page.getByRole('link',{name:'Open season replay',exact:true}).click();
  await page.getByRole('button',{name:'Reset to v3 · June 23',exact:true}).click();await expect(page.locator('.version-cards')).toContainText('v3');
  expect((await page.request.get(`${api}/evidence?ref=D71`)).status()).toBe(404);const missing=await(await page.request.get(`${api}/evidence?ref=D71`)).json();expect(JSON.stringify(missing)).not.toContain('666-74-3390');expect(JSON.stringify(missing)).toContain('missing_source');
  expect((await page.request.get(`${api}/exports?kind=notice`)).status()).toBe(404);
  await page.getByRole('button',{name:'Replay through tl-22',exact:true}).click();await expect.poll(async()=>(await(await page.request.get(`${api}/season`)).json()).clock.asOf).toBe('2026-07-13T19:02:00Z');await page.goto(`${base}/documents?q=D71`);await expect(page.getByRole('link',{name:'Open document D71',exact:true})).toBeVisible();
  await page.goto(`${base}/documents?q=D72`);await expect(page.getByText('No documents match',{exact:true})).toBeVisible();
  await enter(page,'cu-01');expect((await page.request.get(`${api}/season`)).status()).toBe(403);expect((await page.request.post(`${api}/season`,{data:{action:'create',parentId:null}})).status()).toBe(403);
});
test('browser authorization, rejection, correction, frozen acceptance, amendment and offline notice download',async({page,browser},testInfo)=>{
  test.setTimeout(120000);await clock(page,'tl-20');await enter(page,'st-01');await page.goto(`${base}/history`);
  await page.getByRole('button',{name:'Create filing simulation',exact:true}).click();
  const list=await(await page.request.get(`${api}/filings`)).json();const id=list.filings.at(-1).id;
  const draft=card(page,id);await expect(draft).toBeVisible();
  const fields=draft.locator('.simulation-exception textarea');for(let i=0;i<await fields.count();i++)await fields.nth(i).fill('Browser demonstration exception: inspect the linked original evidence; no corrected liability is claimed.');
  await draft.getByRole('checkbox').check();await draft.getByRole('button',{name:'Save simulation assumptions',exact:true}).click();await expect.poll(async()=>(await filing(page,id)).model.simulationAcknowledged).toBe(true);
  await approval(page,id);await enter(page,'st-01');await page.goto(`${base}/history`);await card(page,id).getByRole('button',{name:'Submit simulation',exact:true}).click();await expect(card(page,id).locator('.status-label')).toContainText('submitted');
  await clock(page,'tl-21');await enter(page,'st-01');await page.goto(`${base}/history`);await card(page,id).getByRole('button',{name:'Replay next scripted agency response',exact:true}).click();await expect(card(page,id).locator('.status-label')).toContainText('rejected');await expect(card(page,id).locator('.filing-acknowledgments')).toContainText('R0000-504-02');await expect(card(page,id).locator('.filing-acknowledgments')).toContainText('STATE-HOLD');
  await expect(card(page,id).getByRole('button',{name:'Link D71 dependent-ID correction',exact:true})).toBeDisabled();await expect(card(page,id)).toContainText('D71 is not available');
  await clock(page,'tl-22');await enter(page,'st-01');await page.goto(`${base}/history`);await card(page,id).getByRole('button',{name:'Link D71 dependent-ID correction',exact:true}).click();await expect(card(page,id).locator('.status-label')).toContainText('draft');
  await approval(page,id);await enter(page,'st-01');await page.goto(`${base}/history`);await card(page,id).getByRole('button',{name:'Submit simulation',exact:true}).click();await expect(card(page,id).locator('.status-label')).toContainText('submitted');
  for(const event of ['tl-23','tl-24']){
    await clock(page,event);await enter(page,'st-01');await page.goto(`${base}/history`);
    const expected=event==='tl-23'?'federal_accepted':'accepted';
    const response=page.waitForResponse(r=>r.url().endsWith('/season')&&r.request().method()==='POST'&&r.request().postDataJSON().action==='response');
    await card(page,id).getByRole('button',{name:'Replay next scripted agency response',exact:true}).click();
    const saved=await response;expect(saved.status()).toBe(200);expect((await saved.json()).status).toBe(expected);
    await expect.poll(async()=>(await filing(page,id)).status,{timeout:15000}).toBe(expected);
  }
  await page.reload();await expect(card(page,id)).toContainText('frozen on the server');const accepted=await filing(page,id);
  expect((await page.request.post(`${api}/season`,{data:{action:'submit',id,expectedRevision:accepted.revision}})).status()).toBe(409);
  await card(page,id).getByRole('button',{name:'Create amendment branch',exact:true}).click();await expect.poll(async()=>{const d=await(await page.request.get(`${api}/filings`)).json();return d.filings.filter((f:{parentId:string})=>f.parentId===id).length;}).toBe(1);
  const all=await(await page.request.get(`${api}/filings`)).json(),amendment=all.filings.find((f:{parentId:string})=>f.parentId===id);const model:FilingModel={...amendment.model,adjustments:[{line:'SchC.1',delta:-12400,category:'schc_profit',reason:'Browser amendment model of the documented included deposits.',refs:['D15','D21']}]};
  expect((await page.request.post(`${api}/season`,{data:{action:'model',id:amendment.id,expectedRevision:amendment.revision,model}})).status()).toBe(200);expect((await filing(page,id)).snapshotHash).toBe(accepted.snapshotHash);
  await clock(page,'tl-29');await page.goto(`${base}/history`);const downloadEvent=page.waitForEvent('download');await page.getByRole('link',{name:'Download offline notice-response HTML',exact:true}).click();const download=await downloadEvent;const path=testInfo.outputPath('Letter566-evidence.html');await download.saveAs(path);
  const offline=await browser.newContext({offline:true});const document=await offline.newPage();await document.goto(`file://${path}`);await expect(document.getByRole('heading',{name:'Schedule C receipts reconciliation',exact:true})).toBeVisible();await expect(document.locator('body')).toContainText('doc:D65#page1');await expect(document.locator('script,iframe,link')).toHaveCount(0);await offline.close();
  await enter(page,'cu-01');const safe=await page.request.get(`${api}/exports?kind=client&id=${id}`);expect(safe.status()).toBe(200);expect(await safe.text()).not.toContain('Browser demonstration exception');expect((await page.request.get(`${api}/exports?kind=notice`)).status()).toBe(403);
});
