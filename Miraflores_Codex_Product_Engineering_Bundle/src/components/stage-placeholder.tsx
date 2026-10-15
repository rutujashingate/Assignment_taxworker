import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth/session";

export async function StagePlaceholder({ title, phase, description, clientAllowed = false }: {
  title: string; phase: number; description: string; clientAllowed?: boolean;
}) {
  const actor = await currentActor();
  if (!actor) redirect("/firm");
  if (actor.role === "client" && !clientAllowed) return <section className="panel empty-panel"><span className="eyebrow">ACCESS RESTRICTED</span><h2>Staff workspace</h2><p>This area is available to your tax team. Your client workspace is available in the navigation.</p></section>;
  return <section className="panel empty-panel"><div className="placeholder-mark" aria-hidden="true">↗</div><span className="eyebrow">PLANNED FOR PHASE {phase}</span><h2>{title}</h2><p>{description}</p><span className="status-label neutral">Not built yet</span><p className="fine-print">This destination is part of the navigation shell. Its review actions are not available in Phase 1.</p></section>;
}
