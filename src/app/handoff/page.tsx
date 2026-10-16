import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentActor,listIdentities } from '@/lib/auth/session';
import { publicIdentity } from '@/lib/auth/permissions';
import { listArtifacts } from '@/lib/delivery/service';
import { AppShell } from '@/components/app-shell';
export const dynamic='force-dynamic';
export default async function Handoff() {
  const actor=await currentActor();if(!actor)redirect('/firm');if(actor.role==='client')redirect('/engagements/CL-20417/2025/workflow');
  const artifacts=await listArtifacts(actor);
  return <AppShell actor={publicIdentity(actor)} identities={await listIdentities()}><div className="page-heading"><div><span className="eyebrow">ASSIGNMENT DELIVERY · PHASE 8</span><h1>Submission & audit</h1><p>One supplied household, traceable evidence and an honest record of incomplete requirements.</p></div></div>
    <section className="panel delivery-state"><h2>Delivery status</h2><p><strong>Public deployment: blocked.</strong> No public URL is claimed. Hosting credentials/project and a remote PostgreSQL connection are not configured. The deployment checklist names the remaining steps.</p><p><strong>Personal video: not recorded or supplied.</strong> The human applicant must record the walkthrough and add a reachable video link. A script is available below.</p><p><strong>Production tax readiness: incomplete.</strong> Phase 4 verification, source corrections and production sign-offs are absent. Filing and signatures are labeled simulations, with original engine values separate from modeled estimates.</p><Link className="button secondary" href="/coverage">Review every requirement</Link></section>
    <section className="delivery-grid" aria-label="Submission documents">{artifacts.filter(a=>a.type!=='image/png').map(a=><article className="panel delivery-card" key={a.id}><h2>{a.title}</h2>{a.available?<a className="button secondary" href={`/api/handoff/${a.id}`}>Download {a.type==='application/json'?'JSON':a.id==='product'?'one-page Markdown':'Markdown'}</a>:<p className="evidence-gap">Not generated yet. No download is offered.</p>}</article>)}</section>
    <section className="panel delivery-state"><h2>Actual UI evidence screenshots</h2><p>Captured by Playwright using the masked staff view. The W-2 contribution check is a passing control, not an error. The JSON and Markdown reports separate source facts from pipeline readings, engine use and unconfirmed judgments.</p><ul className="reference-list">{artifacts.filter(a=>a.type==='image/png').map(a=><li key={a.id}>{a.available?<a href={`/api/handoff/${a.id}`}>{a.title}</a>:<span>{a.title} · not captured yet</span>}</li>)}</ul></section>
  </AppShell>;
}
