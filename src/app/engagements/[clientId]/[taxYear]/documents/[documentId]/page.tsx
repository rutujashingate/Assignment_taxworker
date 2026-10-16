import { SourceDateUnavailable } from "@/components/source-date-unavailable";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentActor } from "@/lib/auth/session";
import { HttpError } from "@/lib/auth/permissions";
import { optionalEvidenceWorkspace as getEvidenceWorkspace, documentView, inspectEvidence, recordEvidenceView } from "@/lib/evidence/queries";
import { documentHref } from "@/lib/evidence/format";
import { pageReference } from "@/lib/evidence/references";
import { DocumentPage } from "@/components/document-page";
import { EvidenceInspector } from "@/components/evidence-inspector";
import { StagePlaceholder } from "@/components/stage-placeholder";

export default async function Document({ params, searchParams }: {
  params: Promise<{ clientId: string; taxYear: string; documentId: string }>; searchParams: Promise<{ page?: string; field?: string }>;
}) {
  const actor = await currentActor(); if (!actor) redirect("/firm");
  if (actor.role === "client") return <StagePlaceholder title="Documents" phase={2} description="Source review is available to staff."/>;
  const [{ clientId, taxYear, documentId }, search] = await Promise.all([params, searchParams]);
  const workspace = await getEvidenceWorkspace(actor, clientId, Number(taxYear));
  if(!workspace)return <SourceDateUnavailable/>;
  if (search.page !== undefined && (typeof search.page !== "string" || !/^[1-9]\d*$/u.test(search.page))) notFound();
  let document;
  try { document = documentView(workspace.index, documentId, Number(search.page ?? "1")); }
  catch (error) { if (error instanceof HttpError && error.status === 404) notFound(); throw error; }
  const field = typeof search.field === "string" ? search.field : undefined;
  if (field && !document.values.some(value => value.id === field)) notFound();
  const ref = field ?? pageReference(documentId, document.page.page);
  const inspection = inspectEvidence(workspace, ref);
  await recordEvidenceView(workspace, ref);
  const base = `/engagements/${clientId}/${taxYear}`;
  const href = (value: string) => `${documentHref(base,documentId,document.page.page,value)}#evidence-inspector`;
  return <>
    <div className="document-page-heading"><div><Link className="text-button" href={`${base}/documents`}>← All documents</Link><h2>{documentId} · {document.title}</h2><p>{document.extraction.status.replaceAll("_"," ")} · Received {document.receivedAt.slice(0,10)}</p>{document.superseded && <span className="superseded-tag">Superseded in {workspace.index.version.version}; original preserved</span>}</div><span className="count-tag">Page {document.page.page} of {document.pageNumbers.length}</span></div>
    <nav className="document-pages" aria-label="Document pages">{document.pageNumbers.map(page => <Link prefetch={false} key={page} aria-current={page === document.page.page ? "page" : undefined} href={documentHref(base,documentId,page)} aria-label={`Page ${page}`}>{page}</Link>)}</nav>
    <div className="evidence-workspace document-workspace"><DocumentPage document={document} selectedField={field} fieldHref={href} masked={workspace.masked}/><EvidenceInspector inspection={inspection} base={base} masked={workspace.masked} includeDocument={false}/></div>
  </>;
}
