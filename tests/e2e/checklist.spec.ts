import { test,expect,type Page } from '@playwright/test';
import { readFileSync,writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { packetSchema } from '../../src/lib/packet/schema';

const base='/engagements/CL-20417/2025',api=`/api${base}`;
const packet=packetSchema.parse(JSON.parse(readFileSync('data/okafor_lindqvist_2025_packet.json','utf8')));
async function enter(page:Page,id='st-01'){
  expect((await page.request.post('/api/demo-session',{data:{identityId:id}})).status()).toBe(200);
  if(id.startsWith('st-')){
    const pref=await(await page.request.get(`${api}/preferences`)).json();
    if(pref.selectedVersion!=='v3')expect((await page.request.post(`${api}/preferences`,{data:{selectedVersion:'v3',expectedRevision:pref.revision}})).status()).toBe(200);
  }
}
async function resetClock(page:Page){
  await enter(page,'st-02');const season=await(await page.request.get(`${api}/season`)).json();
  expect((await page.request.post(`${api}/season`,{data:{action:'clock',eventId:'default',expectedRevision:season.clock.revision}})).status()).toBe(200);
}
test.beforeEach(async({page})=>{await resetClock(page);await enter(page);});
test.afterEach(async({page})=>{await resetClock(page);});

test('E01 E08 C01: wages trace to the actual D08 and D09 Box 1 fields and reverse usage',async({page})=>{
  const wages=packet.return_versions.find(v=>v.version==='v3')!.lines.find(l=>l.key==='F1040.1a')!;
  expect(wages.value).toBe(212400);expect(wages.rule).toBe('R-W2-BOX1-SUM');
  const sources=wages.sources.map(ref=>packet.extracted_values.find(v=>v.id===ref)!);
  expect(sources.map(v=>v.document_id).sort()).toEqual(['D08','D09']);
  for(const source of sources){
    await page.goto(`${base}/return?line=F1040.1a&ref=F1040.1a`);
    const inspector=page.locator('#evidence-inspector');
    await expect(inspector.locator('.inspector-amount')).toHaveText('$212,400');
    await expect(inspector).toContainText('R-W2-BOX1-SUM');
    await inspector.getByRole('link',{name:`Open source ${source.id}`,exact:true}).click();
    await expect(inspector.locator('.inspector-ref')).toHaveText(source.id);
    await expect(inspector.getByTestId(`printed-field-${source.id}`)).toContainText('Box 1');
    await expect(inspector.locator('.printed-selection')).toContainText(Number(source.value).toLocaleString('en-US',{minimumFractionDigits:2}));
    await inspector.getByRole('link',{name:`Open ${source.document_id} document`,exact:true}).click();
    await page.getByTestId(`printed-field-${source.id}`).click();
    await page.getByRole('region',{name:'Tax line usage',exact:true}).getByRole('link',{name:'Open return line F1040.1a',exact:true}).click();
    await expect(page.locator('.inspector-ref')).toHaveText('F1040.1a');
  }
  await page.screenshot({path:'test-results/checklist-wages.png'});
});

test('E05 E06 R10 R11: prior evidence, absent related returns, retirement pages and SEK rates remain inspectable',async({page})=>{
  await page.goto(`${base}/records/carryovers`);
  await page.getByRole('link',{name:'Inspect py:/carryovers_into_2025',exact:true}).click();
  await expect(page.locator('.inspector-ref')).toHaveText('py:/carryovers_into_2025');
  await expect(page.locator('.reference-record')).toContainText('passive_1450_fremont');
  await page.goto(`${base}/records/k1`);
  await expect(page.getByRole('heading',{name:'Related entity returns are not supplied',exact:true})).toBeVisible();
  await page.getByText('Related returns · evidence stubs',{exact:true}).click();
  await page.getByRole('link',{name:'Inspect household:/related_returns',exact:true}).click();
  await expect(page.locator('.reference-record')).toContainText('"in_this_packet": false');
  await page.goto(`${base}/records/retirement-foreign?ref=${encodeURIComponent('py:/basis_records/ira_nondeductible_basis_ngozi')}`);
  await expect(page.locator('.inspector-ref')).toHaveText('py:/basis_records/ira_nondeductible_basis_ngozi');
  await expect(page.locator('.reference-record')).not.toBeEmpty();
  for(const id of ['D41','D42','D43','D36']){
    await page.goto(`${base}/documents/${id}`);await expect(page.getByTestId('printed-content')).not.toBeEmpty();
  }
  await page.goto(`${base}/records/retirement-foreign?ref=${encodeURIComponent('ref:fx.SEK.2025_average')}`);
  await expect(page.locator('.inspector-ref')).toHaveText('ref:fx.SEK.2025_average');
  await expect(page.locator('.reference-record')).toHaveText('9.86');
  await page.screenshot({path:'test-results/checklist-foreign-rate.png'});
});

test('P08 P09 P10 FM06: checklist searches, linked assignment, deadline and recipient notification persist',async({page})=>{
  for(const [q,kind,expected] of [['CL-20417','engagement','CL-20417'],['D23','document','D23'],['interest','line','F1040.2b']]){
    await page.goto(`/firm/search?${new URLSearchParams({q,kind})}`);
    const response=await page.request.get(`/api/search?${new URLSearchParams({q,kind})}`);expect(response.status()).toBe(200);
    const search=await response.json();expect(search.rows.some((r:{ref:string})=>r.ref===expected)).toBe(true);
    await expect(page.getByRole('region',{name:'Global search results'})).toContainText(expected);
  }
  const title=`Checklist variance evidence ${randomUUID()}`;
  const created=await page.request.post(`${api}/collaboration`,{data:{action:'create',kind:'task',audience:'internal',title,
    body:'Review the supplied 2024 and 2025 AGI variance. The variance alone does not establish an error or an approved correction.',
    sourceRefs:['F1040.11','py:/return_2024/lines/F1040.11'],assigneeId:'st-02',dueDate:'2026-06-22'}});
  expect(created.status()).toBe(200);const task=await created.json();
  await enter(page,'st-02');await page.goto(`${base}/workflow?item=${task.id}`);await page.reload();
  const selected=page.getByRole('article',{name:'Selected collaboration record'});
  await expect(selected).toContainText(title);await expect(selected).toContainText('2026-06-22');await expect(selected).toContainText('Daniel Ortiz');
  const workspace=await(await page.request.get(`${api}/collaboration`)).json();
  expect(workspace.notifications.some((n:{itemId:string;readAt:string|null})=>n.itemId===task.id&&n.readAt===null)).toBe(true);
  const reloaded=await(await page.request.get(`${api}/collaboration/${task.id}`)).json();
  expect(reloaded).toMatchObject({assigneeId:'st-02',dueDate:'2026-06-22',sourceRefs:['F1040.11','py:/return_2024/lines/F1040.11']});
  expect(Date.parse(reloaded.createdAt)).toBeGreaterThan(0);
  await page.screenshot({path:'test-results/checklist-assignment-deadline.png'});
  const query='INTEREST_SWEEP_OVERLAP';const issueSearch=await page.request.get(`/api/search?${new URLSearchParams({q:query})}`);
  expect(issueSearch.status()).toBe(200);const observed=await issueSearch.json();
  // Capture limitations as observations, not assertions that missing features should stay missing.
  writeFileSync('test-results/checklist-observed-limits.json',JSON.stringify({issueSearch:{query,total:observed.total,kinds:observed.rows.map((r:{kind:string})=>r.kind)},
    deadline:{dueDate:reloaded.dueDate,hasOverdueIndicator:/overdue/iu.test(await selected.innerText())}},null,2)+'\n');
  // A persisted deadline is proven here; no claim of an overdue indicator is made.
});
