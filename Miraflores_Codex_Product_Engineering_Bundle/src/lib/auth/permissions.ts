import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { engagementAccess, type Actor } from "../db/schema";
import { DEFAULT_AS_OF } from "../packet/schema";
import { isAvailable } from "../packet/availability";

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}
export function assertStaff(actor: Actor) {
  if (actor.role === "client") throw new HttpError(403, "This workspace is available to firm staff only.");
}
export function assertActive(actor: Actor) {
  if (!isAvailable(actor.activeFrom, DEFAULT_AS_OF)) throw new HttpError(403, "This identity is not active at the selected workpaper date.");
}
export async function authorizeEngagement(actor: Actor, clientId: string, taxYear: number) {
  assertActive(actor);
  const [access] = await db.select({ actorId: engagementAccess.actorId }).from(engagementAccess).where(and(
    eq(engagementAccess.actorId, actor.id), eq(engagementAccess.clientId, clientId), eq(engagementAccess.taxYear, taxYear),
  )).limit(1);
  if (!access) throw new HttpError(403, "You do not have access to this engagement.");
}
export function publicIdentity(actor: Actor) {
  return { id: actor.id, name: actor.name, role: actor.role };
}
export function apiError(error: unknown) {
  if (error instanceof HttpError) return Response.json({ error: error.message, ...(error.details ? { current: error.details } : {}) }, { status: error.status });
  // Never return database details, source content, or credentials in an error.
  console.error("Workpaper request failed", error instanceof Error ? error.name : "UnknownError");
  return Response.json({ error: "The request could not be completed. Please try again." }, { status: 500 });
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  // Next's Node adapter can use its internal hostname in Request.url. The HTTP
  // Host header retains the browser-facing authority (e.g. 127.0.0.1:3100).
  const expected = new URL(request.url);
  const host = request.headers.get("host");
  if (host) expected.host = host;
  if ((origin && origin !== expected.origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new HttpError(403, "Cross-origin changes are not allowed.");
  }
}
