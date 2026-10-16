"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { IdentitySwitcher } from "./identity-switcher";
import { LiveChanges } from "./live-changes";

type Identity = { id: string; name: string; role: string };
export function AppShell({ children, actor, identities, engagement }: {
  children: ReactNode; actor: Identity | null; identities: Identity[];
  engagement?: { name: string; clientId: string; taxYear: number; asOf?: string };
}) {
  const path = usePathname(); const base = engagement ? `/engagements/${engagement.clientId}/${engagement.taxYear}` : "";
  const destinations = actor?.role === "client" ? [["workflow", "Client workspace", "05"]] : [
    ["review", "Review Desk", "01"], ["return", "Tax Return", "02"], ["documents", "Documents", "03"],
    ["workflow", "Workflow", "04"], ["records", "CPA Records", "05"], ["history", "History & Scenarios", "06"],
  ];
  return <div className="app-frame">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <aside className="sidebar">
      <Link href="/firm" className="brand" aria-label="Miraflores home">
        <svg width="30" height="32" viewBox="0 0 30 32" fill="none" aria-hidden="true"><path d="M4 26V7L15 19 26 7v19M15 19v9" stroke="currentColor" strokeWidth="2"/><path d="M15 4v6" stroke="currentColor" strokeWidth="2"/></svg>
        <span>miraflores<span className="brand-caption">THE EVIDENCE-FIRST WORKPAPER</span></span>
      </Link>
      <div className="nav-caption">WORKSPACE</div>
      {actor?.role !== "client" && <Link className={`nav-link ${path === "/firm" ? "active" : ""}`} href="/firm"><span aria-hidden="true">▦</span> Engagements</Link>}
      {actor && actor.role !== "client" && <nav className="firm-tools" aria-label="Firm tools"><Link prefetch={false} className="nav-link" href="/firm/search">Search all records</Link><Link prefetch={false} className="nav-link" href="/firm/time">My work time</Link><Link prefetch={false} className="nav-link" href="/coverage">Coverage</Link>{actor.role === "firm_administrator" && <Link prefetch={false} className="nav-link" href="/firm/admin">Firm administration</Link>}</nav>}
      {engagement && <>
        <div className="nav-caption engagement-caption">{engagement.taxYear} ENGAGEMENT</div>
        <nav aria-label="Engagement">
          {destinations.map(([route, label, number]) => <Link prefetch={false} key={route} href={`${base}/${route}`} className={`nav-link ${path === `${base}/${route}` || path.startsWith(`${base}/${route}/`) ? "active" : ""}`} aria-current={path === `${base}/${route}` || path.startsWith(`${base}/${route}/`) ? "page" : undefined}><span className="nav-number" aria-hidden="true">{number}</span>{label}</Link>)}
        </nav>
      </>}
      <div className="sidebar-foot"><span className="small-dot"/> Original source preserved<p>Human review. Clear evidence.<br/>A record you can return to.</p></div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <div className="breadcrumb"><Link href={actor?.role === "client" ? "/engagements/CL-20417/2025/workflow" : "/firm"}>Workspace</Link><span aria-hidden="true">/</span>{engagement ? <><Link href="/firm">Engagements</Link><span aria-hidden="true">/</span><strong>{engagement.name}</strong></> : <strong>Engagements</strong>}</div>
        <IdentitySwitcher identities={identities} current={actor}/>
      </header>
      <div className="demo-strip"><span className="pill">DEMO</span> Workpaper date: {engagement?.asOf?new Date(engagement.asOf).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric",timeZone:"UTC"}):"See engagement season clock"} <span className="strip-divider">·</span> Simulated season · original engine preserved</div>
      {engagement&&actor&&<LiveChanges key={actor.id} actorId={actor.id} clientId={engagement.clientId} taxYear={engagement.taxYear}/>}
      <main id="main-content" className="main-content">{actor?.role === "client" && <aside className="client-guidance"><strong>You are viewing the client workspace.</strong><p>Answer questions shared by your tax team and attach supporting evidence below. Choose a preparer in the Demo identity selector above to use the CPA workspace.</p></aside>}{children}</main>
      <footer className="workspace-footer"><span>Miraflores Workpaper</span><span>One household. Every decision traceable.</span></footer>
    </div>
  </div>;
}
