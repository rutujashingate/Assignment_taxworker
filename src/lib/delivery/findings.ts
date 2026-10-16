import type { Packet } from '../packet/schema';
import { DEFAULT_AS_OF } from '../packet/schema';
import { createEvidenceIndex } from '../evidence/resolver';
import { createEvidenceRedactor } from '../evidence/privacy';
import { runIndependentChecks } from '../review/checks';

export function buildFindingsReport(packet:Packet,packetHash:string) {
  const index=createEvidenceIndex(packet,'v3',DEFAULT_AS_OF),redact=createEvidenceRedactor(packet);
  const checks=runIndependentChecks(index).map(check=>{
    const pages=new Map<string,{ref:string;documentId:string;page:number;printed_content:string}>();
    const readings=[];const lines=[];
    for(const ref of check.inputRefs){const r=index.resolve(ref);if(r.status!=='resolved')throw new Error(`Finding source does not resolve: ${ref}`);
      if(r.kind==='line')lines.push({key:r.line.key,label:r.line.label,value:r.line.value,rule:r.line.rule,inputs:r.line.inputs,sources:r.line.sources});
      if(r.kind==='extracted_value')readings.push({id:r.extraction.id,documentId:r.extraction.document_id,page:r.extraction.page,field:r.extraction.field,value:r.extraction.value,textAsRead:r.extraction.text_as_read,confidence:r.extraction.confidence,humanVerification:'Not recorded by the immutable packet'});
      const doc=r.kind==='document'?r.document:r.kind==='page'?index.documents.get(r.documentId):r.kind==='extracted_value'?index.documents.get(r.extraction.document_id):undefined;
      const page=r.kind==='page'?r.page:r.kind==='extracted_value'?doc?.pages.find(p=>p.page===r.extraction.page):doc?.pages[0];
      if(doc&&page){const key=`doc:${doc.id}#page${page.page}`;pages.set(key,{ref:key,documentId:doc.id,page:page.page,printed_content:page.printed_content});}
    }
    const route=`/engagements/CL-20417/2025/${check.outcome==='pass'?'return?ref=F1040.1a&line=F1040.1a':`review?issue=${encodeURIComponent(check.key)}&ref=${encodeURIComponent(check.action.ref)}`}`;
    return {...check,affectedTaxLines:lines.sort((a,b)=>a.key.localeCompare(b.key)),
      affectedLineLimitation:lines.length?null:'No extracted M18 lot or exact computed tax-line relationship exists. This is a Schedule D / Form 8949 completeness gap, not an invented return line.',
      printedEvidence:[...pages.values()].sort((a,b)=>a.ref.localeCompare(b.ref)),pipelineReadings:readings.sort((a,b)=>a.id.localeCompare(b.id)),
      resolution:{state:check.outcome==='pass'?'passing_control':'not_corrected_in_original_v3',nextAction:check.action.label,
        humanDisposition:'Packet-only report. No live human resolution or corrected liability is asserted; open the route for current triage.',
        uncertainty:check.certainty==='certain'?'Source/calculation fact only; no tax-law conclusion or engine rerun.':'CPA confirmation or additional dated evidence is required.'},
      route,screenshot:`screenshots/findings/${check.code}.png`};
  });
  return redact({reportVersion:1,clientId:'CL-20417',taxYear:2025,packetSha256:packetHash,asOf:DEFAULT_AS_OF,engineVersion:'v3',
    scope:'Deterministic supplied-packet facts only. Printed evidence, extraction, original engine output and human decisions are separate. No tax engine rerun or tax-law adjudication.',
    summary:{findings:checks.filter(c=>c.outcome!=='pass').length,confirmedSourceMismatches:checks.filter(c=>c.outcome==='confirmed_mismatch').length,
      confirmationOrInformationRequired:checks.filter(c=>['candidate','needs_information'].includes(c.outcome)).length,passingControls:checks.filter(c=>c.outcome==='pass').length},checks});
}
export function renderFindingsMarkdown(report:ReturnType<typeof buildFindingsReport>) {
  const json=(v:unknown)=>'```json\n'+JSON.stringify(v,null,2)+'\n```';
  return `# Errors found and uncertainties requiring review\n\nClient **${report.clientId}**, 2025 · original **v3** · source clock **${report.asOf}**.\n\nPacket SHA-256: \`${report.packetSha256}\`.\n\n${report.scope}\n\n**${report.summary.confirmedSourceMismatches} confirmed source/calculation mismatches, ${report.summary.confirmationOrInformationRequired} unresolved candidates or ambiguities, and ${report.summary.passingControls} passing negative control.** These are not six proven tax-law errors. Source-only resolution labels do not replace live triage. All screenshots use a staff identity without sensitive-data clearance.\n\n`+
    report.checks.map(c=>`## ${c.code} — ${c.title}\n\n- Finding ID: \`${c.key}\`; rule/check version: \`${c.version}\`; engine rules: ${c.affectedTaxLines.map(l=>`\`${l.rule}\``).join(', ')||'No exact computed lot rule exists'}.\n- Outcome: **${c.outcome}**; certainty: **${c.certainty}**; severity: **${c.severity}**.\n- Affected tax line(s): ${c.affectedTaxLines.map(l=>`\`${l.key}\` (${l.label}: ${String(l.value)})`).join('; ')||c.affectedLineLimitation}.\n- Resolution: **${c.resolution.state}**. ${c.resolution.humanDisposition}\n- Next action: ${c.resolution.nextAction}. ${c.resolution.uncertainty}\n- [Open workpaper route](${c.route}) · [Actual UI screenshot](${c.screenshot})\n\n${c.explanation}\n\n### Observed versus reconciliation target\n\n${json({observed:c.observed,expected:c.expected})}\n\n### Original engine references\n\n${json(c.affectedTaxLines)}\n\n### Separate pipeline readings\n\n${json(c.pipelineReadings)}\n\n### Printed evidence, with identifiers masked\n\n${c.printedEvidence.map(p=>`**${p.ref}**\n\n> ${p.printed_content.replaceAll('\n','\n> ')}\n`).join('\n')}\n### Verifiable input references\n\n${c.inputRefs.map(r=>`\`${r}\``).join(' · ')}\n`).join('\n')+
    '\n## Reproduction and demonstration\n\nRun `npm run findings:generate -- --canonical` to read the committed original only after checking its exact SHA-256, or pass `--packet /absolute/path/to/the/original.json`. `npm run findings:check` compares both generated files byte for byte without rewriting them. The same pure reconciliations power Review Desk. `tests/e2e/phase8.spec.ts` opens each real finding, checks the source text, and creates the linked screenshots; the W-2 screenshot is explicitly a passing control. No database dispositions, current clock, wall-clock timestamp, or random IDs enter this report. The original JSON is never modified.\n';
}
