import Link from "next/link";
import { redirect } from "next/navigation";
import { currentActor, listIdentities } from "@/lib/auth/session";
import { publicIdentity } from "@/lib/auth/permissions";
import { searchEngagements } from "@/lib/engagements/queries";
import { AppShell } from "@/components/app-shell";
import { IdentitySwitcher } from "@/components/identity-switcher";

export const dynamic = "force-dynamic";
export default async function Firm({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [actor, identities, search] = await Promise.all([currentActor(), listIdentities(), searchParams]);
  if (actor?.role === "client") redirect("/engagements/CL-20417/2025/workflow");
  const query = typeof search.q === "string" ? search.q.slice(0, 200) : "";
  const accessible = actor ? await searchEngagements(actor) : [];
  const rows = actor && query ? await searchEngagements(actor, query) : accessible;
  return <AppShell actor={actor ? publicIdentity(actor) : null} identities={identities}>
    <div className="page-heading"><div><span className="eyebrow">FIRM WORKSPACE</span><h1>A clear view of the work.</h1><p>Find an engagement and pick up where you left off.</p></div><span className="year-tag">2025 TAX YEAR</span></div>
    {!actor ? <section className="panel welcome-panel"><div className="welcome-number">01</div><div><span className="eyebrow">START HERE</span><h2>Open the firm workspace</h2><p>Start as a preparer to open the supplied household, browse client files and trace the return to its printed sources. Client identities open a restricted workspace.</p><IdentitySwitcher identities={identities} variant="welcome"/><p className="fine-print">Demo identity selection · signed session · PostgreSQL persistence. This is not a production login.</p></div></section> : <>
      {accessible[0] && <section className="workspace-quickstart"><div><h2>Your client workpaper</h2><p>Open {accessible[0].name} to review the return, browse client files and trace numbers to their sources.</p></div><Link className="button" href={`/engagements/${accessible[0].clientId}/${accessible[0].taxYear}/review`}>Open workpaper <span aria-hidden="true">↗</span></Link></section>}
      <section className="summary-grid" aria-label="Workspace summary"><div className="summary-card"><span>Engagements in scope</span><strong>{String(accessible.length).padStart(2,"0")}</strong><small>One supplied household</small></div><div className="summary-card"><span>Latest computation</span><strong>{accessible[0]?.computedVersion ?? "—"}</strong><small>June 23, 2026</small></div><div className="summary-card"><span>Review readiness</span><strong className="text-value">Not evaluated</strong><small>Checks and approvals arrive in later phases</small></div></section>
      <section className="panel engagement-panel"><div className="section-heading"><h2>Engagements</h2><span className="count-tag">{rows.length} {rows.length === 1 ? "result" : "results"}</span></div>
        <form action="/firm" className="search-form"><label htmlFor="engagement-search" className="sr-only">Search engagements</label><span aria-hidden="true" className="search-icon">⌕</span><input id="engagement-search" name="q" type="search" defaultValue={query} maxLength={200} placeholder="Search by household, client ID, or year"/><button className="button secondary" type="submit">Search</button>{query && <Link className="text-button" href="/firm">Clear</Link>}</form>
        {rows.length ? <div className="table-scroll"><table><thead><tr><th>HOUSEHOLD</th><th>RETURN</th><th>COMPUTATION</th><th>READINESS</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{rows.map(row => <tr key={row.clientId}><td><Link className="household-link" href={`/engagements/${row.clientId}/${row.taxYear}/review`}>{row.name}</Link><span className="cell-detail">{row.clientId} · Joint household</span></td><td>{row.taxYear}<span className="cell-detail">Federal · California</span></td><td><span className="version-chip">{row.computedVersion}</span><span className="cell-detail">Latest supplied result</span></td><td><span className="status-label neutral">{row.readiness}</span></td><td><Link className="open-link" aria-label={`Open ${row.name}`} href={`/engagements/${row.clientId}/${row.taxYear}/review`}>Open <span aria-hidden="true">↗</span></Link></td></tr>)}</tbody></table></div> : <div className="search-empty"><h3>No engagements match “{query}”</h3><p>Try Okafor, Lindqvist, CL-20417, or 2025.</p></div>}
      </section>
      <div className="source-note"><span aria-hidden="true">◇</span><p><strong>Built around the original record.</strong> Imported source data is read-only. Review decisions will be recorded separately, with their own history.</p></div>
    </>}
  </AppShell>;
}
