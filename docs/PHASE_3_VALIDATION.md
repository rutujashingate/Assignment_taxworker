# Phase 3 — Independent checks and Review Desk

Validated October 15, 2026. Phase 3 only. **Gate 3: PASS.** Corrections, sign-offs and the full review workflow have not been implemented.

## Result and evidence

Review Desk runs seven deterministic checks over the selected immutable version and available evidence. v3 produces **six independent findings and one passing W-2 control**. The **11 supplied engine diagnostics** remain in a separate section and are not counted as independent findings. Removing diagnostics from a test fixture does not change check results. No LLM, tax-engine execution or external integration is used.

| Finding | Observed / reconciliation target | Outcome / certainty | Priority |
|---|---|---|---|
| Bank sweep overlap | D28/D29 each contribute $1,840 through distinct used Schedule B lines; same sweep account, owner, bank and year | Candidate / probable; CPA must confirm economic overlap | Blocking |
| Duplicate mileage page | D23 pages 2/3 have the same trip details; 11,800 reported, 8,100 unique page miles, 3,700 excess | Confirmed source mismatch / certain | Blocking |
| Card receipts in books | D14 revenue $151,300; D15 records the $12,400 Paywell receipts gross in sales; D21 is added to make SchC.1 $163,700 | Confirmed source overlap / certain; books total is before other possible adjustments | Blocking |
| California payment year | Used September 15 payment $3,500 is printed as designated to 2024; FTB 2025 total $10,500 versus return $14,000 | Confirmed reconciliation mismatch / certain; no credit transfer assumed | Blocking |
| M18 missing extraction | Active D31 page 32 prints $250 proceeds / $310 basis with no extraction; superseded D30 corroborates it | Confirmed extraction gap / certain | Warning |
| Handwritten gift | D64 prints `$?,500.00`; pipeline reads $1,500 with 41% confidence | Needs information / judgment; gift amount is not established | Blocking |

D09/D10 have matching employer, owner, year and W-2 boxes. F1040.1a uses D09's wage field once and excludes D10's field, so the W-2 control passes without creating an issue. Tests also make D10 used, and separately repeat D09's source reference, to verify that actual duplicate contributions are detected.

Checks return `key`, `code`, `version`, `inputRefs`, `observed`, `expected`, `outcome`, `severity`, `certainty`, `taxArea`, a plain-language explanation and an evidence action. Shared reconciliation helpers handle totals, differences, grouping and printed-trip identities. Northlake and receipt findings require identity/context and actual calculation usage; equal values alone do not establish duplicate income. Each v3 input/action reference resolves through the existing typed resolver.

## Review Desk and persisted state

The queue filters by **status, blocker, tax area and assignee**. Selecting an issue displays its reasoning and observed/expected facts. Source links open the existing Evidence Inspector beside the queue; direct inputs and printed fields continue to work there. Full return/document views remain available. Passing controls, supplied engine diagnostics and import metadata remain separately labeled.

Migration `0002_review_issues.sql` adds `workpaper_issue`; migration 0001 and all original source tables remain unchanged. Findings are keyed by engagement, computed version and stable issue key. First access creates missing findings and audit events transactionally. Repeat checks do not duplicate issues or reset triage. A changed finding fingerprint reopens its disposition and records the previous state in audit history.

Supported database states are **Open**, **Investigating**, **Waiting**, **Explained**, and **Resolved with evidence**. Triage stores assignee, reason, supporting references, revision, actor and timestamp. Writes and audit insert commit together. Competing updates receive a safe 409; audit insertion failure rolls back the actual update. Native HTML POST forms work without page JavaScript and redirect after a successful write. JSON requests retain inline errors and refresh behavior.

- Waiting, explanation and resolution require a reason of at least 10 characters.
- Resolution requires an available, issue-related source record; a computed line alone is insufficient.
- D64 cannot be marked resolved using its own uncertain extraction. Waiting/explained states are available; obtaining and attaching new clarification evidence is later-phase work. No client request is sent by setting Waiting.
- Dispositions are shared between staff viewing the **same computed version**. They do not alter engine values, remove source findings or establish filing readiness.
- Preparers, reviewers, partners and active quality reviewers may triage. Administrators may inspect but do not save tax-review dispositions. Only active, engagement-scoped tax-review identities are assignable; clients and future staff are rejected server-side.
- Client sessions cannot read internal findings/notes through the new API or page. Uncleared staff receive masked recognizable sensitive identifiers in notes, and cannot overwrite protected identifiers through a redacted note. Existing source masking and evidence view auditing remain in effect.

Interfaces:

```text
GET  /api/engagements/:clientId/:taxYear/issues
POST /api/engagements/:clientId/:taxYear/issues/:issueKey
```

The GET runs/synchronizes independent findings under server authorization and accepts the queue filters. POST validates a strict command with version, state, assignee, note, evidence refs and expected revision; it checks signed identity, engagement, tax-review role, same origin, current version and relevant evidence. Private/no-store responses apply to successes and errors. Internal notes are not exposed through the taxpayer workspace.

## Verification actually run

| Command / check | Result |
|---|---|
| `npm run db:migrate` | PASS: migration 0002 applied locally; test setup also applies/rechecks migrations in the isolated test DB |
| `npm test` | PASS: **51** unit/integration tests across seven files, including all 34 earlier cases |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS: optimized production build and route generation |
| `npm run test:e2e` | PASS: **17** Chromium tests, including all 12 earlier browser cases |
| `npm run validate:packet` | PASS: original bytes/hash, counts, graph references and examples; source unchanged |
| Live `http://127.0.0.1:3000` | PASS: six independent findings and issue evidence opened beside queue; no observed page errors |
| `git diff --check` | PASS |

Nine new pure-check tests cover contracts, every actual v3 source reference, deterministic reruns/reordered data/masked views, independence from engine messages, all six findings, counterexamples for equal amounts/different identity, unique mileage trips, source/usage context, correct tax-year designation and missing inputs, active versus superseded M18, unresolved gift amounts despite high confidence, and the W-2 negative control.

Eight new database tests cover idempotent initialization, shared triage/assignment/evidence, all five states, unchanged source/computed values, concurrent updates, role/assignee/evidence/version restrictions, refusal to resolve the ambiguous gift, note masking/protected-note preservation, and real audit failure rollback.

Five new browser cases cover queue/evidence/uncertainty, saved state across refresh and another reviewer with all four filters, closure guards/conflicting writes/client denial, native form persistence without JavaScript, and keyboard source access at a 390px viewport. Desktop and mobile screenshots were generated and visually inspected: `test-results/phase3-desktop-review.png` and `test-results/phase3-mobile-review.png` (ignored, regenerated QA artifacts).

Initial test assertions compared staff members with different persisted version selections and assumed v3's numbers/diagnostic count while one actor viewed v1. Test setup now explicitly selects v3 for v3 assertions and aligns reviewers' selected versions. The application preserves version scoping. A test-only `prefer-const` lint issue was corrected. Final checks passed. No full accessibility audit, Firefox/WebKit, production deployment or multi-machine load test is claimed.

## Files changed

New files:

```text
db/migrations/0002_review_issues.sql
docs/PHASE_3_VALIDATION.md
src/app/api/engagements/[clientId]/[taxYear]/issues/route.ts
src/app/api/engagements/[clientId]/[taxYear]/issues/[issueKey]/route.ts
src/components/issue-triage-form.tsx
src/lib/review/checks.ts
src/lib/review/issues.ts
src/lib/review/reconcile.ts
src/lib/review/types.ts
tests/e2e/phase3.spec.ts
tests/review-checks.test.ts
tests/review-issues.test.ts
```

Updated files:

```text
AI_USAGE.md
README.md
src/app/engagements/[clientId]/[taxYear]/layout.tsx
src/app/engagements/[clientId]/[taxYear]/review/page.tsx
src/app/globals.css
src/components/app-shell.tsx
src/components/evidence-inspector.tsx
src/lib/db/schema.ts
```

## Assumptions, remaining limits and readiness

The existing root stack, styles, package versions, immutable importer and evidence resolver were preserved. No packages, credentials, external services or environment changes were added. The supplied staff roles drive permissions; tax administrators are read-only for tax dispositions. Blocker severity is review priority, not a filing-readiness decision. Checks target the six supplied high-signal cases, not every possible tax error.

The source clock remains June 23, 2026. Future answers/documents are not used to settle current findings. The original six asset-provenance gaps remain disclosed. Human verification is still separate from issue disposition; original source fields and all computed versions remain unchanged. No correction, recalculation, sign-off, client message, attachment, filing action or full review workflow was added.

Local PostgreSQL is available; no missing credentials block this phase. No database was reset. Production hosting/authentication is not configured or attempted. Source SHA-256 remains `ee01f8508bd2fd9854754b82fd9c4a055bdc55e2778a132002a25381c412ad19` (1,943,262 bytes).

**Next-phase readiness:** Phase 4 may begin only when requested. The typed evidence links, independent finding contracts, persisted dispositions, revision checks and append-only audit are ready for non-destructive correction commands and stale sign-offs. Stopped after Phase 3.
