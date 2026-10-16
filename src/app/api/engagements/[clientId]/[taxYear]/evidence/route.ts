import { requireActor } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/auth/permissions";
import { getEvidenceWorkspace, inspectEvidence, recordEvidenceView } from "@/lib/evidence/queries";

export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ clientId: string; taxYear: string }> }) {
  try {
    const actor = await requireActor(); const { clientId, taxYear } = await params;
    const workspace = await getEvidenceWorkspace(actor, clientId, Number(taxYear));
    const ref = new URL(request.url).searchParams.get("ref");
    if (!ref || ref.length > 500) throw new HttpError(400, "Provide an evidence reference of at most 500 characters.");
    const inspection = inspectEvidence(workspace, ref);
    await recordEvidenceView(workspace, ref);
    return Response.json({ version: workspace.index.version.version, masked: workspace.masked, ...inspection }, {
      status: inspection.node.status === "resolved" ? 200 : inspection.node.status === "invalid_reference" ? 400 : 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) { const response = apiError(error); response.headers.set("Cache-Control", "private, no-store"); return response; }
}
