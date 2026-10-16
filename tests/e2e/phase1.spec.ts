import { test, expect } from "@playwright/test";

const endpoint = "/api/engagements/CL-20417/2025/preferences";
test("entry and every primary navigation link work without page JavaScript", async ({ browser }) => {
  const context = await browser.newContext({javaScriptEnabled:false});
  const page = await context.newPage();
  try {
    await page.goto("/firm");
    await page.getByRole("button",{name:"Open workspace",exact:true}).click();
    await expect(page.getByRole("heading",{name:"Engagements",exact:true})).toBeVisible();
    const cookie = (await context.cookies()).find(value => value.name === "miraflores_demo");
    expect(cookie?.httpOnly).toBe(true);
    await page.getByRole("searchbox").fill("CL-20417");
    await page.getByRole("button",{name:"Search",exact:true}).click();
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page.getByRole("link",{name:"Open workpaper"}).click();
    await expect(page.getByText("Packet import details",{exact:true})).toBeVisible();
    for (const [link, heading] of [["Tax Return","Tax Return"],["Documents","Documents"],["Tasks & Approvals","Tasks & Approvals"],["History","History & Scenarios"],["Review","Review"]]) {
      await page.getByRole("navigation",{name:"Engagement"}).getByRole("link",{name:link,exact:true}).click();
      await expect(page.getByRole("heading",{name:heading,exact:true})).toBeVisible();
    }
    await page.getByRole("link",{name:"Workspace",exact:true}).click();
    await expect(page.getByRole("heading",{name:"Engagements",exact:true})).toBeVisible();
    await page.getByLabel("Demo identity").selectOption("cu-01");
    await page.getByRole("button",{name:"Switch identity",exact:true}).click();
    await expect(page.getByRole("heading",{name:"Questions, tasks & approvals",exact:true})).toBeVisible();
    expect((await page.request.get("/api/engagements")).status()).toBe(403);
  } finally { await context.close(); }
});
test("native identity forms reject cross-origin, extra, duplicate, and future identities", async ({ request }) => {
  expect((await request.post("/api/demo-session",{form:{identityId:"st-01"},headers:{Origin:"https://example.com"},maxRedirects:0})).status()).toBe(403);
  expect((await request.post("/api/demo-session",{form:{identityId:"st-01",role:"partner"},maxRedirects:0})).status()).toBe(400);
  expect((await request.post("/api/demo-session",{data:"identityId=st-01&identityId=st-03",headers:{"Content-Type":"application/x-www-form-urlencoded"},maxRedirects:0})).status()).toBe(400);
  expect((await request.post("/api/demo-session",{form:{identityId:"st-06"},maxRedirects:0})).status()).toBe(403);
});
test("find the household, save version, reload, and retain session in a new context", async ({ page, browser }) => {
  await page.goto("/firm");
  await expect(page.getByLabel("Start as")).toHaveValue("st-01");
  await page.screenshot({path:"test-results/phase1-welcome.png",fullPage:true});
  await page.getByRole("button",{name:"Open workspace",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Engagements",exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:"Open workpaper"})).toBeVisible();
  await page.screenshot({path:"test-results/phase1-desktop.png",fullPage:true});
  await page.getByRole("searchbox",{name:"Search engagements"}).fill("Okafor");
  await page.getByRole("button",{name:"Search",exact:true}).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("link",{name:"Open Okafor–Lindqvist"}).click();
  await expect(page.getByRole("heading",{name:"Review",exact:true})).toBeVisible();
  const overview = page.getByRole("region",{name:"Review",exact:true});
  await page.getByText("Packet import details",{exact:true}).click();
  await expect(overview.getByText("74",{exact:true})).toBeVisible();
  await expect(overview.getByText("199",{exact:true})).toBeVisible();
  await expect(overview.getByText("3,012",{exact:true})).toBeVisible();
  await expect(overview.getByText("ee01f8508bd2fd9854754b82fd9c4a055bdc55e2778a132002a25381c412ad19",{exact:true})).toBeVisible();
  await page.screenshot({path:"test-results/phase1-overview.png",fullPage:true});
  await page.locator(".workpaper-data > summary").click();
  const picker = page.getByLabel("Computed version");
  const target = await picker.inputValue() === "v1" ? "v2" : "v1";
  await picker.selectOption(target);
  await expect(page.getByRole("status").filter({hasText:"Saved · revision"})).toBeVisible();
  await page.reload(); await expect(picker).toHaveValue(target);
  const context = await browser.newContext({storageState:await page.context().storageState()});
  const other = await context.newPage(); await other.goto("/engagements/CL-20417/2025/review");
  await expect(other.getByLabel("Computed version")).toHaveValue(target); await context.close();
  await page.getByRole("link",{name:"Engagements",exact:true}).first().click();
  await page.getByRole("searchbox").fill("unknown household"); await page.getByRole("button",{name:"Search",exact:true}).click();
  await expect(page.getByRole("heading",{name:/No engagements match/})).toBeVisible();
});
test("clients cannot call internal APIs or see staff content", async ({ page }) => {
  await page.goto("/firm"); await page.getByLabel("Demo identity").selectOption("cu-01");
  await expect(page.getByRole("heading",{name:"Questions, tasks & approvals"})).toBeVisible();
  await expect(page.getByText("You are viewing the client workspace.",{exact:true})).toBeVisible();
  expect((await page.request.get("/api/engagements?q=Okafor")).status()).toBe(403);
  expect((await page.request.get(endpoint)).status()).toBe(403);
  expect((await page.request.post(endpoint,{data:{selectedVersion:"v1",expectedRevision:0}})).status()).toBe(403);
  await page.goto("/engagements/CL-20417/2025/return");
  await expect(page.getByRole("heading",{name:"Staff workspace"})).toBeVisible();
  await expect(page.getByLabel("Computed version")).toHaveCount(0);
  const html = await page.content(); expect(html).not.toMatch(/ev-0492|signing_key|raw_json|ip_pin|msg-08/);
  await page.goto("/engagements/CL-20417/2025/review");
  await expect(page.getByRole("heading",{name:"Staff workspace"})).toBeVisible();
  await expect(page.getByText("Packet import details",{exact:true})).toHaveCount(0);
  expect(await page.content()).not.toContain("ee01f8508bd2fd9854754b82fd9c4a055bdc55e2778a132002a25381c412ad19");
});
test("signed sessions keep database preferences across identity changes", async ({ page, request }) => {
  await page.goto("/firm");
  await page.getByLabel("Demo identity").selectOption("st-03");
  await expect(page.getByRole("heading",{name:"Engagements",exact:true})).toBeVisible();

  const originalSession = (await page.context().cookies()).find(cookie => cookie.name === "miraflores_demo");
  expect(originalSession).toBeDefined();
  expect(originalSession?.httpOnly).toBe(true);
  expect(originalSession?.sameSite).toBe("Strict");
  expect(await page.evaluate(() => document.cookie.includes("miraflores_demo"))).toBe(false);

  await page.getByRole("link",{name:"Open workpaper"}).click();
  await page.locator(".workpaper-data > summary").click();
  const picker = page.getByLabel("Computed version");
  const target = await picker.inputValue() === "v1" ? "v2" : "v1";
  await picker.selectOption(target);
  await expect(page.getByRole("status").filter({hasText:"Saved · revision"})).toBeVisible();

  await page.getByLabel("Demo identity").selectOption("cu-02");
  await expect(page.getByRole("heading",{name:"Questions, tasks & approvals"})).toBeVisible();
  expect((await page.request.get(endpoint)).status()).toBe(403);
  expect((await request.get("/api/engagements",{headers:{Cookie:`miraflores_demo=${originalSession!.value}`}})).status()).toBe(401);

  await page.getByLabel("Demo identity").selectOption("st-03");
  await expect(page.getByRole("heading",{name:"Engagements",exact:true})).toBeVisible();
  const newSession = (await page.context().cookies()).find(cookie => cookie.name === "miraflores_demo");
  expect(newSession).toBeDefined();
  expect(newSession?.value === originalSession?.value).toBe(false);
  const saved = await page.request.get(endpoint);
  expect(saved.status()).toBe(200);
  expect((await saved.json()).selectedVersion).toBe(target);

  // Discard browser storage except the signed identity cookie. The viewing
  // preference must still come from PostgreSQL after the page reloads.
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.getByRole("link",{name:"Open Okafor–Lindqvist"}).click();
  await expect(page.getByLabel("Computed version")).toHaveValue(target);
  await page.reload();
  await expect(page.getByLabel("Computed version")).toHaveValue(target);
});
test("anonymous, forged, future, and cross-origin requests are rejected", async ({ request }) => {
  expect((await request.get("/api/engagements")).status()).toBe(401);
  expect((await request.get("/api/engagements",{headers:{Cookie:"miraflores_demo=st-03","X-Role":"partner"}})).status()).toBe(401);
  expect((await request.post("/api/demo-session",{data:{identityId:"st-06"}})).status()).toBe(403);
  expect((await request.post("/api/demo-session",{headers:{Origin:"https://example.com"},data:{identityId:"st-01"}})).status()).toBe(403);
});
test("two windows receive a safe conflict and mobile navigation remains usable", async ({ page }) => {
  await page.goto("/firm"); await page.getByLabel("Demo identity").selectOption("st-02");
  await expect(page.getByRole("heading",{name:"Engagements",exact:true})).toBeVisible();
  const current = await (await page.request.get(endpoint)).json();
  const results = await Promise.all(["v1","v2"].map(selectedVersion => page.request.post(endpoint,{data:{selectedVersion,expectedRevision:current.revision}})));
  expect(results.map(x=>x.status()).sort()).toEqual([200,409]);
  await page.setViewportSize({width:390,height:844});
  await page.goto("/engagements/CL-20417/2025/review");
  await expect(page.getByRole("navigation",{name:"Engagement"})).toBeVisible();
  await expect(page.getByText("Packet import details",{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:"test-results/phase1-overview-mobile.png",fullPage:true});
  await page.getByRole("link",{name:"Documents",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Documents",exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:"test-results/phase1-mobile.png",fullPage:true});
});
