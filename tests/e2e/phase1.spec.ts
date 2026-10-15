import { test, expect } from "@playwright/test";

const endpoint = "/api/engagements/CL-20417/2025/preferences";
test("find the household, save version, reload, and retain session in a new context", async ({ page, browser }) => {
  await page.goto("/firm");
  await page.getByLabel("Demo identity").selectOption("st-01");
  await expect(page.getByRole("heading",{name:"Engagements",exact:true})).toBeVisible();
  await page.screenshot({path:"test-results/phase1-desktop.png",fullPage:true});
  await page.getByRole("searchbox",{name:"Search engagements"}).fill("Okafor");
  await page.getByRole("button",{name:"Search",exact:true}).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("link",{name:"Open Okafor–Lindqvist"}).click();
  await expect(page.getByRole("heading",{name:"Review Desk",exact:true})).toBeVisible();
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
  expect((await page.request.get("/api/engagements?q=Okafor")).status()).toBe(403);
  expect((await page.request.get(endpoint)).status()).toBe(403);
  expect((await page.request.post(endpoint,{data:{selectedVersion:"v1",expectedRevision:0}})).status()).toBe(403);
  await page.goto("/engagements/CL-20417/2025/return");
  await expect(page.getByRole("heading",{name:"Staff workspace"})).toBeVisible();
  await expect(page.getByLabel("Computed version")).toHaveCount(0);
  const html = await page.content(); expect(html).not.toMatch(/ev-0492|signing_key|raw_json|ip_pin|msg-08/);
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

  await page.getByRole("link",{name:"Open Okafor–Lindqvist"}).click();
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
  await page.getByRole("link",{name:"Documents",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Documents",exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:"test-results/phase1-mobile.png",fullPage:true});
});
