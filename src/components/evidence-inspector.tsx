import Link from "next/link";
import type { DisplayTrace, EvidenceInspection } from "@/lib/evidence/queries";
import { documentHref, evidenceHref, displayValue, lineValue, referenceLabel } from "@/lib/evidence/format";
import { DocumentPage } from "./document-page";
import { isSensitiveValue } from "@/lib/evidence/privacy";
import { SensitiveReveal } from "./sensitive-reveal";
import { ReadableRecord } from "./readable-record";

function TraceBranch({ trace, href, depth = 0 }: { trace: DisplayTrace; href: (ref: string) => string; depth?: number }) {
  const label = <Link prefetch={false} href={href(trace.node.ref)} aria-label={`Trace ${trace.node.ref}`}><code>{trace.node.ref}</code>{trace.node.value !== null && <strong className="trace-value">{trace.node.kind === "line" ? lineValue(trace.node) : displayValue(trace.node.value, trace.node.valueType === "money")}</strong>}</Link>;
  return <li>{trace.children.length ? <details open={depth < 5}><summary>{label}</summary><span className="trace-label">{trace.node.label}</span><ul>{trace.children.map((child, i) => <TraceBranch key={`${child.node.ref}-${i}`} trace={child} href={href} depth={depth+1}/>)}</ul></details> : <><div className="trace-leaf">{label}</div><span className="trace-label">{trace.node.label}</span></>}
    {trace.node.status !== "resolved" && <span className="missing-ref">{trace.node.status === "missing_source" ? "Missing source" : "Invalid reference"} · {trace.node.ref}</span>}
    {trace.cycle && <span className="missing-ref">Cycle detected; this branch stops here.</span>}
    {trace.truncated && <span className="trace-limit">Trace display limit reached. Open this reference to continue.</span>}
  </li>;
}

export function EvidenceInspector({ inspection, base, selectedLine, masked, includeDocument = true, referenceHref, compact=false, closeHref }: {
  inspection: EvidenceInspection; base: string; selectedLine?: string; masked: boolean; includeDocument?: boolean; referenceHref?: (ref: string) => string; compact?:boolean; closeHref?:string;
}) {
  const href = referenceHref ?? ((ref: string) => evidenceHref(base, ref, selectedLine));
  const { node, extraction, line, source } = inspection;
  const choices=new Map(inspection.trace.children.map(child=>[child.node.ref,child.node]));
  function referenceChoice(ref:string){
    const choice=choices.get(ref);
    return <><span className="reference-choice-label">{choice?referenceLabel(ref,choice.label):'Open linked record'}<small className="line-description">{ref}</small></span><strong className="reference-choice-value">{choice?.value!==null&&choice?.value!==undefined?(choice.kind==='line'?lineValue(choice):displayValue(choice.value,choice.valueType==='money')):'Open record'} <span aria-hidden="true">→</span></strong></>;
  }
  return <aside id="evidence-inspector" className="panel evidence-inspector" aria-labelledby="inspector-heading" tabIndex={-1}>
    {closeHref&&<Link prefetch={false} className="close-evidence text-button" href={closeHref}>Close evidence and return to issue</Link>}
    {selectedLine&&node.ref!==selectedLine&&<Link prefetch={false} className="close-evidence text-button" href={href(selectedLine)} aria-label={`Back to selected return line ${selectedLine}`}>← Back to return amount · {selectedLine}</Link>}
    <header className="inspector-heading"><span className="eyebrow">{compact?'SUPPORTING EVIDENCE':'SOURCE & CALCULATION'}</span><h2 id="inspector-heading">{compact?'Source evidence':'Evidence Inspector'}</h2><code className="inspector-ref">{node.ref}</code><p>{referenceLabel(node.ref,node.label)}</p>{compact&&extraction&&<p>Extracted reading: {isSensitiveValue(extraction)?'[PROTECTED IDENTIFIER]':displayValue(extraction.value,extraction.value_type==='money')} · {Math.round(extraction.confidence*100)}% confidence · Human verification not recorded</p>}</header>
    {compact&&includeDocument&&source&&<section className="inspector-section inspector-source"><div className="section-heading inline-heading"><h3>Printed source</h3><Link prefetch={false} className="text-button" href={documentHref(base,source.id,source.page.page,extraction?.id)}>Open {source.id} document</Link></div><DocumentPage document={source} selectedField={extraction?.id} fieldHref={href} masked={masked} compact/></section>}
    {compact&&inspection.record!==undefined&&<section className="inspector-section source-record" aria-label="Source record"><h3>Source record</h3><ReadableRecord value={inspection.record}/></section>}
    <details className={compact?'inspector-advanced':'inspector-full-details'} open={!compact||Boolean(line)}><summary>{compact?'Calculation, extraction & usage details':'Source and calculation details'}</summary>
    {node.status !== "resolved" ? <div className="evidence-gap"><h3>{node.status === "missing_source" ? "Missing source" : "Invalid reference"}</h3><p>The original reference is preserved. No replacement relationship has been invented.</p></div> : <>
      {line && <section className="inspector-section"><span className="field-caption">Original computed value</span><strong className="inspector-amount">{lineValue(line)}</strong><p><code>{line.rule}</code> · {line.ruleDescription}</p>
        <h3>Amounts used in this line</h3>{line.inputs.length ? <><p>Choose an input amount to follow the calculation toward its source.</p><ul className="reference-list reference-choices">{line.inputs.map(ref => <li key={ref}><Link prefetch={false} href={href(ref)} aria-label={`Follow input ${ref}`}>{referenceChoice(ref)}</Link></li>)}</ul></> : <p>This line has no other calculated input lines. Check its linked sources below.</p>}
        <h3>Supporting records</h3>{line.sources.length ? <ul className="reference-list reference-choices">{line.sources.map(ref => <li key={ref}><Link prefetch={false} href={href(ref)} aria-label={`Open source ${ref}`}>{referenceChoice(ref)}</Link></li>)}</ul> : <p>Open an input amount above to continue to its supporting records.</p>}
      </section>}
      {!compact && includeDocument && source && <section className="inspector-section inspector-source"><div className="section-heading inline-heading"><h3>Printed source</h3><Link prefetch={false} className="text-button" href={documentHref(base, source.id, source.page.page, extraction?.id)}>Open {source.id} document</Link></div><DocumentPage document={source} selectedField={extraction?.id} fieldHref={href} masked={masked} compact/></section>}
      {extraction && <section className="inspector-section extraction-reading"><h3>Pipeline reading</h3><strong className="inspector-amount">{isSensitiveValue(extraction) ? "[PROTECTED IDENTIFIER]" : displayValue(extraction.value, extraction.value_type === "money")}</strong><dl><div><dt>Field</dt><dd>{String(extraction.label ?? extraction.field)}</dd></div><div><dt>Text as read</dt><dd>{isSensitiveValue(extraction) ? "[PROTECTED IDENTIFIER]" : String(extraction.text_as_read ?? "—")}</dd></div><div><dt>Confidence</dt><dd>{Math.round(extraction.confidence*100)}%</dd></div><div><dt>Source</dt><dd>{extraction.document_id} · page {extraction.page}</dd></div><div><dt>Human verification</dt><dd>Not recorded</dd></div></dl><p className="fine-print">Verification actions are not implemented. Pipeline confidence is not a CPA sign-off.</p>{isSensitiveValue(extraction) && !masked && <SensitiveReveal base={base} reference={extraction.id}/>}</section>}
      {!compact&&inspection.record !== undefined && <section className="inspector-section source-record" aria-label="Source record"><h3>Referenced record</h3><ReadableRecord value={inspection.record}/></section>}
    </>}
    <section className="inspector-section"><h3>Dependency trace</h3><p>Inputs and sources from the selected computed version. Open any reference to inspect it.</p><ul className="trace-tree"><TraceBranch trace={inspection.trace} href={href}/></ul></section>
    <section className="inspector-section" aria-label="Tax line usage"><h3>Tax line usage <span className="count-tag">{inspection.usage.length}</span></h3><p>Where this record is used. Select a return amount to trace it.</p>{inspection.usage.length ? <ul className="usage-list">{inspection.usage.map(item => <li key={item.key}><Link prefetch={false} href={evidenceHref(base, item.key, item.key)} aria-label={`Open return line ${item.key}`}><code>{item.key}</code><strong className="usage-amount">{lineValue(item)}</strong><span>{item.label}</span></Link><span className="usage-kind">{item.direct ? "Direct" : "Downstream"}</span></li>)}</ul> : <p className="empty-usage">No computed line usage recorded for this exact reference. A missing page extraction does not establish a tax-line link.</p>}</section>
    </details>
  </aside>;
}
