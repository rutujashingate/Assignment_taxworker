import { test,expect,type Page,type Locator } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
const base='/engagements/CL-20417/2025',api=`/api${base}`;
async function enter(page:Page,id='st-01'){
  expect((await page.request.post('/api/demo-session',{data:{identityId:id}})).status()).toBe(200);
  if(id.startsWith('st-')){const p=await(await page.request.get(`${api}/preferences`)).json();if(p.selectedVersion!=='v3')expect((await page.request.post(`${api}/preferences`,{data:{selectedVersion:'v3',expectedRevision:p.revision}})).status()).toBe(200);}
}
async function clock(page:Page){await enter(page,'st-02');const s=await(await page.request.get(`${api}/season`)).json();expect((await page.request.post(`${api}/season`,{data:{action:'clock',eventId:'default',expectedRevision:s.clock.revision}})).status()).toBe(200);}
async function tabTo(page:Page,target:Locator){for(let n=0;n<160;n++){if(await target.evaluate(el=>el===document.activeElement))return;await page.keyboard.press('Tab');}throw new Error('Target could not be reached by keyboard.');}
test.beforeEach(async({page})=>{await clock(page);});
test.afterEach(async({page})=>{await clock(page);});

test('fresh CPA entry identifies a next task, understands the discrepancy and opens evidence only on demand',async({page})=>{
  await page.context().clearCookies();await page.setViewportSize({width:1440,height:1050});await page.goto('/firm');
  await page.getByRole('button',{name:'Open workspace',exact:true}).click();await page.getByRole('link',{name:'Open workpaper',exact:true}).click();
  const p=await(await page.request.get(`${api}/preferences`)).json();if(p.selectedVersion!=='v3'){await page.request.post(`${api}/preferences`,{data:{selectedVersion:'v3',expectedRevision:p.revision}});await page.reload();}
  const nav=page.getByRole('navigation',{name:'Engagement',exact:true});await expect(nav.getByRole('link')).toHaveText(['01Review','02Tax Return','03Documents','04Tasks & Approvals','05History']);
  await expect(page.getByLabel('Demo identity')).toBeVisible();await expect(page.locator('.next-review .button')).toHaveText('Review next issue →');
  for(const selector of ['.secondary-tools','.workpaper-data','.review-filters','.issue-technical'])expect(await page.locator(selector).evaluate(el=>(el as HTMLDetailsElement).open)).toBe(false);
  await expect(page.getByTestId('printed-content')).toHaveCount(0);await expect(page.locator('.finding-certainty')).not.toBeVisible();
  await page.locator('.next-review .button').click();await expect(page.locator('#selected-finding')).toBeVisible();
  for(const text of ['What happened','Reported value','Supported value','Difference to review','Take the next step'])await expect(page.locator('#selected-finding').getByText(text,{exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Request information',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Explain',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'View source evidence',exact:true}).click();await expect(page.locator('#evidence-inspector').getByTestId('printed-content')).toBeVisible();
  await page.getByRole('link',{name:'Close evidence and return to issue',exact:true}).click();await expect(page.getByTestId('printed-content')).toHaveCount(0);
  await page.locator('.secondary-tools > summary').click();for(const name of ['CPA Records','Search all records','My work time','Coverage','Submission & audit'])await expect(page.getByRole('navigation',{name:'More tools',exact:true}).getByRole('link',{name,exact:true})).toBeVisible();
  await page.getByRole('navigation',{name:'More tools',exact:true}).getByRole('link',{name:'CPA Records',exact:true}).click();await expect(page.getByRole('heading',{name:'Tax areas',exact:true})).toBeVisible();
});

test('Explain and Assign persist; a requested client question is saved only after explicit creation',async({page,browser})=>{
  const key='CHARITY_AMOUNT_UNCLEAR:D64';await enter(page);await page.goto(`${base}/review?${new URLSearchParams({issue:key})}`);
  const original=(await(await page.request.get(`${api}/issues`)).json()).issues.find((i:{key:string})=>i.key===key);
  try{
    await page.getByRole('link',{name:'Explain',exact:true}).click();await expect(page.getByLabel('Review state')).toHaveValue('explained');
    await page.getByRole('link',{name:'Assign',exact:true}).click();await expect(page.getByLabel('Assignee',{exact:true})).toBeFocused();await page.getByLabel('Assignee',{exact:true}).selectOption('st-02');
    await page.getByLabel('Reason or explanation').fill('UX test: the original gift remains ambiguous; written confirmation is required.');await page.getByRole('button',{name:'Save review status',exact:true}).click();await expect(page.getByRole('status',{name:'Triage save status'})).toContainText('Review saved');
    await page.reload();await expect(page.getByLabel('Review state')).toHaveValue('explained');await expect(page.getByLabel('Assignee',{exact:true})).toHaveValue('st-02');
    const before=(await(await page.request.get(`${api}/collaboration`)).json()).items.length;
    await page.getByRole('link',{name:'Request information',exact:true}).click();await expect(page.getByText('Information request · not sent yet',{exact:true})).toBeVisible();
    expect((await(await page.request.get(`${api}/collaboration`)).json()).items.length).toBe(before);
    const form=page.getByRole('form',{name:'Create collaboration record',exact:true});await expect(form.getByLabel('Linked evidence references')).toHaveValue(/D64/u);
    const title=`UX gift confirmation ${randomUUID()}`;await form.getByLabel('Title',{exact:true}).fill(title);await form.getByRole('button',{name:'Create record',exact:true}).click();
    await expect(page.getByRole('article',{name:'Selected collaboration record'})).toContainText(title);await expect(page.getByText('Information request · not sent yet',{exact:true})).toHaveCount(0);
    const saved=(await(await page.request.get(`${api}/collaboration`)).json()).items.find((i:{title:string})=>i.title===title);
    expect(saved.audience).toBe('client');expect(saved.sourceRefs).toContain('doc:D64#page1');
    const client=await browser.newContext();const other=await client.newPage();await enter(other,'cu-01');await other.goto(`${base}/workflow?item=${saved.id}`);await expect(other.getByRole('article',{name:'Selected collaboration record'})).toContainText(title);await client.close();
  }finally{
    await enter(page);const current=(await(await page.request.get(`${api}/issues`)).json()).issues.find((i:{key:string})=>i.key===key);
    expect((await page.request.post(`${api}/issues/${encodeURIComponent(key)}`,{data:{version:original.version,status:original.status,assigneeId:original.assigneeId,note:original.note,evidenceRefs:original.evidenceRefs,expectedRevision:current.revision}})).status()).toBe(200);
  }
});

test('role-specific actions and protected data remain enforced after simplification',async({page})=>{
  for(const id of ['st-01','st-02','st-03']){await enter(page,id);await page.goto(`${base}/review`);await expect(page.getByRole('form',{name:'Issue triage'})).toBeVisible();await expect(page.getByLabel('Demo identity')).toHaveValue(id);}
  await enter(page,'st-05');await page.goto(`${base}/review`);await expect(page.getByRole('form',{name:'Issue triage'})).toHaveCount(0);await expect(page.getByRole('link',{name:'Request information',exact:true})).toHaveCount(0);await expect(page.getByText('You have read-only access to tax review.',{exact:false})).toBeVisible();
  await page.locator('.secondary-tools > summary').click();await expect(page.getByRole('link',{name:'Firm administration',exact:true})).toBeVisible();expect((await page.request.post(`${api}/issues/CA_PAYMENT_YEAR%3AD68`,{data:{}})).status()).toBe(403);
  await enter(page,'cu-01');await page.goto(`${base}/workflow?request=CHARITY_AMOUNT_UNCLEAR%3AD64`);await expect(page.locator('.question-draft-context')).toHaveCount(0);await expect(page.getByRole('heading',{name:'Questions, tasks & approvals',exact:true})).toBeVisible();expect((await page.request.get(`${api}/issues`)).status()).toBe(403);
  await page.goto(`${base}/review`);await expect(page.getByRole('heading',{name:'Staff workspace',exact:true})).toBeVisible();await expect(page.locator('#finding-title')).toHaveCount(0);
  await enter(page);await page.goto(`${base}/review`);await expect(page.getByRole('button',{name:'Record correction',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Submit for review',exact:true})).toHaveCount(0);await expect(page.locator('.unavailable-actions')).toContainText('Not available:');
});

test('review is keyboard-accessible and responsive with real before/after comparison captures',async({page})=>{
  test.setTimeout(60000);await enter(page,'st-04');mkdirSync('docs/screenshots/ux',{recursive:true});
  for(const [name,width,height] of [['desktop',1440,1050],['tablet',1024,900],['mobile',390,844]] as const){
    await page.setViewportSize({width,height});await page.goto(`${base}/review`);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.getByLabel('Demo identity')).toBeVisible();await expect(page.locator('.next-review .button')).toBeVisible();
    const next=await page.locator('.next-review .button').boundingBox();expect(next!.y+next!.height,`${name}: next action must appear in the initial viewport`).toBeLessThanOrEqual(height);
    await page.screenshot({path:`docs/screenshots/ux/after-review-${name}.png`});
    await page.locator('.next-review .button').click();await expect(page.locator('#selected-finding')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.setViewportSize({width:1440,height:1050});await page.goto(`${base}/review?issue=CA_PAYMENT_YEAR%3AD68#selected-finding`);await page.screenshot({path:'docs/screenshots/ux/after-issue-desktop.png'});
  const view=page.getByRole('link',{name:'View source evidence',exact:true});await tabTo(page,view);await expect(view).toBeFocused();expect(await view.evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none');await page.keyboard.press('Enter');
  await expect(page.getByTestId('printed-content')).toContainText('tax year 2024');await page.screenshot({path:'docs/screenshots/ux/after-evidence-desktop.png'});
  const role=await page.getByLabel('Demo identity').boundingBox();expect(role!.y).toBeGreaterThanOrEqual(0);expect(role!.y+role!.height).toBeLessThan(1050);
});
