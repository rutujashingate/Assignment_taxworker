import { redirect } from "next/navigation";
export default async function Engagement({ params }: { params: Promise<{ clientId: string; taxYear: string }> }) { const p = await params; redirect(`/engagements/${p.clientId}/${p.taxYear}/review`); }
