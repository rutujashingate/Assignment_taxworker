import { test, expect, type Page } from "@playwright/test";
import type { IssueView } from "../../src/lib/review/types";

const base="/engagements/CL-20417/2025",api="/api/engagements/CL-20417/2025";
const interest="INTEREST_SWEEP_OVERLAP:D28+D29";
async function enter(page:Page,id="st-01") {
  await page.goto("/firm");await page.getByLabel("Demo identity").selectOption(id);
  await expect(page.getByRole("heading",{name:"Engagements",exact:true})).toBeVisible();
  await page.getByRole("link",{name:"Open workpaper",exact:true}).click();
  const picker=page.getByLabel("Computed version");
  if(await picker.inputValue()!=="v3"){await picker.selectOption("v3");await expect(page.getByRole("status").filter({hasText:"Saved · revision"})).toBeVisible();}
  await page.goto(`${base}/review?issue=${encodeURIComponent(interest)}`);
  await expect(page.getByRole("heading",{name:"Review Desk",exact:true})).toBeVisible();
}
async function getIssue(page:Page,key=interest):Promise<IssueView> {
  const response=await page.request.get(`${api}/issues`);expect(response.status()).toBe(200);
  return (await response.json()).issues.find((issue:IssueView)=>issue.key===key);
}
function body(issue:IssueView) {return {version:issue.version,status:issue.status,assigneeId:issue.assigneeId,note:issue.note,evidenceRefs:issue.evidenceRefs,expectedRevision:issue.revision};}
test("independent findings open source evidence beside the queue and retain uncertainty",async({page})=>{
  await enter(page);
  const queue=page.getByRole("region",{name:"Independent issue queue",exact:true});
  await expect(queue.locator("li")).toHaveCount(6);
  await expect(page.locator("#selected-finding")).toContainText("candidate · certainty: probable");
  await page.getByRole("link",{name:"Inspect issue evidence ev-0538",exact:true}).click();
  await expect(page.locator(".inspector-ref")).toHaveText("ev-0538");
  await expect(page.getByTestId("printed-field-ev-0538")).toContainText("Box 1 interest income 1,840.00");
  await expect(queue).toBeVisible();expect(new URL(page.url()).pathname).toBe(`${base}/review`);
  await queue.getByRole("link",{name:"Select issue MILEAGE_DUPLICATE_PAGES",exact:true}).click();
  await expect(page.locator("#selected-finding")).toContainText("11,800");await expect(page.locator("#selected-finding")).toContainText("8,100");
  await queue.getByRole("link",{name:"Select issue CHARITY_AMOUNT_UNCLEAR",exact:true}).click();
  await expect(page.locator("#selected-finding")).toContainText("needs information · certainty: judgment");
  await expect(page.getByTestId("printed-content")).toContainText("$?,500.00");
  await expect(page.getByLabel("Review state").locator('option[value="resolved_with_evidence"]')).toBeDisabled();
  const data=await (await page.request.get(`${api}/issues`)).json();
  expect(data.checks.find((check:{code:string})=>check.code==="W2_CONTRIBUTION_COUNT").outcome).toBe("pass");expect(data.diagnostics).toHaveLength(11);
  await expect(queue.getByText(/LOW_CONFIDENCE_READ/)).toHaveCount(0);
});
test("triage survives reload and another reviewer; all four filters work",async({page})=>{
  await enter(page);const original=await getIssue(page);
  const form=page.getByRole("form",{name:"Issue triage",exact:true});
  await form.getByLabel("Review state").selectOption("investigating");await form.getByLabel("Assignee",{exact:true}).selectOption("st-02");
  await form.getByLabel("Disposition / waiting reason").fill("Comparing both printed sweep records in browser review.");
  for(const ref of ["ev-0492","ev-0538"])await form.locator(`input[name="evidenceRefs"][value="${ref}"]`).check();
  await form.getByRole("button",{name:"Save triage",exact:true}).click();
  await expect(page.getByRole("status",{name:"Triage save status"})).toHaveText(`Triage stored · revision ${original.revision+1}`);
  await page.reload();await expect(page.getByLabel("Review state")).toHaveValue("investigating");
  await enter(page,"st-02");await expect(page.getByLabel("Disposition / waiting reason")).toHaveValue("Comparing both printed sweep records in browser review.");
  const filters=page.getByRole("form",{name:"Issue filters",exact:true});
  await filters.getByLabel("Status",{exact:true}).selectOption("investigating");await filters.getByLabel("Blocker",{exact:true}).selectOption("blocking");await filters.getByLabel("Tax area",{exact:true}).selectOption("interest");await filters.getByLabel("Assignee",{exact:true}).selectOption("st-02");
  await filters.getByRole("button",{name:"Filter issues",exact:true}).click();
  await expect(page.getByRole("region",{name:"Independent issue queue"}).locator("li")).toHaveCount(1);
  await page.getByRole("form",{name:"Issue filters"}).getByLabel("Assignee",{exact:true}).selectOption("unassigned");await page.getByRole("button",{name:"Filter issues",exact:true}).click();
  await expect(page.getByRole("heading",{name:"No findings match these filters"})).toBeVisible();
  const current=await getIssue(page);const restored=await page.request.post(`${api}/issues/${encodeURIComponent(interest)}`,{data:{...body(original),expectedRevision:current.revision}});expect(restored.status()).toBe(200);
});
test("source-backed closure, stale updates and forbidden issue access are enforced",async({page})=>{
  await enter(page);const current=await getIssue(page);
  const endpoint=`${api}/issues/${encodeURIComponent(interest)}`;
  expect((await page.request.post(endpoint,{data:{...body(current),status:"resolved_with_evidence",note:"Resolved from a computed amount alone.",evidenceRefs:["F1040.2b"]}})).status()).toBe(400);
  expect((await page.request.post(endpoint,{data:{...body(current),status:"resolved_with_evidence",note:"Future confirmation cannot be used.",evidenceRefs:["msg-08"]}})).status()).toBe(400);
  const gift=await getIssue(page,"CHARITY_AMOUNT_UNCLEAR:D64");
  expect((await page.request.post(`${api}/issues/${encodeURIComponent(gift.key)}`,{data:{...body(gift),status:"resolved_with_evidence",note:"The extraction is assumed correct.",evidenceRefs:["ev-1049"]}})).status()).toBe(400);
  const responses=await Promise.all(["Window A","Window B"].map(name=>page.request.post(endpoint,{data:{...body(current),status:"investigating",note:`${name} review at revision ${current.revision}.`}})));
  expect(responses.map(response=>response.status()).sort()).toEqual([200,409]);
  await page.getByLabel("Demo identity").selectOption("cu-01");await expect(page.getByRole("heading",{name:"Questions, tasks & approvals"})).toBeVisible();
  expect((await page.request.get(`${api}/issues`)).status()).toBe(403);expect((await page.request.post(endpoint,{data:body(current)})).status()).toBe(403);
  await page.goto(`${base}/review`);await expect(page.getByRole("heading",{name:"Staff workspace",exact:true})).toBeVisible();expect(await page.content()).not.toMatch(/Window A|Window B|CARD_RECEIPTS_OVERLAP/);
});
test("triage posts persist without page JavaScript",async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false});const page=await context.newPage();
  try{
    await page.goto("/firm");await page.getByRole("button",{name:"Open workspace",exact:true}).click();
    const preference=await (await page.request.get(`${api}/preferences`)).json();if(preference.selectedVersion!=="v3")await page.request.post(`${api}/preferences`,{data:{selectedVersion:"v3",expectedRevision:preference.revision}});
    await page.goto(`${base}/review?issue=${encodeURIComponent(interest)}`);const original=await getIssue(page);
    const form=page.getByRole("form",{name:"Issue triage",exact:true});await form.getByLabel("Review state").selectOption("investigating");await form.getByLabel("Disposition / waiting reason").fill("Native form review of the source records.");
    await form.getByRole("button",{name:"Save triage",exact:true}).click();
    await expect(page.getByLabel("Review state")).toHaveValue("investigating");expect((await getIssue(page)).note).toBe("Native form review of the source records.");
    const current=await getIssue(page);expect((await page.request.post(`${api}/issues/${encodeURIComponent(interest)}`,{data:{...body(original),expectedRevision:current.revision}})).status()).toBe(200);
  }finally{await context.close();}
});
test("mobile queue and inspector support keyboard source access",async({page})=>{
  await enter(page);await page.setViewportSize({width:390,height:844});
  const evidence=page.getByRole("link",{name:"Inspect issue evidence ev-0538",exact:true});await evidence.focus();await page.keyboard.press("Enter");
  await expect(page.locator(".inspector-ref")).toHaveText("ev-0538");expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:"test-results/phase3-mobile-review.png",fullPage:true});
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:"test-results/phase3-desktop-review.png",fullPage:true});
});
