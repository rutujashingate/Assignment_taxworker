import { requireActor } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/auth/permissions";
import { searchEngagements } from "@/lib/engagements/queries";

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const query = new URL(request.url).searchParams.get("q") ?? "";
    if (query.length > 200) throw new HttpError(400, "Search is limited to 200 characters.");
    return Response.json({ engagements: await searchEngagements(actor, query) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
