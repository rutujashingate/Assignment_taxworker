import { test,expect,type Page,type Locator } from '@playwright/test';

const base='/engagements/CL-20417/2025',api=`/api${base}`;
async function enter(page:Page,id='st-01'){
  expect((await page.request.post('/api/demo-session',{data:{identityId:'st-02'}})).status()).toBe(200);
  const season=await(await page.request.get(`${api}/season`)).json();
  expect((await page.request.post(`${api}/season`,{data:{action:'clock',eventId:'default',expectedRevision:season.clock.revision}})).status()).toBe(200);
  expect((await page.request.post('/api/demo-session',{data:{identityId:id}})).status()).toBe(200);
  if(id.startsWith('st-')){const preference=await(await page.request.get(`${api}/preferences`)).json();if(preference.selectedVersion!=='v3')expect((await page.request.post(`${api}/preferences`,{data:{selectedVersion:'v3',expectedRevision:preference.revision}})).status()).toBe(200);}
}
async function tabTo(page:Page,link:Locator){for(let i=0;i<220;i++){if(await link.evaluate(el=>el===document.activeElement))return;await page.keyboard.press('Tab');}throw Error('Link could not be reached through the keyboard tab order.');}

test('visible links have no underlines across CPA pages and retain visible hover and keyboard states',async({page})=>{
  test.setTimeout(60000);await enter(page);
  for(const route of ['/firm',`${base}/review`,`${base}/return`,`${base}/documents`,`${base}/workflow`,`${base}/history`,`${base}/records`,`${base}/documents/D29`]){
    await page.goto(route);
    const underlined=await page.locator('a:visible,a:visible code').evaluateAll(elements=>elements.filter(el=>getComputedStyle(el).textDecorationLine.includes('underline')).map(el=>el.textContent));
    expect(underlined,route).toEqual([]);
  }
  const field=page.getByTestId('printed-field-ev-0538');
  const before=await field.evaluate(el=>({background:getComputedStyle(el).backgroundColor,shadow:getComputedStyle(el).boxShadow}));
  await field.hover();await expect.poll(async()=>field.evaluate(el=>getComputedStyle(el).boxShadow)).not.toBe(before.shadow);
  await page.goto(`${base}/documents/D29`);await tabTo(page,field);await expect(field).toBeFocused();
  expect(await field.evaluate(el=>getComputedStyle(el).outlineStyle)).toBe('solid');await page.keyboard.press('Enter');
  await expect(page.locator('.inspector-ref')).toHaveText('ev-0538');
  await expect(page.getByRole('region',{name:'Tax line usage',exact:true}).getByRole('link',{name:'Open return line F1040.2b',exact:true})).toBeVisible();
});

test('E01 C01 E08: a formatted return amount traces through real input amounts to both bank reports and back',async({page})=>{
  await enter(page);await page.goto(`${base}/return`);
  await page.getByRole('searchbox',{name:'Find a line or amount',exact:true}).fill('$6,450');await page.getByRole('button',{name:'Find lines',exact:true}).click();
  await page.getByRole('link',{name:'Trace amount for F1040.2b',exact:true}).click();
  const inspector=page.locator('#evidence-inspector');await expect(inspector.locator('.inspector-amount')).toHaveText('$6,450');
  for(const ref of ['SchB.4','SchB.2']){const input=inspector.getByRole('link',{name:`Follow input ${ref}`,exact:true});await expect(input).toContainText('6,450');await input.click();await expect(inspector.locator('.inspector-ref')).toHaveText(ref);}
  for(const [line,source,doc] of [['SchB.1.1','ev-0492','D28'],['SchB.1.2','ev-0538','D29']]){
    if(line==='SchB.1.2'){await inspector.getByRole('link',{name:'Back to selected return line F1040.2b',exact:true}).click();for(const ref of ['SchB.4','SchB.2'])await inspector.getByRole('link',{name:`Follow input ${ref}`,exact:true}).click();}
    const input=inspector.getByRole('link',{name:`Follow input ${line}`,exact:true});await expect(input).toContainText('1,840');await input.click();
    const evidence=inspector.getByRole('link',{name:`Open source ${source}`,exact:true});await expect(evidence).toContainText('1,840');await evidence.click();
    await expect(inspector.locator('.printed-selection')).toContainText('1,840.00');
    await inspector.getByRole('link',{name:`Open ${doc} document`,exact:true}).click();await page.getByTestId(`printed-field-${source}`).click();
    const wage=page.getByRole('region',{name:'Tax line usage',exact:true}).getByRole('link',{name:'Open return line F1040.2b',exact:true});await expect(wage).toContainText('6,450');await wage.click();
    await expect(inspector.locator('.inspector-ref')).toHaveText('F1040.2b');
    if(line==='SchB.1.1'){for(const ref of ['SchB.4','SchB.2'])await inspector.getByRole('link',{name:`Follow input ${ref}`,exact:true}).click();}
  }
});
