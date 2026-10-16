import { redirect } from 'next/navigation';
import { currentActor,listIdentities } from '@/lib/auth/session';
import { publicIdentity } from '@/lib/auth/permissions';
import { getTime } from '@/lib/firm/service';
import { AppShell } from '@/components/app-shell';
import { TimeForm } from '@/components/firm-controls';
export const dynamic='force-dynamic';
export default async function Time() {
  const actor=await currentActor();if(!actor)redirect('/firm');if(actor.role==='client')redirect('/engagements/CL-20417/2025/workflow');
  const data=await getTime(actor,'CL-20417',2025);
  return <AppShell actor={publicIdentity(actor)} identities={await listIdentities()}><div className="page-heading"><div><span className="eyebrow">CL-20417 · TAX YEAR 2025</span><h1>My work time</h1><p>Your manually logged time against the supplied engagement budget.</p></div></div><div className="firm-workspace"><section className="panel record-card"><TimeForm budget={data.budget} clientId="CL-20417" taxYear={2025}/></section><section className="panel record-card"><h2>Budget context · your entries</h2><div className="budget-list">{data.categories.map(c=><article key={c.category}><strong>{c.category.replaceAll('_',' ')}</strong><p>Supplied budget: {c.budgetHours}h · {c.entryCount?`${(c.loggedMinutes/60).toFixed(2)}h logged by you`:'No time recorded by you'}</p></article>)}</div></section></div><section className="panel record-card"><h2>Your time entries</h2>{data.entries.length?data.entries.map(e=><article className="time-entry" key={e.id}><strong>{e.minutes} minutes · {e.category.replaceAll('_',' ')}</strong><p>{e.workedOn} · {e.note}</p></article>):<p className="fine-print">No actual time has been recorded. The supplied hours are a budget.</p>}</section></AppShell>;
}
