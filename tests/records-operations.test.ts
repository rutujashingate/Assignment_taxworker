import { beforeAll,expect,test } from 'vitest';
import { and,eq } from 'drizzle-orm';
import { setupDatabase,actor } from './helpers';
import { db } from '../src/lib/db/client';
import { auditEvents,firmStandards,timeEntries } from '../src/lib/db/schema';
import { getRecords,getLotReviews,bulkReviewLots } from '../src/lib/records/queries';
import { buildLots } from '../src/lib/records/models';
import { getEvidenceWorkspace } from '../src/lib/evidence/queries';
import { getStandards,updateStandards,getFirmAdmin,getTime,logTime } from '../src/lib/firm/service';
import { globalSearch } from '../src/lib/firm/search';
import { getCollaboration } from '../src/lib/collaboration/service';
import { getPreferences,updatePreferences } from '../src/lib/workpaper/preferences';
const client='CL-20417',year=2025;
beforeAll(async()=>{await setupDatabase();for(const id of ['st-01','st-02','st-04','st-05']){const a=await actor(id);const p=await getPreferences(a,client,year);if(p.selectedVersion!=='v3')await updatePreferences(a,client,year,{selectedVersion:'v3',expectedRevision:p.revision});}});
async function reviewCommand(keys:string[]) {const records=await getLotReviews(await actor('st-01'),client,year,'v3');return {version:'v3',items:keys.map(key=>({key,expectedRevision:records.find(r=>r.key===key)?.revision??0})),status:'reviewed',reason:'Compared the selected original sale fields during review.'};}
test('atomic bulk review persists provenance and audit without changing engine sources',async()=>{
  const a=await actor('st-01');const index=(await getEvidenceWorkspace(a,client,year)).index;const lots=buildLots(index).filter(l=>l.documentId==='D74');const keys=lots.slice(0,3).map(l=>l.key);const c=await reviewCommand(keys);const original=index.lines.get(keys[0])!.value;
  const saved=await bulkReviewLots(a,client,year,c);expect(saved.filter(r=>keys.includes(r.key)).every(r=>r.status==='reviewed')).toBe(true);
  const reread=await getLotReviews(await actor('st-02'),client,year,'v3');for(const item of c.items)expect(reread.find(r=>r.key===item.key)?.revision).toBe(item.expectedRevision+1);
  expect((await getEvidenceWorkspace(a,client,year)).index.lines.get(keys[0])!.value).toBe(original);
  const [audit]=await db.select().from(auditEvents).where(and(eq(auditEvents.action,'sales_lots_reviewed'),eq(auditEvents.target,'v3'))).orderBy(auditEvents.id);expect(audit).toBeTruthy();
});
test('a stale member rejects the entire batch and competing bulk updates return one safe 409',async()=>{
  const a=await actor('st-01');const keys=buildLots((await getEvidenceWorkspace(a,client,year)).index).filter(l=>l.documentId==='D74').slice(3,5).map(l=>l.key);const command=await reviewCommand(keys);
  const outcomes=await Promise.allSettled([bulkReviewLots(a,client,year,command),bulkReviewLots(await actor('st-02'),client,year,command)]);expect(outcomes.filter(o=>o.status==='fulfilled')).toHaveLength(1);expect(outcomes.find(o=>o.status==='rejected')).toMatchObject({reason:{status:409}});
  const after=await getLotReviews(a,client,year,'v3');await expect(bulkReviewLots(a,client,year,{...command,items:[{key:keys[0],expectedRevision:after.find(r=>r.key===keys[0])!.revision},{key:keys[1],expectedRevision:0}]})).rejects.toMatchObject({status:409});
  expect(await getLotReviews(a,client,year,'v3')).toEqual(after);
});
test('record, bulk and global search permissions reject clients, administrator tax writes and foreign scope',async()=>{
  const clientActor=await actor('cu-01');await expect(getRecords(clientActor,client,year,'basis')).rejects.toMatchObject({status:403});await expect(globalSearch(clientActor,'internal')).rejects.toMatchObject({status:403});
  const c=await reviewCommand(['F8949.D.X1']);for(const id of ['cu-01','st-05','st-06'])await expect(bulkReviewLots(await actor(id),client,year,c)).rejects.toMatchObject({status:403});
  await expect(getRecords(await actor('st-01'),'CL-other',year,'basis')).rejects.toMatchObject({status:403});
  for(const items of [[{key:'F1040.2b',expectedRevision:0}],[...c.items,...c.items]])await expect(bulkReviewLots(await actor('st-01'),client,year,{...c,items})).rejects.toMatchObject({status:400});
  await expect(bulkReviewLots(await actor('st-01'),client,year,{...c,version:'v2'})).rejects.toMatchObject({status:409});
});
test('search is scoped, sensitive identifiers are masked for all roles, and future evidence stays hidden',async()=>{
  const a=await actor('st-01');const index=(await getEvidenceWorkspace(a,client,year)).index;const secret=String(index.values.get('ev-0015')!.value);
  for(const id of ['st-01','st-04']){const person=await actor(id);expect((await globalSearch(person,secret)).total).toBe(0);for(const q of ['D71','D72','msg-08'])expect((await globalSearch(person,q)).rows.some(r=>r.ref===q)).toBe(false);}
  expect((await globalSearch(a,'Okafor','engagement')).rows).toHaveLength(1);const amounts=await globalSearch(a,'$1,840','amount');expect(amounts.rows.some(r=>r.ref==='ev-0492')).toBe(true);expect(amounts.rows.some(r=>r.ref==='ev-0538')).toBe(true);
  const lots=await globalSearch(a,'X260','lot');expect(lots.rows).toHaveLength(1);expect(lots.rows[0].href).toContain('/records/sales?lot=');
});
test('firm standards are administrator-only, revision checked, persistent and affect variance flags',async()=>{
  const admin=await actor('st-05');const original=await getStandards(admin);const command={expectedRevision:original.revision,variancePercent:1000,varianceAmount:1e9,requiredSteps:original.record.required_steps,rules:original.record.rules};
  for(const id of ['st-01','cu-01'])await expect(updateStandards(await actor(id),command)).rejects.toMatchObject({status:403});
  try{const saved=await updateStandards(admin,command);expect(saved.revision).toBe(original.revision+1);expect((await getStandards(admin)).record.variance_review.and_over_amount).toBe(1e9);
    await expect(updateStandards(admin,command)).rejects.toMatchObject({status:409});expect((await getRecords(await actor('st-01'),client,year,'comparison')).model.comparisons.every(r=>!r.flagged)).toBe(true);
    const row=(await db.select().from(firmStandards))[0];expect(row.record).toMatchObject({variance_review:{and_over_amount:1e9}});
  }finally{const current=await getStandards(admin);await updateStandards(admin,{expectedRevision:current.revision,variancePercent:original.record.variance_review.flag_if_change_over_percent,varianceAmount:original.record.variance_review.and_over_amount,requiredSteps:original.record.required_steps,rules:original.record.rules});}
});
test('manual actual time persists separately from budget; staff see own entries and only admin sees totals',async()=>{
  const prep=await actor('st-01');const reviewer=await actor('st-02');const before=await getTime(prep,client,year);const old=before.categories.find(c=>c.category==='business')!.loggedMinutes;
  const saved=await logTime(prep,client,year,{category:'business',minutes:17,workedOn:'2026-06-23',note:'Reviewed supplied Schedule C receipt provenance.'});
  const after=await getTime(prep,client,year);expect(after.categories.find(c=>c.category==='business')!.loggedMinutes).toBe(old+17);expect(after.budget.business).toBe(3.5);expect((await getTime(reviewer,client,year)).entries.some(e=>e.id===saved.id)).toBe(false);
  expect((await getTime(await actor('st-05'),client,year,true)).entries.some(e=>e.id===saved.id)).toBe(true);await expect(getTime(prep,client,year,true)).rejects.toMatchObject({status:403});await expect(logTime(await actor('cu-01'),client,year,{})).rejects.toMatchObject({status:403});
  await expect(logTime(prep,client,year,{category:'invented',minutes:20,workedOn:'2026-06-23',note:'Invalid budget category.'})).rejects.toMatchObject({status:400});
  await expect(db.update(timeEntries).set({minutes:99}).where(eq(timeEntries.id,saved.id))).rejects.toThrow();
});
test('admin access log serialization excludes all before/after payloads and private text',async()=>{
  for(const id of ['st-01','st-03','cu-01'])await expect(getFirmAdmin(await actor(id))).rejects.toMatchObject({status:403});
  const admin=await getFirmAdmin(await actor('st-05'),{action:'sensitive_value_revealed'});for(const row of admin.access.rows){expect(Object.keys(row).sort()).toEqual(['action','actorId','createdAt','id','name','target']);}
  expect(JSON.stringify(admin.access)).not.toMatch(/beforeJson|afterJson|signingKey|rawBytes|rawJson/);expect(admin.time.categories).toHaveLength(9);
});
test('lot review changes the staff live cursor without leaking internal activity to a client',async()=>{
  const prep=await actor('st-01');const clientActor=await actor('cu-01');const beforeClient=(await getCollaboration(clientActor,client,year)).cursor;const beforeStaff=(await getCollaboration(prep,client,year)).cursor;
  await bulkReviewLots(prep,client,year,await reviewCommand(['F8949.D.X1']));expect((await getCollaboration(prep,client,year)).cursor).not.toBe(beforeStaff);expect((await getCollaboration(clientActor,client,year)).cursor).toBe(beforeClient);
});
