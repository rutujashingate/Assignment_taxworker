import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { currentActor, listIdentities } from "@/lib/auth/session";
import { HttpError, publicIdentity } from "@/lib/auth/permissions";
import { getEngagement, engagementStatistics } from "@/lib/engagements/queries";
import { getPreferences } from "@/lib/workpaper/preferences";
import { AppShell } from "@/components/app-shell";
import { VersionPicker } from "@/components/version-picker";

export const dynamic = "force-dynamic";
export default async function EngagementLayout({ children, params }: { children: ReactNode; params: Promise<{ clientId: string; taxYear: string }> }) {
  const actor = await currentActor(); if (!actor) redirect("/firm");
  const { clientId, taxYear: year } = await params; const taxYear = Number(year);
  if (!/^\d{4}$/.test(year)) notFound();
  let engagement;
  try { engagement = await getEngagement(actor, clientId, taxYear); }
  catch (error) { if (error instanceof HttpError && [403,404].includes(error.status)) notFound(); throw error; }
  const identities = await listIdentities();
  const staff = actor.role !== "client";
  const preference = staff ? await getPreferences(actor, clientId, taxYear) : null;
  const statistics = preference ? await engagementStatistics(actor, clientId, taxYear, preference.selectedVersion) : null;
  return <AppShell actor={publicIdentity(actor)} identities={identities} engagement={engagement}>
    <div className="engagement-heading household-context"><div><h1>{engagement.name}</h1><p>{taxYear} tax year · {clientId} · Federal & California</p></div><span className="status-label neutral">{engagement.readiness}</span></div>
    {staff && preference && statistics && <>
      <details className="workpaper-data"><summary>Return version & data · {preference.selectedVersion}</summary><div className="engagement-toolbar"><VersionPicker key={`${actor.id}:${preference.selectedVersion}:${preference.revision}`} clientId={clientId} taxYear={taxYear} initial={preference} versions={statistics.versions}/><p className="fine-print">{statistics.documentCount} available documents · {statistics.lineCount} computed lines · Original calculation preserved</p></div></details>
    </>}
    {children}
  </AppShell>;
}
