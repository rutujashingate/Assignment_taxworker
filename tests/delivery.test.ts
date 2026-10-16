import { beforeAll,expect,test } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { setupDatabase,actor } from './helpers';
import { pool } from '../src/lib/db/client';
import { packetSchema,PACKET_SHA256,type Packet } from '../src/lib/packet/schema';
import { createEvidenceIndex } from '../src/lib/evidence/resolver';
import { documentView } from '../src/lib/evidence/queries';
import { buildFindingsReport,renderFindingsMarkdown } from '../src/lib/delivery/findings';
import { renderRequirementsAudit } from '../src/lib/delivery/requirements';
import { COVERAGE } from '../src/lib/records/coverage';
import { DELIVERY_ARTIFACTS,FINDING_CODES } from '../src/lib/delivery/catalog';
import { listArtifacts,downloadArtifact } from '../src/lib/delivery/service';
import { getFilings,seasonCommand } from '../src/lib/season/service';
import { readClock } from '../src/lib/season/clock';
let packet:Packet;
beforeAll(async()=>{await setupDatabase();packet=packetSchema.parse(JSON.parse(await readFile('data/okafor_lindqvist_2025_packet.json','utf8')));});
test('report determinism preserves complete check evidence and original packet state',()=>{
  const before=JSON.stringify(packet),report=buildFindingsReport(packet,PACKET_SHA256);
  const permuted=structuredClone(packet);permuted.documents.reverse();permuted.extracted_values.reverse();permuted.return_versions[2].lines.reverse();
  expect(buildFindingsReport(permuted,PACKET_SHA256)).toEqual(report);expect(renderFindingsMarkdown(buildFindingsReport(packet,PACKET_SHA256))).toBe(renderFindingsMarkdown(report));expect(JSON.stringify(packet)).toBe(before);
  expect(report.summary).toEqual({findings:6,confirmedSourceMismatches:4,confirmationOrInformationRequired:2,passingControls:1});
  for(const finding of report.checks){expect(FINDING_CODES).toContain(finding.code);expect(finding.printedEvidence.length).toBeGreaterThan(0);expect(finding.route.startsWith('/engagements/CL-20417/2025/')).toBe(true);expect(finding.screenshot).toBe(`screenshots/findings/${finding.code}.png`);expect(finding.resolution.humanDisposition).toContain('No live human resolution');}
});
test('ambiguity, suspected economic duplication and missing lot remain distinct from proven tax-law errors',()=>{
  const report=buildFindingsReport(packet,PACKET_SHA256),byCode=(code:string)=>report.checks.find(f=>f.code===code)!;
  const gift=byCode('CHARITY_AMOUNT_UNCLEAR');expect(gift).toMatchObject({outcome:'needs_information',certainty:'judgment',expected:{verifiedGiftAmount:null}});expect(gift.printedEvidence[0].printed_content).toContain('$?,500.00');expect(gift.pipelineReadings[0]).toMatchObject({value:1500,confidence:.41});expect(gift.affectedTaxLines.map(l=>l.key)).toContain('SchA.11');
  expect(byCode('INTEREST_SWEEP_OVERLAP')).toMatchObject({outcome:'candidate',certainty:'probable'});
  const missing=byCode('BROKER_PAGE_UNEXTRACTED');expect(missing.pipelineReadings).toEqual([]);expect(missing.affectedTaxLines).toEqual([]);expect(missing.affectedLineLimitation).toContain('No extracted M18 lot');expect(missing.printedEvidence.find(p=>p.documentId==='D31')?.printed_content).toContain('M18');
  expect(byCode('W2_CONTRIBUTION_COUNT').outcome).toBe('pass');
});
test('report masks protected source identifiers and excludes future answers and internal overlays',()=>{
  const report=JSON.stringify(buildFindingsReport(packet,PACKET_SHA256));
  for(const forbidden of ['666-52-9134','666-18-4420','msg-08','msg-09','D71','D72','41207','88310'])expect(report).not.toContain(forbidden);
  expect(report).toContain('[REDACTED');expect(report).toContain('not_corrected_in_original_v3');
});
test('all 199 supplied pages retain complete printed content, including unextracted pages',()=>{
  const index=createEvidenceIndex(packet,'v3','2028-01-26T15:00:00Z');let pages=0,values=0;
  for(const doc of packet.documents)for(const page of doc.pages){const view=documentView(index,doc.id,page.page);expect(view.page.printed_content,`${doc.id}/${page.page}`).toBe(page.printed_content);expect(index.resolve(`doc:${doc.id}#page${page.page}`).status).toBe('resolved');pages++;values+=view.values.length;}
  expect(pages).toBe(199);expect(values).toBe(3012);expect(documentView(index,'D31',32).values).toEqual([]);expect(documentView(index,'D30',32).superseded).toBe(true);
});
test('generated files match current pure findings and every Coverage disposition',async()=>{
  const report=buildFindingsReport(packet,PACKET_SHA256);expect(await readFile('docs/FINDINGS_REPORT.json','utf8')).toBe(JSON.stringify(report,null,2)+'\n');expect(await readFile('docs/FINDINGS_REPORT.md','utf8')).toBe(renderFindingsMarkdown(report));
  const audit=await readFile('docs/REQUIREMENTS_AUDIT.md','utf8');expect(audit).toBe(renderRequirementsAudit(COVERAGE));for(const row of COVERAGE)expect(audit).toContain(`\`${row.id}\``);expect(audit).toContain('not fully met');
});
test('all document downloads require scoped staff authorization before file lookup',async()=>{
  await expect(listArtifacts(await actor('cu-01'))).rejects.toMatchObject({status:403});await expect(downloadArtifact(await actor('cu-02'),'findings')).rejects.toMatchObject({status:403});
  const staff=await actor('st-01');await expect(downloadArtifact({...staff,id:'outside-engagement'},'product')).rejects.toMatchObject({status:403});
  for(const id of ['../../.env','__proto__','constructor','packet.json'])await expect(downloadArtifact(staff,id)).rejects.toMatchObject({status:404});
  const artifacts=await listArtifacts(await actor('st-04'));expect(artifacts.find(a=>a.id==='product')?.available).toBe(true);expect(artifacts.map(a=>a.id).sort()).toEqual(Object.keys(DELIVERY_ARTIFACTS).sort());
});
test('authorized handoff download returns exact masked bytes and a durable audit entry',async()=>{
  const viewer=await actor('st-04');const before=(await pool.query("SELECT count(*)::int n FROM audit_event WHERE action='handoff_artifact_downloaded' AND target='findings-json'")).rows[0].n;
  const artifact=await downloadArtifact(viewer,'findings-json');expect(artifact.bytes.equals(await readFile('docs/FINDINGS_REPORT.json'))).toBe(true);expect(createHash('sha256').update(artifact.bytes).digest('hex')).toBe(artifact.sha256);expect(artifact.type).toBe('application/json');
  expect((await pool.query("SELECT count(*)::int n FROM audit_event WHERE action='handoff_artifact_downloaded' AND target='findings-json'")).rows[0].n).toBe(before+1);
});
test('submission documents contain a compact real model, missing-deployment checklist and human-only video handoff',async()=>{
  const model=await readFile('docs/PRODUCT_AND_DATA_MODEL.md','utf8');expect(model.split(/\s+/u).length).toBeLessThanOrEqual(650);for(const term of ['packet_import','source_document','engine_line','PostgreSQL','signed demo sessions'])expect(model).toContain(term);
  const deploy=await readFile('docs/DEPLOYMENT_HANDOFF.md','utf8');expect(deploy).toContain('NOT DEPLOYED');for(const step of ['DATABASE_URL','npm run db:migrate','npm run db:import','0.0.0.0','remote','personal video'])expect(deploy).toContain(step);
  const video=await readFile('docs/VIDEO_SCRIPT.md','utf8');expect(video).toContain('NOT SUPPLIED');expect(video).toContain('human applicant');expect(video).toContain('10:40');expect(video).not.toMatch(/https?:\/\/(?:youtu\.be|www\.youtube\.com|loom\.com)/u);
});
test('filing creation cannot put the only supplied reviewer or partner into an impossible self-approval role',async()=>{
  const reviewer=await actor('st-02'),clock=await readClock();await seasonCommand(reviewer,'CL-20417',2025,{action:'clock',eventId:'default',expectedRevision:clock.revision});
  expect((await getFilings(await actor('st-01'),'CL-20417',2025)).canCreate).toBe(true);
  expect((await getFilings(reviewer,'CL-20417',2025)).canCreate).toBe(false);
  for(const who of ['st-02','st-03','st-05','cu-01'])await expect(seasonCommand(await actor(who),'CL-20417',2025,{action:'create',parentId:null})).rejects.toMatchObject({status:403});
});
