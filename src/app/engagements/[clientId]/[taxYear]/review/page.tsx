import Link from "next/link";
import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth/session";
import { getImportStatus } from "@/lib/engagements/queries";
import { StagePlaceholder } from "@/components/stage-placeholder";

export default async function Review({ params }: { params: Promise<{ clientId: string; taxYear: string }> }) {
  const actor = await currentActor();
  if (!actor) redirect("/firm");
  if (actor.role === "client") return <StagePlaceholder title="Review Desk" phase={3} description="Independent checks are planned for Phase 3."/>;
  const { clientId, taxYear } = await params;
  const status = await getImportStatus(actor, clientId, Number(taxYear));
  return <section className="panel foundation-overview" aria-labelledby="review-heading">
    <span className="eyebrow">WORKSPACE OVERVIEW</span>
    <h2 id="review-heading">Review Desk</h2>
    <p>The original packet is loaded in PostgreSQL. Your signed session and saved viewing preference survive refresh.</p>
    <div className="foundation-actions">
      <Link prefetch={false} className="button" href={`/engagements/${clientId}/${taxYear}/return`}>Open tax return</Link>
      <Link prefetch={false} className="button secondary" href={`/engagements/${clientId}/${taxYear}/documents`}>Browse client documents</Link>
      <a className="button" href="#computed-version">Choose computed version</a>
      <Link className="button secondary" href={`/firm?q=${encodeURIComponent(clientId)}`}>Find this household</Link>
    </div>
    <p className="overview-help">Use the computed-version selector above to save your view. A successful change shows its saved revision. Source records and original engine results stay read-only.</p>
    <details className="import-details" open>
      <summary>Packet import details</summary>
      <p>Full delivered packet totals are shown below. The workpaper uses June 23, 2026 availability; the header counts only documents available at that date. Future source contents remain withheld.</p>
      <dl className="import-metrics">
        <div><dt>Imported documents</dt><dd>{status.documentCount}</dd></div>
        <div><dt>Source pages</dt><dd>{status.pageCount}</dd></div>
        <div><dt>Extracted values</dt><dd>{status.extractedValueCount.toLocaleString("en-US")}</dd></div>
        <div><dt>Computed versions</dt><dd>{status.versions.map(version => version.version).join(" / ")}</dd></div>
      </dl>
      <dl className="import-provenance">
        <div><dt>Source file</dt><dd><code>data/okafor_lindqvist_2025_packet.json</code></dd></div>
        <div><dt>Original bytes</dt><dd>{status.byteLength.toLocaleString("en-US")}</dd></div>
        <div><dt>Imported at (UTC)</dt><dd><time dateTime={status.importedAt}>{status.importedAt}</time></dd></div>
        <div><dt>SHA-256</dt><dd><code>{status.packetHash}</code></dd></div>
      </dl>
    </details>
    <div className="phase-boundary"><h3>Evidence views are ready</h3><p>Open the tax return to trace numbers to printed sources, or browse client documents to see their tax-line usage. Issue checks are planned for Phase 3. Tax corrections, approvals and scenarios are not built yet.</p></div>
  </section>;
}
