import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentActor,listIdentities } from '@/lib/auth/session';
import { publicIdentity,assertStaff,authorizeEngagement } from '@/lib/auth/permissions';
import { AppShell } from '@/components/app-shell';
import { COVERAGE } from '@/lib/records/coverage';
export const dynamic='force-dynamic';
export default async function Coverage() {
  const actor=await currentActor();if(!actor)redirect('/firm');if(actor.role==='client')redirect('/engagements/CL-20417/2025/workflow');assertStaff(actor);await authorizeEngagement(actor,'CL-20417',2025);
  const categories=[...new Set(COVERAGE.map(r=>r.category))];
  return <AppShell actor={publicIdentity(actor)} identities={await listIdentities()}><div className="page-heading"><div><span className="eyebrow">ORIGINAL THREE-PAGE BRIEF</span><h1>Requirement coverage</h1><p>Routes and representative automated checks, with simulations and remaining limitations labeled.</p></div></div><aside className="evidence-gap"><h2>Coverage is not filing readiness</h2><p>Phase 4 tax corrections/sign-offs and Phase 7 lifecycle work are absent. Computed output, simulated source pages and a passing test do not establish an approved return. No tax engine is rerun and no external filing/signature integration is claimed.</p></aside><nav className="area-tabs" aria-label="Coverage categories">{categories.map(c=><a key={c} href={`#coverage-${c.replaceAll(/\W+/gu,'-')}`}>{c}</a>)}</nav>{categories.map(c=><section className="panel record-card coverage-category" key={c} id={`coverage-${c.replaceAll(/\W+/gu,'-')}`}><h2>{c}</h2>{COVERAGE.filter(r=>r.category===c).map(r=><article className="coverage-row" id={r.id} key={r.id}><header><h3>{r.requirement}</h3><span className={`coverage-state ${r.status}`}>{r.status}</span></header><p>{r.detail}</p>{r.route&&<Link prefetch={false} className="text-button" href={r.route}>Open route</Link>}{r.test&&<code>Representative test: {r.test}</code>}</article>)}</section>)}</AppShell>;
}
