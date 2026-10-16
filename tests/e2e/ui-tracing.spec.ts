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
