import { cookies } from "next/headers";
import { z } from "zod";
import { createSession, currentActor, listIdentities, SESSION_COOKIE } from "@/lib/auth/session";
import { apiError, assertSameOrigin, HttpError, publicIdentity } from "@/lib/auth/permissions";

export const runtime = "nodejs";
export async function GET() {
  try {
    const [actor, identities] = await Promise.all([currentActor(), listIdentities()]);
    return Response.json({ actor: actor ? publicIdentity(actor) : null, identities }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const formRequest = request.headers.get("content-type")?.split(";")[0].trim() === "application/x-www-form-urlencoded";
    let body: unknown;
    if (formRequest) {
      const form = await request.formData();
      if (form.getAll("identityId").length !== 1) throw new HttpError(400, "Choose one supplied demo identity.");
      body = Object.fromEntries(form);
    } else body = await request.json().catch(() => null);
    const input = z.strictObject({ identityId: z.string().max(20) }).safeParse(body);
    if (!input.success) throw new HttpError(400, "Choose a supplied demo identity.");
    const store = await cookies();
    const session = await createSession(input.data.identityId, store.get(SESSION_COOKIE)?.value);
    store.set(SESSION_COOKIE, session.token, { httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "strict", path: "/", expires: session.expiresAt });
    if (formRequest) return new Response(null, { status: 303, headers: {
      Location: session.actor.role === "client" ? "/engagements/CL-20417/2025/workflow" : "/firm",
      "Cache-Control": "no-store",
    } });
    return Response.json({ actor: session.actor }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
