# Phase 1 acceptance report

Validated October 15, 2026. **Gate 0: PASS. Gate 1: PASS. Phase 2 has not started.**

## Observable result

A locally runnable Next.js application imports the exact packet into PostgreSQL, offers the active supplied demo identities, finds only CL-20417 by household/ID/year, opens the engagement shell and saves an identity-specific computed-version preference. Review Desk now shows a staff-only import overview. Every implemented application mutation is audited transactionally. Source projections reject update/delete/truncate at the database. Later product features are explicitly labeled “Not built yet.”

Default source time is 2026-06-23T06:05:00Z. All eight identities are seeded, but only five staff and two clients are available at that date. No extra households, source fields, tax amounts, computed returns or integrations were invented.

## Latest Phase 1 usability and navigation fixes

The user reported that workspace entry and navigation did not respond at `http://127.0.0.1:3000`. A fresh browser with JavaScript enabled could use the existing flow. Disabling page JavaScript reproduced an inert welcome submission: it returned to `/firm?` without creating a session. This establishes a reproducible failure mode; the user's original browser state was not accessible, so its exact cause is not claimed.

The welcome screen now defaults to a supplied preparer and has a prominent **Open workspace** button. Staff and clients are grouped separately in both identity selectors. Native HTML identity forms create the same signed, audited session and return a 303 redirect, so entry works without loaded page JavaScript. Existing JSON API clients retain their responses. The **Workspace** breadcrumb is now a real link. Firm search leads to a visible **Open workpaper** action; clients receive explicit guidance about their restricted view.

Review Desk displays database-derived import counts, original byte length, import time and SHA-256. Full delivered-packet totals are clearly distinguished from documents available at the fixed workpaper date. Its server query authorizes staff and engagement scope and returns only metadata, never original bytes or source fields. An unsaved default version no longer claims to be saved. Changing the version still uses the existing audited, revision-checked operation.

The root stack, migration, importer and database conventions were preserved; no packages were installed. No issue checks, trace UI or complex tax-area views were added. Saving a different computed-version preference still requires JavaScript; the page explains this when scripts are disabled.

## Tests actually run

| Command | Observed result |
|---|---|
| `npm run validate:packet` | PASS: original bytes/hash, all requested counts, graph/reference checks, named examples and five scenarios; six disclosed prior-asset provenance labels remain unresolved |
| `npm test` | PASS: 18 tests across three files; setup rechecks migrations and idempotent import in the isolated test DB |
| `npm run lint` | PASS: no warnings or errors |
| `npm run typecheck` | PASS |
| `npm run build` | PASS: optimized Next.js production build and route generation |
| `npm run test:e2e` | PASS: seven Chromium tests against the production server; server stopped automatically afterward |
| Live Playwright smoke checks at `http://127.0.0.1:3000` | PASS with JavaScript enabled and disabled: workspace entry, Open workpaper, all five destinations, Workspace breadcrumb; enabled-mode search by name/ID/year and preference save/reload/restore also passed |
| `git diff --check` | PASS |

Earlier Phase 1 validation ran `npm run db:migrate`, `npm run db:import` twice, `npm ls eslint --all` and installed Chromium. Those commands were not rerun in this fix; the existing local databases and browser cache were reused. No development database was reset, and the user's already-running development server was left running. Live preference checks restored the original selected version through the audited application operation.

The initial database test exposed 48 original negative-zero values that JSONB normalizes to zero. Exact BYTEA comparison and SHA-256 pass; the projection test compares JSON semantics and the inventory documents the normalization. The initial browser run found Next's localhost normalization in same-origin checks; the final implementation checks the incoming Host authority, with a regression case and cross-origin rejection still passing. These failures were repaired before declaring the gate passed.

The 18 unit/integration cases cover duplicate import, byte fidelity, changed-input rejection, immutable source operations, signed/forged/revoked sessions, active-role and engagement restrictions, safe response fields, scoped import metadata, search/empty state, cross-origin writes, historical evidence availability, durable preferences, concurrency, identity isolation, append-only audit and rollback when the actual command's audit insert is forced to fail.

The browser cases cover:

1. Disable JavaScript, submit the welcome form, search, open the workpaper, navigate all five destinations and Workspace, then switch to a client through the native form and verify staff API denial.
2. Reject cross-origin, extra-field, duplicate-field and future-identity native form submissions.
3. Start as Priya, search Okafor, open the only engagement, verify import counts/hash and version focus link, change version, reload and recover it in a second browser context.
4. Select a client, receive 403 from staff APIs and confirm direct staff-page navigation exposes neither internal content nor import metadata.
5. Save Helen's preference, verify HTTP-only/SameSite cookies and revoked-session rejection, switch to Erik and back, clear browser storage and recover the preference from PostgreSQL.
6. Reject anonymous/forged sessions, future identities and cross-origin JSON changes.
7. Receive exactly 200/409 for competing writes, and inspect the overview and navigate Documents at a 390px viewport without page-wide horizontal overflow.

Desktop welcome, workpaper overview and mobile overview screenshots were generated and visually inspected: `test-results/phase1-welcome.png`, `test-results/phase1-overview.png`, and `test-results/phase1-overview-mobile.png`. Firm and Documents screenshots are also generated. These QA artifacts are ignored and regenerated by the browser suite. No full keyboard/accessibility audit, Firefox/WebKit or deployment testing is claimed.

## Interfaces and data decisions

- `GET /api/demo-session`: active identity choices and current public identity, no secrets/source records.
- `POST /api/demo-session`: strict `{ identityId }` JSON or URL-encoded native form; creates an opaque HMAC-signed HTTP-only SameSite cookie, revokes the prior session and appends an audit event. JSON returns the public actor; a valid native form returns a 303 redirect to the role's workspace. Both formats enforce the same origin, identity and access checks. Secure cookies are used on HTTPS requests. Per-session keys are stored only in PostgreSQL; no secret file was created.
- `GET /api/engagements?q=…`: staff-only, engagement-scoped search, explicit response allow-list, no-store responses.
- `GET /api/engagements/:clientId/:taxYear/preferences`: staff-only per-identity preference and revision.
- `POST` to the preference endpoint: strict `{ selectedVersion: 'v1'|'v2'|'v3', expectedRevision: number }`; updates preference and audit in one transaction. 400 invalid input, 401 missing/invalid session, 403 forbidden scope/role/origin, 409 stale revision. Errors do not expose SQL or packet content.

The local development database is `miraflores_workpaper`; tests use `miraflores_workpaper_test`. No existing database was reset. Next.js, React, Tailwind, Drizzle, PostgreSQL and Zod follow the supplied plan. TypeScript 5.9 and ESLint 9 are pinned for compatibility with the selected framework/tooling; dependency versions and lockfile are reproducible.

## Files changed

This usability/navigation fix changes 12 existing files:

```text
README.md
docs/PHASE_1_VALIDATION.md
src/app/api/demo-session/route.ts
src/app/engagements/[clientId]/[taxYear]/review/page.tsx
src/app/firm/page.tsx
src/app/globals.css
src/components/app-shell.tsx
src/components/identity-switcher.tsx
src/components/version-picker.tsx
src/lib/engagements/queries.ts
tests/authorization.test.ts
tests/e2e/phase1.spec.ts
```

The following records the original implementation and relocation, rather than new files in this fix.

The application has been relocated from the prompt bundle to the main `Miraflores` repository directory. Paths below are relative to that root. Original plans, START_HERE and the assignment PDF remain in the ignored reference bundle; the original JSON moved unchanged to root `data/`. Root npm commands require no subfolder navigation. The empty root npm stub was replaced by the application's complete lockfile; prior generated build/test artifacts were preserved outside the repository before rebuilding.

Relocation verification passed from the repository root: packet validator, 17 unit/integration tests, four production-browser tests, lint, standalone typecheck, production build, repeat migration and idempotent import. `npm run dev` started successfully from root and served `/firm` with HTTP 200 and the identity selector rendered; the smoke-test server was then stopped. Comparison with the prior commit confirmed all 55 relocated tracked files were present, with source code, tests, migrations, dependency versions and source JSON unchanged. Next.js generated its standard root `AGENTS.md` guidance on the first development start.

54 files were created. The six supplied documents/data files were not edited. Additional support files beyond the proposed list are the shared version/placeholder components, error/404 pages, test helpers, this validation report and AI-use disclosure.

```text
.env.example
.gitignore
AI_USAGE.md
README.md
db/migrations/0001_initial.sql
docs/DATA_INVENTORY.md
docs/PHASE_1_VALIDATION.md
eslint.config.mjs
next-env.d.ts
next.config.ts
package-lock.json
package.json
playwright.config.ts
postcss.config.mjs
scripts/import-packet.ts
scripts/migrate.ts
scripts/validate_packet.py
src/app/api/demo-session/route.ts
src/app/api/engagements/[clientId]/[taxYear]/preferences/route.ts
src/app/api/engagements/route.ts
src/app/engagements/[clientId]/[taxYear]/documents/page.tsx
src/app/engagements/[clientId]/[taxYear]/history/page.tsx
src/app/engagements/[clientId]/[taxYear]/layout.tsx
src/app/engagements/[clientId]/[taxYear]/page.tsx
src/app/engagements/[clientId]/[taxYear]/return/page.tsx
src/app/engagements/[clientId]/[taxYear]/review/page.tsx
src/app/engagements/[clientId]/[taxYear]/workflow/page.tsx
src/app/error.tsx
src/app/firm/page.tsx
src/app/globals.css
src/app/layout.tsx
src/app/not-found.tsx
src/app/page.tsx
src/components/app-shell.tsx
src/components/identity-switcher.tsx
src/components/stage-placeholder.tsx
src/components/version-picker.tsx
src/lib/auth/permissions.ts
src/lib/auth/session.ts
src/lib/db/client.ts
src/lib/db/schema.ts
src/lib/engagements/queries.ts
src/lib/packet/availability.ts
src/lib/packet/import.ts
src/lib/packet/schema.ts
src/lib/workpaper/preferences.ts
tests/authorization.test.ts
tests/e2e/phase1.spec.ts
tests/helpers.ts
tests/packet-import.test.ts
tests/preferences.test.ts
tests/server-only.ts
tsconfig.json
vitest.config.ts
```

## Assumptions, remaining limits and next gate

This is a local Phase 1 implementation with demo identities. Local PostgreSQL is reachable through the documented Unix-socket default; an external DATABASE_URL is not configured and is not a local blocker. Production authentication, hosting and proxy/TLS configuration are not established. No deployment, cloud resource, external secret connection or user shell configuration was created. Git commits and pushes follow the user's standing authorization.

The only mutable workpaper action currently exposed is the audited viewing preference. Source tracing, source-page masking/reveal logging, independent issue checks, corrections, collaboration, approvals, realtime, scenarios, filing and exports remain later-phase work; no inactive affordance claims to perform those actions. The original six missing prior-asset provenance links and missing basis/related-return information remain disclosed gaps.

The importer stores version metadata separately from indexed return lines; original full versions remain unchanged in the original-byte packet and raw JSON. Query projections do not replace the source. No tax engine runs, and readiness remains “Review not evaluated.”

Original packet SHA-256 after implementation: `ee01f8508bd2fd9854754b82fd9c4a055bdc55e2778a132002a25381c412ad19`.

**Next-phase readiness:** Phase 2 may begin when requested. Implement the generic typed, version-aware resolver and bidirectional index, source viewer with exact printed-field mapping and privacy filtering, all-document index, and missing-page/provenance states. Do not start issue checks or corrections yet.
