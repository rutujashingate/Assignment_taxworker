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

test('E04 R06: sale proceeds and basis amounts open their own real source fields while gain opens the supplied calculation',async({page})=>{
  await enter(page);const data=await(await page.request.get(`${api}/records/sales`)).json();const lot=data.lots.find((l:{documentId:string})=>l.documentId==='D74');
  const fields=await Promise.all(lot.fieldRefs.map(async(ref:string)=>{const response=await page.request.get(`${api}/evidence?ref=${encodeURIComponent(ref)}`);expect(response.status()).toBe(200);return (await response.json()).extraction;}));
  for(const field of ['proceeds','basis']){
    const source=fields.find(f=>f?.field===`${lot.id}_${field}`);expect(source).toBeTruthy();
    await page.goto(`${base}/records/sales`);await page.getByRole('link',{name:`Inspect ${field} for lot ${lot.id}`,exact:true}).click();
    const inspector=page.locator('#evidence-inspector');await expect(inspector.locator('.inspector-ref')).toHaveText(source.id);await expect(inspector.getByTestId('printed-content')).not.toBeEmpty();
    await expect(page.getByRole('region',{name:'Selected lot details',exact:true})).toContainText(lot.description);
    await page.getByRole('link',{name:`Trace selected lot ${field}`,exact:true}).click();await expect(inspector.locator('.inspector-ref')).toHaveText(source.id);
  }
  await page.goto(`${base}/records/sales`);await page.getByRole('link',{name:`Inspect gain for lot ${lot.id}`,exact:true}).click();await expect(page.locator('.inspector-ref')).toHaveText(lot.key);
  await page.goto(`${base}/records/sales?lot=F8949.H.C6`);await expect(page.getByRole('region',{name:'Selected lot details',exact:true})).toContainText('Not supplied · evidence gap');
});

test('Review figures open their actual return/extraction reference or the complete source comparison',async({page})=>{
  await enter(page);
  for(const [issue,ref,amount] of [['CA_PAYMENT_YEAR:D68','F540NR.72','14,000'],['CARD_RECEIPTS_OVERLAP:D14+D15+D21','SchC.1','163,700'],['MILEAGE_DUPLICATE_PAGES:D23','SchC.44a','11,800']]){
    await page.goto(`${base}/review?${new URLSearchParams({issue})}`);await page.getByRole('link',{name:'Inspect reported value',exact:true}).click();
    await expect(page.locator('.inspector-ref')).toHaveText(ref);await expect(page.locator('.inspector-amount')).toBeVisible();await expect(page.locator('.inspector-amount')).toContainText(amount);
  }
  await page.goto(`${base}/review?issue=CHARITY_AMOUNT_UNCLEAR%3AD64`);await page.getByRole('link',{name:'Inspect reported value',exact:true}).click();await expect(page.getByTestId('printed-content')).toContainText('$?,500.00');await expect(page.locator('.printed-selection')).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Inspect supported value',exact:true})).toHaveCount(0);await expect(page.getByRole('link',{name:'Inspect difference value',exact:true})).toHaveCount(0);
  await page.goto(`${base}/review?issue=INTEREST_SWEEP_OVERLAP%3AD28%2BD29`);await page.getByRole('link',{name:'Inspect reported value',exact:true}).click();await expect(page).toHaveURL(/#review-evidence$/u);
  const comparison=page.getByRole('region',{name:'Supporting source evidence',exact:true});await expect(comparison).toContainText('D28');await expect(comparison).toContainText('D29');
  await expect(page.locator('#evidence-inspector')).toHaveCount(0);
});

for(const [name,width,height] of [['small-phone',360,800],['phone',390,844],['tablet',768,1024],['landscape-tablet',1024,768],['desktop',1440,960]] as const){
  test(`responsive CPA navigation and wage amount tracing: ${name}`,async({page})=>{
    test.setTimeout(60000);await enter(page,'st-04');await page.setViewportSize({width,height});
    for(const route of ['/firm',`${base}/review`,`${base}/return`,`${base}/documents`,`${base}/workflow`,`${base}/history`,`${base}/records/computation`,`${base}/records/business`,`${base}/records/sales`,`${base}/documents/D29`]){
      await page.goto(route);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name}: ${route}`).toBe(true);
      await expect(page.getByLabel('Demo identity')).toBeVisible();
      if(route.endsWith('/review')){const next=page.locator('.next-review .button');await expect(next).toBeVisible();const box=await next.boundingBox();expect(box!.y+box!.height,`${name}: start action below initial viewport`).toBeLessThanOrEqual(height);await page.screenshot({path:`test-results/ui-${name}-review.png`});}
    }
    await page.goto(`${base}/return?q=F1040.1a`);await page.getByRole('link',{name:'Trace amount for F1040.1a',exact:true}).click();
    await expect(page.getByRole('searchbox',{name:'Find a line or amount',exact:true})).toHaveValue('F1040.1a');
    const inspector=page.locator('#evidence-inspector');await expect(inspector.locator('.inspector-amount')).toHaveText('$212,400');
    await inspector.getByRole('link',{name:'Open source ev-0016',exact:true}).click();await expect(inspector.locator('.printed-selection')).toContainText('104,600.00');
    const panel=await inspector.boundingBox(),header=await page.locator('.topbar').boundingBox();expect(panel!.y).toBeGreaterThanOrEqual(header!.y+header!.height);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`test-results/ui-${name}-wages-source.png`});
    await page.getByRole('link',{name:'Return to line list',exact:true}).click();await expect(page.locator('#return-lines')).toBeVisible();
  });
}

test('E01 E02 E08: keyboard-only wage number to D09 and back through tax usage',async({page})=>{
  test.setTimeout(60000);await enter(page,'st-04');await page.setViewportSize({width:768,height:1024});await page.goto(`${base}/return?q=F1040.1a`);
  const amount=page.getByRole('link',{name:'Trace amount for F1040.1a',exact:true});await tabTo(page,amount);await expect(amount).toBeFocused();await page.keyboard.press('Enter');
  const inspector=page.locator('#evidence-inspector'),source=inspector.getByRole('link',{name:'Open source ev-0035',exact:true});await tabTo(page,source);await page.keyboard.press('Enter');
  await expect(inspector.locator('.printed-selection')).toContainText('107,800.00');
  const document=inspector.getByRole('link',{name:'Open D09 document',exact:true});await tabTo(page,document);await page.keyboard.press('Enter');
  const field=page.getByTestId('printed-field-ev-0035');await tabTo(page,field);await page.keyboard.press('Enter');
  const usage=page.getByRole('region',{name:'Tax line usage',exact:true}).getByRole('link',{name:'Open return line F1040.1a',exact:true});await tabTo(page,usage);await expect(usage).toContainText('212,400');await page.keyboard.press('Enter');
  await expect(inspector.locator('.inspector-amount')).toHaveText('$212,400');
});

test('requested source text appears before extraction metadata and duplicate field grids stay collapsed',async({page})=>{
  await enter(page,'st-04');await page.goto(`${base}/return?ref=ev-0016&line=F1040.1a`);
  const inspector=page.locator('#evidence-inspector');
  expect(await inspector.locator('.inspector-source').evaluate(el=>Boolean(el.compareDocumentPosition(document.querySelector('.extraction-reading')!)&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await expect(inspector.locator('.source-readings')).not.toHaveAttribute('open');await expect(inspector.getByTestId('printed-field-ev-0016')).toContainText('104,600.00');
});
