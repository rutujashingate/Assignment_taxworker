import Link from "next/link";
import type { DisplayTrace, EvidenceInspection } from "@/lib/evidence/queries";
import { documentHref, evidenceHref, displayValue, lineValue } from "@/lib/evidence/format";
import { DocumentPage } from "./document-page";

function TraceBranch({ trace, href, depth = 0 }: { trace: DisplayTrace; href: (ref: string) => string; depth?: number }) {
  const label = <><Link prefetch={false} href={href(trace.node.ref)} aria-label={`Trace ${trace.node.ref}`}><code>{trace.node.ref}</code></Link>{trace.node.value !== null && <span className="trace-value">{trace.node.kind === "line" ? lineValue(trace.node) : displayValue(trace.node.value, trace.node.valueType === "money")}</span>}</>;
  return <li>{trace.children.length ? <details open={depth < 5}><summary>{label}</summary><span className="trace-label">{trace.node.label}</span><ul>{trace.children.map((child, i) => <TraceBranch key={`${child.node.ref}-${i}`} trace={child} href={href} depth={depth+1}/>)}</ul></details> : <><div className="trace-leaf">{label}</div><span className="trace-label">{trace.node.label}</span></>}
    {trace.node.status !== "resolved" && <span className="missing-ref">{trace.node.status === "missing_source" ? "Missing source" : "Invalid reference"} · {trace.node.ref}</span>}
    {trace.cycle && <span className="missing-ref">Cycle detected; this branch stops here.</span>}
    {trace.truncated && <span className="trace-limit">Trace display limit reached. Open this reference to continue.</span>}
  </li>;
}

export function EvidenceInspector({ inspection, base, selectedLine, masked, includeDocument = true, referenceHref }: {
  inspection: EvidenceInspection; base: string; selectedLine?: string; masked: boolean; includeDocument?: boolean; referenceHref?: (ref: string) => string;
}) {
  const href = referenceHref ?? ((ref: string) => evidenceHref(base, ref, selectedLine));
  const { node, extraction, line, source } = inspection;
  return <aside id="evidence-inspector" className="panel evidence-inspector" aria-labelledby="inspector-heading" tabIndex={-1}>
    <header className="inspector-heading"><span className="eyebrow">SOURCE & CALCULATION</span><h2 id="inspector-heading">Evidence Inspector</h2><code className="inspector-ref">{node.ref}</code><p>{node.label}</p></header>
    {node.status !== "resolved" ? <div className="evidence-gap"><h3>{node.status === "missing_source" ? "Missing source" : "Invalid reference"}</h3><p>The original reference is preserved. No replacement relationship has been invented.</p></div> : <>
      {line && <section className="inspector-section"><span className="field-caption">Original computed value</span><strong className="inspector-amount">{lineValue(line)}</strong><p><code>{line.rule}</code> · {line.ruleDescription}</p>
        <h3>Direct inputs</h3>{line.inputs.length ? <ul className="reference-list">{line.inputs.map(ref => <li key={ref}><Link prefetch={false} href={href(ref)} aria-label={`Follow input ${ref}`}>{ref} <span aria-hidden="true">→</span></Link></li>)}</ul> : <p>No calculated input lines.</p>}
        <h3>Source references</h3>{line.sources.length ? <ul className="reference-list">{line.sources.map(ref => <li key={ref}><Link prefetch={false} href={href(ref)} aria-label={`Open source ${ref}`}>{ref} <span aria-hidden="true">→</span></Link></li>)}</ul> : <p>Evidence is reached through the input lines above.</p>}
      </section>}
      {extraction && <section className="inspector-section extraction-reading"><h3>Pipeline reading</h3><strong className="inspector-amount">{displayValue(extraction.value, extraction.value_type === "money")}</strong><dl><div><dt>Field</dt><dd>{String(extraction.label ?? extraction.field)}</dd></div><div><dt>Text as read</dt><dd>{String(extraction.text_as_read ?? "—")}</dd></div><div><dt>Confidence</dt><dd>{Math.round(extraction.confidence*100)}%</dd></div><div><dt>Source</dt><dd>{extraction.document_id} · page {extraction.page}</dd></div><div><dt>Human verification</dt><dd>Not recorded</dd></div></dl></section>}
      {inspection.record !== undefined && <section className="inspector-section"><h3>Referenced record</h3><pre className="reference-record">{JSON.stringify(inspection.record, null, 2)}</pre></section>}
      {includeDocument && source && <section className="inspector-section inspector-source"><div className="section-heading inline-heading"><h3>Printed source</h3><Link prefetch={false} className="text-button" href={documentHref(base, source.id, source.page.page, extraction?.id)}>Open {source.id} document</Link></div><DocumentPage document={source} selectedField={extraction?.id} fieldHref={href} masked={masked}/></section>}
    </>}
    <section className="inspector-section"><h3>Dependency trace</h3><p>Inputs and sources from the selected computed version. Open any reference to inspect it.</p><ul className="trace-tree"><TraceBranch trace={inspection.trace} href={href}/></ul></section>
    <section className="inspector-section" aria-label="Tax line usage"><h3>Tax line usage <span className="count-tag">{inspection.usage.length}</span></h3><p>Direct references and all downstream dependent lines.</p>{inspection.usage.length ? <ul className="usage-list">{inspection.usage.map(item => <li key={item.key}><Link prefetch={false} href={evidenceHref(base, item.key, item.key)} aria-label={`Open return line ${item.key}`}><code>{item.key}</code><span>{item.label}</span></Link><span className="usage-kind">{item.direct ? "Direct" : "Downstream"}</span></li>)}</ul> : <p className="empty-usage">No computed line usage recorded for this exact reference. A missing page extraction does not establish a tax-line link.</p>}</section>
  </aside>;
}
