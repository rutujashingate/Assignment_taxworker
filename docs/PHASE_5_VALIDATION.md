# Phase 5 — Collaboration and restricted client workspace

Implemented in the main repository root using the existing Next.js 16.4.2 / strict TypeScript / Tailwind / Drizzle / PostgreSQL stack. No application dependencies, branches, secrets, environment settings or deployments were added. Original packet bytes, source projections, engine versions and migrations 0001–0002 are unchanged.

## Delivered behavior

- **Workflow:** internal/client threads, source-linked questions, client and colleague answers, assigned tasks, editable deadlines, record search/filters and persistent in-app notifications. A real D64/qa-38 question can be drafted from the ambiguous supplied receipt; it must be explicitly sent. No client answer is fabricated or copied from a future packet message.
- **Evidence:** answers have author, actual UTC entry time and stable `answer:<uuid>` references. Files and text notes have `attachment:<uuid>` references. Replies/answers and attachments are append-only; corrections to their contents require an appended record. Question/note/task metadata can be edited with a reason and expected revision. Engine lines remain unchanged.
- **Review notes:** internal only, created/edited/closed by reviewer or partner tax roles. Preparers can respond. Open review notes block `getFilingGate` / `assertFilingUnblocked` on the server; closure requires a reason. No filing endpoint exists in this phase, and a clear review-note gate does not imply filing readiness.
- **Attachments:** exact uploaded bytes persist in PostgreSQL BYTEA with SHA-256. Notes persist separately. Files are limited to 2 MiB and supported text/CSV/PDF/PNG/JPEG media types; request bodies are bounded while streaming. Downloads are forced attachments with no-sniff headers. No OCR, file extraction, malware scanner or external storage integration is claimed.
- **Privacy:** signed sessions and engagement authorization apply to every operation. Client visibility is filtered in SQL before children are loaded, search runs, counts/cursors are calculated or DTOs are serialized. Client pages and APIs cannot read internal notes, evidence, files or notifications. Both supplied taxpayers can use explicitly shared conversations and attachments; they cannot edit staff metadata or create firm records. Internal evidence cannot be linked into a client-visible question.
- **Sensitive access:** collaboration text is masked by default for all roles. Known packet identifiers and labeled identifier patterns are masked in text and structured projections. Uncleared firm staff cannot upload/download file attachments, enter protected identifiers, or reveal original text/fields. Authorized reveals and sensitive document/attachment views append audit metadata before returning content; reveal audit records omit the secret itself. Existing cleared-staff source-page behavior remains available with view logging. Original source/extraction data is not modified by masking.
- **Concurrency and audit:** parent row locks and expected revisions cover metadata edits, replies/answers and attachments. One concurrent writer wins; the other receives 409 without overwriting data or losing its browser draft. Mutations, audit events and recipient notifications commit together. Notifications are recipient-owned and marking one read is persistent/audited.

## Assumptions and transport

The repository has local PostgreSQL, not a configured Vercel/Supabase deployment. The supported fallback is **authenticated polling every 3 seconds in visible engagement pages**, with an immediate check after returning to visibility or saving locally. No Supabase dependency or successful Realtime integration is asserted.

The change cursor hashes only that actor’s visible collaboration projections and own notifications. Staff cursors also include engagement-scoped issue revisions. Internal activity does not change a client cursor or unread count. Network/session errors are visible. Workflow applies incoming changes while preserving editors’ original revision/draft; other engagement pages defer refresh if a form is dirty.

Tradeoffs: updates can lag one polling interval plus network time; polling adds database reads; hidden/offline pages do not receive push events. JavaScript is required for new collaboration actions and live updates; a no-script notice explains this. Collaboration forms explicitly POST so failed/no-script submission cannot put question/answer text into a GET URL. Original native entry/navigation and issue triage remain covered by their regression tests.

The source replay cursor stays **2026-06-23T06:05:00Z**. New human workpaper activity records its actual entry date separately. D71/D72, future client messages, agency outcomes and the future staff identity remain unavailable. The six supplied deadlines and original preparer/reviewer/partner assignments are read-only historical context; new task assignments/deadlines are persistent overlays.

## Files changed

Created:

```text
db/migrations/0003_collaboration.sql
src/lib/collaboration/types.ts
src/lib/collaboration/privacy.ts
src/lib/collaboration/service.ts
src/lib/collaboration/http.ts
src/components/live-changes.tsx
src/components/workflow-desk.tsx
src/components/sensitive-reveal.tsx
src/app/api/engagements/[clientId]/[taxYear]/collaboration/route.ts
src/app/api/engagements/[clientId]/[taxYear]/collaboration/[itemId]/route.ts
src/app/api/engagements/[clientId]/[taxYear]/collaboration/attachments/route.ts
src/app/api/engagements/[clientId]/[taxYear]/collaboration/attachments/[attachmentId]/route.ts
src/app/api/engagements/[clientId]/[taxYear]/collaboration/evidence/route.ts
src/app/api/engagements/[clientId]/[taxYear]/collaboration/reveal/route.ts
src/app/api/engagements/[clientId]/[taxYear]/sensitive-reveal/route.ts
tests/collaboration.test.ts
tests/e2e/phase5.spec.ts
docs/PHASE_5_VALIDATION.md
```

Updated:

```text
src/app/engagements/[clientId]/[taxYear]/workflow/page.tsx
src/app/globals.css
src/components/app-shell.tsx
src/components/evidence-inspector.tsx
src/lib/db/schema.ts
src/lib/evidence/privacy.ts
src/lib/evidence/queries.ts
src/lib/review/issues.ts
tests/e2e/phase1.spec.ts
README.md
AI_USAGE.md
```

The previous navigation assertion now expects the implemented staff Workflow heading. Existing source/review behavior remains tested. The generated build-only `next-env.d.ts` change is excluded from this phase.

## Actual validation

Final results are recorded after the last test run. Migrations ran against the development and dedicated `_test` databases; the importer/test helper remained idempotent. Unit/integration tests use real PostgreSQL; browser tests use an owned production server on port 3100, with separate signed preparer/reviewer/client sessions. The user’s development server on port 3000 was left running.

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: **64 passed** across 8 files, including 13 new collaboration tests.
- `npm run build`: passed, including production compilation and route generation.
- `npm run test:e2e`: **22 Chromium tests passed**, including five new Phase 5 browser flows.
- `npm run validate:packet`: passed counts, graph/reference checks, scenarios and original-byte integrity.
- `git diff --check`: passed.

The new tests cover linked client/colleague answers, original printed ambiguity, forbidden actions, internal-note direct API/search/file/answer/reveal access, client cursor isolation, immutable dated evidence, upload bounds, persisted bytes and notes, masking and audit logs, task assignments/deadlines, recipient-owned notifications, atomic revision conflicts and two-window propagation. Browser flows exercise actual forms, notification reads, reload persistence, mobile layout and retained conflicting drafts. Desktop/mobile screenshots were inspected locally; generated test artifacts are ignored.

Initial browser failures were an old placeholder heading expectation and exact label locators that included descendant select/textarea text. The heading assertion was updated for the delivered page and role/name locators used for those controls; the full suite was rerun. No assertion was removed to conceal a product failure.

Source integrity remains **1,943,262 bytes**, SHA-256:

```text
ee01f8508bd2fd9854754b82fd9c4a055bdc55e2778a132002a25381c412ad19
```

## Limits and next-phase readiness

**Dependency discrepancy:** Phase 4 is absent from this checkout and was not requested. Phase 5 therefore verifies a preparer’s correction to a collaborative question appearing in a reviewer’s window and a conflicting stale edit receiving 409. It does **not** claim to have tested tax-field correction propagation, verification, sign-off invalidation, bulk undo or engine recalculation. Those require Phase 4 implementation and regression testing. Full original Gate 5 acceptance remains conditional on that tax-correction dependency.

Collaboration, client privacy, persistence and polling are locally testable and ready for Phase 6 integration. No Phase 6 work has started. A future filing simulation must call the review-note gate in its authorized write transaction alongside all other filing prerequisites. Approval/e-signature, actual filing and production authentication/deployment are not implemented or claimed. Local DB access works; no missing local DB credential blocks these tests. There is no configured Supabase/Vercel deployment to validate. Stopped after Phase 5.
