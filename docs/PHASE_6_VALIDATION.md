# Phase 6 — CPA records and firm breadth

Implemented in the main repository root using the existing Next.js / strict TypeScript / Tailwind / Drizzle / PostgreSQL conventions. No application dependencies, branches, secrets, user environment settings or production deployment were added. Original packet bytes and engine versions remain read-only.

## Delivered routes and behavior

- `/engagements/CL-20417/2025/records`: summaries/navigation for all 15 named areas. `/records/[area]` reuses the existing typed resolver, recursive inputs/sources, printed document renderer and Evidence Inspector.
- Areas: prior-year comparison, tax computation, document index, depreciation, sales, Schedule C, rentals/passive losses, K-1s, retirement/foreign items, deductions/credits/limits, payments/agency reconciliation, California allocation, carryovers, basis by year, prior preparer versus current treatment.
- Prior-year comparison uses actual 2024 line-source mappings and effective firm variance criteria. Missing counterparts and changed numbered payer/detail meanings are not silently paired. Mileage/count measures are not flagged using a dollar threshold.
- Depreciation shows all nine computed assets, federal/California/AMT records, methods, lives, prior schedules, disposals and supplied recapture computation. No depreciation engine or new election result was written.
- The Schedule C bridge reconciles supplied book net income **89,834 + 12,400 − 19,180 − 1,200 = 81,854** original engine net profit. This is arithmetic reconciliation, not a corrected taxable-income computation. Each step links to its actual book/engine inputs.
- Basis history retains null 2023/2024 S-corp ending stock basis and missing partnership outside basis. D40's available K-1 does not prove a completed basis rollforward. The engine's opening stock basis remains separately labeled computed treatment. Related returns are evidence stubs, not fabricated dependent/entity return routes.
- `/firm/search`: authorized one-client global search, exact amounts, lines, documents, fields, printed pages, lots, assets, prior records and conversations with deep links. Unextracted M18 can be found as a printed-page hit, never as a fabricated extracted lot. Sensitive identifiers are masked for every role before matching/serialization; client identities cannot use firm search. Client search remains in shared Workflow.
- `/firm/admin`: administrator-only editable variance criteria, policy/checklist overlay, observed v3 issue/note status, budget vs logged time, and filtered/paginated audit metadata. Raw before/after payloads, private note bodies, session keys and packet bytes are excluded from access-log DTOs.
- `/firm/time`: staff record only their own manually entered actual work time in a supplied budget category. Only the firm administrator can retrieve all staff entries/totals. No effort is inferred from page views or budget. Categories without entries explicitly say no actual time recorded.
- `/coverage`: **68** original-brief requirement mappings: **34 implemented, 1 labeled source simulation, 15 partial, 18 limitations**. Each working mapping identifies a route and representative test file. Missing tax corrections/sign-offs, lifecycle functions, production URL and personal video are labeled rather than claimed complete.

## Sales detail and provenance

The packet has **302 Form 8949 computed lines**: **294 source-backed trades**, **one computed S-corp distribution entry**, and **seven category totals**. Source-backed trades are selected from actual lot-rule lines with extracted-value sources. Totals and the distribution entry remain visible as computed lines; they are not counted as brokerage/crypto transactions.

D74 contributes **260** trades. Its source totals reconcile exactly: proceeds **334,728.52**, basis **338,300.26**, wash adjustments **2,906.29**. Category/exception groups aggregate original values and engine gains. The supplied crypto **H/K** categories are preserved; no A–F-only assumption or outside tax classification replaces the packet.

The fixed-height sales window mounts at most **12 detail rows**, with filtering, search, keyboard scrolling/window controls, individual deep links and original source refs. Detail includes actual supplied dates, quantity/units when extracted, proceeds, basis, adjustments and original engine gain. Unextracted quantity is not invented. C6's basis/date stay unknown despite the engine's zero-basis treatment. D31 page 32/M18 stays an explicit unextracted evidence gap, not an invented extracted lot.

Bulk review saves `reviewed` / `needs_review` observations, reason, original source refs, actor/time and revisions in `sales_lot_review`. These are not field verification, tax adjustments or filing approval. Tax roles can write; administrator/client/future identities cannot. A stale selected row rejects the entire batch; concurrent writers get one winner and one 409. Audit and updates commit together. Staff polling notices lot/standards changes; the client cursor does not expose them.

## Resolver and persistence decisions

Added generic handling of the packet's actual `source_document` property. The prior memo's D07 link now resolves from that supplied field; the six `prior_preparer_depreciation_schedule` labels remain unresolved.

Two typed reference extensions reuse RFC 6901 and own-property lookup:

```text
computed:v3:/summary/...
computed:v3:/assets/...
computed:v3:/carryovers_out/...
computed:v3:/tax_effect_rates/...
household:/related_returns/...
household:/residency/...
```

Computed references read immutable supplied metadata, respect version availability and do not imply recalculation or new line provenance. Existing reference formats remain supported. New record/search/write APIs authorize session, role and engagement on the server. Record views and access-log reads append audit metadata before returning content.

Migration `0004_cpa_records.sql` adds independent lot review, standards and append-only manual time tables. It was applied to the development and dedicated `_test` databases. Standards begin from supplied defaults at revision 0; edits persist in an overlay and cannot disable hard-coded role/privacy/review-note enforcement. No original migration or source record was rewritten.

## Actual validation

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: **97 passed across 11 files**, including **33 new Phase 6 cases**.
- `npm run build`: passed production compilation, TypeScript and route generation.
- `npm run test:e2e`: **27 Chromium tests passed**, including **5 new Phase 6 browser flows**.
- `npm run validate:packet`: passed counts, graphs, typed references, named examples, alternatives and unchanged original bytes.
- `git diff --check`: passed.
- Read-only local HTTP check: `/firm` returned 200 and the current Phase 6 UI; the user’s port-3000 process remained running.

Every tax area has a pure resolver trace test and an actual browser source drill-down. Deep computation traces are followed through direct inputs when the bounded tree is collapsed/truncated. The 260-lot smoke test verifies cardinality, group totals, at most 12 mounted rows, last-window navigation, item/source links and an 8-second initial-table threshold. A separate repeated model/grouping smoke performs 50 full D74 passes under a 5-second bound; these are local smoke thresholds, not a production latency guarantee.

Integration tests use real PostgreSQL, not mocked persistence. They cover bulk atomicity and provenance, stale versions/batches, role/scope filtering, exact search amounts (excluding mileage/count fields), unextracted-page search, future evidence exclusion, masking, standards revisions and variance effects, manual time isolation, immutable entries and safe audit DTOs. Existing Phase 1–5 regression tests also passed. Browser tests exercise real forms, reload persistence, administrator boundaries, every source area, mobile layout and global search deep links. Desktop sales and mobile lot/area screenshots were inspected; artifacts are ignored.

Initial validation exposed assumptions about 8949 line categories/counts and an unhandled `source_document` relationship; the implementation was corrected to the actual packet. The initial browser trace test also stopped at a collapsed deep calculation tree; it now follows the same direct-input controls available to users until reaching printed evidence. No failed requirement was silently marked passed.

Original source integrity remains **1,943,262 bytes**, SHA-256:

```text
ee01f8508bd2fd9854754b82fd9c4a055bdc55e2778a132002a25381c412ad19
```

## Files changed

Created:

```text
db/migrations/0004_cpa_records.sql
src/lib/records/types.ts
src/lib/records/models.ts
src/lib/records/queries.ts
src/lib/records/search.ts
src/lib/records/coverage.ts
src/lib/firm/service.ts
src/lib/firm/search.ts
src/components/record-facts.tsx
src/components/sales-detail.tsx
src/components/firm-controls.tsx
src/app/engagements/[clientId]/[taxYear]/records/page.tsx
src/app/engagements/[clientId]/[taxYear]/records/[area]/page.tsx
src/app/firm/admin/page.tsx
src/app/firm/time/page.tsx
src/app/firm/search/page.tsx
src/app/coverage/page.tsx
src/app/api/engagements/[clientId]/[taxYear]/records/[area]/route.ts
src/app/api/engagements/[clientId]/[taxYear]/lot-reviews/route.ts
src/app/api/engagements/[clientId]/[taxYear]/time/route.ts
src/app/api/firm/admin/route.ts
src/app/api/search/route.ts
tests/records.test.ts
tests/records-operations.test.ts
tests/coverage.test.ts
tests/e2e/phase6.spec.ts
docs/PHASE_6_VALIDATION.md
```

Updated:

```text
src/app/engagements/[clientId]/[taxYear]/documents/page.tsx
src/app/globals.css
src/components/app-shell.tsx
src/lib/db/schema.ts
src/lib/evidence/references.ts
src/lib/evidence/resolver.ts
src/lib/evidence/queries.ts
src/lib/collaboration/service.ts
README.md
AI_USAGE.md
```

Generated `next-env.d.ts` production/development path changes are excluded. Package manifests and lockfile are unchanged.

## Assumptions, limits and readiness

Existing local PostgreSQL and three-second polling are retained. Source availability remains **2026-06-23T06:05:00Z**, independent of actual workpaper entry dates. No Supabase or other external service is configured or claimed. Local database access works; there is no missing local credential blocker. Production deployment was not requested or attempted, and the existing user development server was not stopped.

**Gate 6 is locally ready:** every explicitly named record has a real-data view or honest gap, every area has a tested source path, and large-detail navigation is practical. **Phase 7 has not started.** Tax corrections, verification, sign-offs/invalidation and bulk undo remain absent Phase 4 dependencies. Filing readiness, freezes, approval/e-signature, exports, amendments and planning require their later implementation and tests. Time entries and review observations are append-only/audited capabilities, not a complete billing system or full tax-review workflow. Stopped after Phase 6.
