import Link from "next/link";
import type { ReactNode } from "react";
import type { DocumentView } from "@/lib/evidence/queries";
import { displayValue } from "@/lib/evidence/format";
import { locatePrintedField, printedFields } from "@/lib/evidence/printed-fields";

function TaxFormTemplate({ children, type }: { children: ReactNode; type: string }) {
  return <article className="source-sheet tax-form-template"><div className="source-template-label">INFORMATION RETURN <span>{type}</span></div>{children}</article>;
}
function LedgerTemplate({ children }: { children: ReactNode }) {
  return <article className="source-sheet ledger-template"><div className="source-template-label">BUSINESS RECORD · PRINTED STATEMENT</div>{children}</article>;
}
function StatementTemplate({ children }: { children: ReactNode }) {
  return <article className="source-sheet statement-template"><div className="source-template-label">SOURCE STATEMENT</div>{children}</article>;
}
function GenericTemplate({ children }: { children: ReactNode }) {
  return <article className="source-sheet generic-template"><div className="source-template-label">STRUCTURED TEXT REPRESENTATION</div>{children}</article>;
}

export function DocumentPage({ document, selectedField, fieldHref, masked }: {
  document: DocumentView; selectedField?: string; fieldHref: (ref: string) => string; masked: boolean;
}) {
  const located = printedFields(document.page.printed_content, document.values).sort((a,b) => a.location.status === "matched" && b.location.status === "matched" ? a.location.start - b.location.start : 0);
  const fragments: ReactNode[] = []; let offset = 0;
  for (const { value, location } of located) {
    if (location.status !== "matched") continue;
    fragments.push(document.page.printed_content.slice(offset, location.start));
    const field = <Link prefetch={false} href={fieldHref(value.id)} aria-label={`Inspect ${value.id} · ${String(value.label ?? value.field)}`} data-testid={`printed-field-${value.id}`}>{location.text}</Link>;
    fragments.push(selectedField === value.id ? <mark key={value.id} className="printed-selection">{field}</mark> : <span key={value.id} className="printed-field">{field}</span>);
    offset = location.end;
  }
  fragments.push(document.page.printed_content.slice(offset));
  const contents = <>
    <header className="source-paper-heading"><span>{document.id} · PAGE {document.page.page}</span><h3>{document.title}</h3><p>{document.issuer} · Tax year {document.taxYear}</p></header>
    <div className="printed-content" data-testid="printed-content">{fragments}</div>
    <p className="source-caption">Printed content from the supplied packet{masked ? "; sensitive identifiers masked" : ""}. Click an underlined printed field to inspect its usage.</p>
  </>;
  return <section className="document-renderer" aria-label={`${document.id} page ${document.page.page}`}>
    <div className="source-disclaimer"><strong>Simulated source document</strong><span>Rendered from packet text. No original page image or PDF coordinates are available. Synthetic positions are not used.</span></div>
    {document.type === "W-2" || /^1099-/u.test(document.type) ? <TaxFormTemplate type={document.type}>{contents}</TaxFormTemplate>
      : ["books_profit_loss", "books_transaction_detail", "books_report", "mileage_log", "rental_ledger"].includes(document.type) ? <LedgerTemplate>{contents}</LedgerTemplate>
        : ["donation_receipt", "foreign_bank_statement", "payment_confirmation", "rental_owner_statement"].includes(document.type) ? <StatementTemplate>{contents}</StatementTemplate> : <GenericTemplate>{contents}</GenericTemplate>}
    {!document.values.length ? <div className="evidence-gap" role="note"><strong>Missing extraction on this page</strong><p>The printed page is available, but the packet contains no extracted fields for page {document.page.page}. This is page-level evidence; no extracted-value ID or lot has been invented.</p>{typeof document.extraction.reason === "string" && <p>{document.extraction.reason}</p>}</div> : <section className="extracted-fields" aria-label="Pipeline extracted fields">
      <h3>Pipeline extracted fields <span className="count-tag">{document.values.length}</span></h3><p>Extraction confidence describes the pipeline reading. Human verification is recorded separately.</p>
      <div className="field-grid">{document.values.map(value => {
        const location = locatePrintedField(document.page.printed_content, value);
        const precise = located.some(item => item.value.id === value.id);
        return <div className={`extracted-field${selectedField === value.id ? " selected" : ""}`} key={value.id}>
          <Link prefetch={false} className="field-name" href={fieldHref(value.id)}>{value.id} · {String(value.label ?? value.field)}</Link>
          <strong>{displayValue(value.value, value.value_type === "money")}</strong>
          <span>Pipeline confidence: {Math.round(value.confidence * 100)}%</span><span>Human verification: not recorded</span>
          <small>{precise && location.status === "matched" ? "Printed label and value located in page text." : "Precise printed span not established. Use page-level evidence."}</small>
        </div>;
      })}</div>
    </section>}
  </section>;
}
