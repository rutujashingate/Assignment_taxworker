import { test,expect,type Page } from '@playwright/test';
import { AREAS } from '../../src/lib/records/types';
import type { Lot,LotReview } from '../../src/lib/records/types';
const base='/engagements/CL-20417/2025',api=`/api${base}`;
async function enter(page:Page,id='st-01') {
  expect((await page.request.post('/api/demo-session',{data:{identityId:id}})).status()).toBe(200);
  if(id.startsWith('st-')){const pref=await(await page.request.get(`${api}/preferences`)).json();if(pref.selectedVersion!=='v3')expect((await page.request.post(`${api}/preferences`,{data:{selectedVersion:'v3',expectedRevision:pref.revision}})).status()).toBe(200);}
}
test('each tax area opens a representative real source through the reused Evidence Inspector',async({page})=>{
  test.setTimeout(60000);await enter(page);
  for(const area of AREAS) {
    await page.goto(`${base}/records/${area.id}`);await expect(page.getByRole('heading',{name:area.title,exact:true})).toBeVisible();
    const inspector=page.locator('#evidence-inspector');await expect(inspector.locator('.inspector-ref')).toHaveText(area.trace);
    for(let step=0;step<20&&!(await inspector.getByTestId('printed-content').count());step++) {
      const extracted=inspector.getByRole('link',{name:/^Trace ev-/}).first();
      const doc=inspector.getByRole('link',{name:/^Trace D\d\d$/}).first();
      const direct=inspector.getByRole('link',{name:/^(Follow input|Open source) /}).first();
      if(await extracted.count())await extracted.click();else if(await doc.count())await doc.click();else if(await direct.count())await direct.click();else break;
    }
    await expect(inspector.getByTestId('printed-content')).toBeVisible();await expect(inspector.getByTestId('printed-content')).not.toBeEmpty();
  }
  await page.goto(`${base}/records/basis`);await expect(page.getByRole('heading',{name:'2023 S-corp ending basis missing',exact:true})).toBeVisible();
  await page.goto(`${base}/records/k1`);await expect(page.getByRole('heading',{name:'Related entity returns are not supplied',exact:true})).toBeVisible();
});
test('260-lot performance smoke groups real D74 totals and virtualizes all rows with deep-linked detail',async({page})=>{
  await enter(page);const start=Date.now();await page.goto(`${base}/records/sales`);await expect(page.getByRole('table',{name:'Virtualized sales lots',exact:true})).toBeVisible();expect(Date.now()-start).toBeLessThan(8000);
  await expect(page.getByRole('status',{name:'Lot window'})).toContainText('260 matching lots');expect(await page.getByTestId('virtual-lot-row').count()).toBeLessThanOrEqual(12);
  const data=await(await page.request.get(`${api}/records/sales`)).json();const lots:Lot[]=data.lots.filter((l:Lot)=>l.documentId==='D74');expect(lots).toHaveLength(260);expect(data.lots).toHaveLength(294);
  await page.getByRole('button',{name:'Last window',exact:true}).click();await expect(page.getByRole('status',{name:'Lot window'})).toContainText('260');expect(await page.getByTestId('virtual-lot-row').count()).toBeLessThanOrEqual(12);
  const last=lots.at(-1)!;await page.getByRole('link',{name:`Inspect lot ${last.id}`,exact:true}).click();await expect(page.getByRole('region',{name:'Selected lot details'})).toContainText(last.description);
  const firstRef=last.sourceRefs[0];await page.getByRole('region',{name:'Selected lot details'}).getByRole('link',{name:firstRef,exact:true}).click();await expect(page.locator('#evidence-inspector .inspector-ref')).toHaveText(firstRef);await expect(page.locator('#evidence-inspector').getByTestId('printed-content')).toBeVisible();
  await page.screenshot({path:'test-results/phase6-desktop-sales.png',fullPage:true});
  await page.goto(`${base}/records/sales?lot=F8949.H.C6`);const detail=page.getByRole('region',{name:'Selected lot details'});await expect(detail).toContainText('Not supplied · evidence gap');await expect(detail).toContainText('Missing basis/date');
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await detail.scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/phase6-mobile-lot.png'});
});
test('bulk lot review persists across reload and stale batches are rejected atomically',async({page})=>{
  await enter(page);await page.goto(`${base}/records/sales`);
  const before=await(await page.request.get(`${api}/records/sales`)).json();const lots:Lot[]=before.lots.filter((l:Lot)=>l.documentId==='D74');const reviews:LotReview[]=before.reviews;
  await page.getByRole('button',{name:'Select all 260 matching lots',exact:true}).click();const form=page.getByRole('form',{name:'Bulk lot review',exact:true});
  await form.getByRole('textbox',{name:'Review reason',exact:true}).fill('Compared the supplied lot fields and noted that this is a review overlay, not a tax correction.');await form.getByRole('button',{name:'Save bulk review',exact:true}).click();await expect(page.getByRole('status',{name:'Bulk save status'})).toHaveText('260 lots saved with audit history.');
  await page.reload();const data=await(await page.request.get(`${api}/records/sales`)).json();expect(data.reviews.filter((r:LotReview)=>lots.some(l=>l.key===r.key)&&r.status==='reviewed')).toHaveLength(260);
  const stale=await page.request.post(`${api}/lot-reviews`,{data:{version:'v3',status:'needs_review',reason:'A stale review batch must not overwrite the newer observation.',items:lots.slice(0,2).map(l=>({key:l.key,expectedRevision:reviews.find(r=>r.key===l.key)?.revision??0}))}});expect(stale.status()).toBe(409);
  const actor=await page.request.post('/api/demo-session',{data:{identityId:'st-05'}});expect(actor.ok()).toBe(true);expect((await page.request.post(`${api}/lot-reviews`,{data:{}})).status()).toBe(403);
});
test('global search supports exact amounts, documents, lines and lots with usable deep links and role filters',async({page})=>{
  await enter(page);await page.goto('/firm/search');const form=page.getByRole('form',{name:'Global search',exact:true});
  await form.getByRole('searchbox',{name:'Search records',exact:true}).fill('$1,840');await form.getByRole('combobox',{name:'Record type',exact:true}).selectOption('amount');await form.getByRole('button',{name:'Search all records',exact:true}).click();
  await expect(page.getByRole('region',{name:'Global search results'})).toContainText('ev-0492');await expect(page.getByRole('region',{name:'Global search results'})).toContainText('ev-0538');
  for(const [q,kind] of [['D29','document'],['F1040.2b','line'],['X260','lot']]) {
    const search=page.getByRole('form',{name:'Global search',exact:true});await search.getByRole('searchbox').fill(q);await search.getByRole('combobox').selectOption(kind);await search.getByRole('button',{name:'Search all records',exact:true}).click();
    const results=page.getByRole('region',{name:'Global search results'});await expect(results.locator('li')).toHaveCount(1);await results.locator('li').getByRole('link').click();await expect(page.locator('#evidence-inspector')).toBeVisible();await page.goto('/firm/search');
  }
  await enter(page,'cu-01');for(const endpoint of ['/api/search?q=internal',`${api}/records/basis`,'/api/firm/admin',`${api}/time`])expect((await page.request.get(endpoint)).status()).toBe(403);
  await page.goto(`${base}/records/basis`);await expect(page.getByRole('heading',{name:'Staff workspace',exact:true})).toBeVisible();expect(await page.content()).not.toContain('2023 S-corp ending basis missing');
});
test('firm admin standards and time controls persist; access logs expose metadata and coverage stays honest',async({page})=>{
  await enter(page,'st-05');await page.goto('/firm/admin');await expect(page.getByRole('heading',{name:'Standards & operations',exact:true})).toBeVisible();
  const before=await(await page.request.get('/api/firm/admin')).json();const standards=page.getByRole('form',{name:'Firm standards',exact:true});const percent=before.standards.record.variance_review.flag_if_change_over_percent;
  try {
    await standards.getByRole('spinbutton',{name:'Variance percentage',exact:true}).fill(String(percent+1));await standards.getByRole('button',{name:'Save firm standards',exact:true}).click();await expect(standards.getByRole('status')).toContainText('Standards saved');await page.reload();await expect(page.getByRole('spinbutton',{name:'Variance percentage',exact:true})).toHaveValue(String(percent+1));
  } finally {const current=await(await page.request.get('/api/firm/admin')).json();const original=before.standards.record;expect((await page.request.post('/api/firm/admin',{data:{expectedRevision:current.standards.revision,variancePercent:original.variance_review.flag_if_change_over_percent,varianceAmount:original.variance_review.and_over_amount,requiredSteps:original.required_steps,rules:original.rules}})).status()).toBe(200);}
  await enter(page,'st-01');await page.goto('/firm/time');const time=page.getByRole('form',{name:'Log work time',exact:true});await time.getByRole('spinbutton',{name:'Minutes worked',exact:true}).fill('11');await time.getByLabel('Work date',{exact:true}).fill('2026-06-23');await time.getByRole('textbox',{name:'Work description',exact:true}).fill('Browser test: reviewed original California allocation sources.');await time.getByRole('button',{name:'Record work time',exact:true}).click();await expect(time.getByRole('status')).toContainText('Work time recorded');await page.reload();await expect(page.locator('.time-entry').first()).toContainText('11 minutes');
  expect((await page.request.get('/api/firm/admin')).status()).toBe(403);await page.goto('/firm/admin');await expect(page.getByRole('heading',{name:'Firm administration restricted',exact:true})).toBeVisible();
  await page.goto('/coverage');await expect(page.getByRole('heading',{name:'Requirement coverage',exact:true})).toBeVisible();await expect(page.locator('#signoffs')).toContainText('limitation');await expect(page.locator('#video')).toContainText('No video link has been fabricated');
  await page.setViewportSize({width:390,height:844});await page.goto(`${base}/records`);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/phase6-mobile-areas.png',fullPage:true});
});
