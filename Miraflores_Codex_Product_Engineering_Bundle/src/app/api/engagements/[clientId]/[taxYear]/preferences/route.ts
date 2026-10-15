import { requireActor } from "@/lib/auth/session";
import { apiError, assertSameOrigin, HttpError } from "@/lib/auth/permissions";
import { getPreferences, updatePreferences } from "@/lib/workpaper/preferences";

type Context = { params: Promise<{ clientId: string; taxYear: string }> };
function year(value: string) {
  if (!/^\d{4}$/.test(value)) throw new HttpError(400, "Invalid tax year.");
  return Number(value);
}
export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireActor(); const params = await context.params;
    return Response.json(await getPreferences(actor, params.clientId, year(params.taxYear)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor(); const params = await context.params;
    return Response.json(await updatePreferences(actor, params.clientId, year(params.taxYear), await request.json().catch(() => null)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
