# Phase 7 validation and handoff

Phase 7 implements history, scenarios, a shared source clock, an internal simulated filing lifecycle, isolated amendments and offline evidence exports. No real tax engine, IRS transmission, regulated signature, deployment or next-year return was added.

## Behavior delivered

- `/engagements/CL-20417/2025/history`: actual v1/v2/v3 `computed_at`, triggers, original `changes_from_previous`, and added/removed/changed line records with input/source changes. Comparisons do not change the selected engine version.
- All five exact packet alternatives have named federal/California outcomes, supplied deltas and original changed-line records. Custom estimates use only supplied `tax_effect_rates`; neither calculator nor scenario selection changes live engine/workpaper state.
- Twenty-nine ordered event controls persist an audited, revision-checked engagement source clock. Default is `2026-06-23T06:05:00Z`. Available documents are 72 at default, 73 after D71 and 74 after D72. Evidence resolution, search, shared client evidence, staff activation, versions and exports obey the cursor. Future event payloads are withheld; navigation exposes only their dates/IDs until available.
- New filing simulations, assumptions, source-backed exceptions, approvals, source identity correction and state transitions persist in PostgreSQL with audit events and revision conflicts. Reviewer and partner approvals are separate and cannot be supplied by the creator. Client authorization displays original v3 amounts and separate estimates. The optional packet-scripted authorization is explicitly labeled.
- Simulation readiness requires explicit accuracy acknowledgment, recorded exceptions for outstanding independent findings, current separate approvals and no open blocking review note. Exceptions leave Review Desk findings unresolved. Relevant evidence/overlay/policy changes invalidate proposal fingerprints. Shared transaction locks serialize filing with collaboration, review, lot-review and standards writes.
- Scripted flow uses the supplied agency records: federal `R0000-504-02`, California `STATE-HOLD`, D71 correction to `household:theo` through `ev-1080`, federal acceptance and California acceptance. Sensitive clearance is required to apply the separate identity overlay; the source household and extracted records never change. Sensitive use is logged and displayed identifiers are masked.
- Federal acceptance freezes the snapshot. California acknowledgment attaches to the identical frozen proposal. Database triggers reject snapshot changes, accepted-row updates/deletes and truncation; events are append-only. Snapshot hashes use canonical JSON and are checked before responses/exports.
- Amendment branches inherit the frozen parent's modeled assumptions/identity overlay, then keep independent revisions and numeric line deltas. Original-return agency acknowledgments cannot be reused to claim amended acceptance.
- Replay never deletes human decisions. Simulations whose recorded source dates are later than the cursor are withheld from reads, actions and client exports until the clock advances again.
- `/workflow` supplies the restricted client's demonstration authorization. Client responses omit internal exceptions, reasons, notes, approvals by staff and raw snapshots. The masked client HTML uses an explicit allow-list.
- The Letter 566 export is unavailable before D72. Its self-contained HTML embeds printed charity/receipts pages, separate unverified readings/confidence, stock/vehicle substantiation, D14/D15/D21 reconciliation and the NEC/book bridge, later donation confirmation, linked dated answers, source references, snapshot summaries and explicit gaps. It contains no external assets/scripts and is a draft for CPA review, never an IRS submission.
- Coverage/README/AI disclosure reflect actual implementations and remaining limitations.

## Assumptions and scope decisions

1. Existing Next.js/React/strict TypeScript/Tailwind, Drizzle/PostgreSQL, Vitest and Playwright conventions were preserved. No dependencies, credentials, branches or environment configuration were added.
2. Replay is shared by this one engagement. Reviewer/partner/quality-reviewer roles control it; actual human activity retains real entry timestamps. Prior to the first computation, indexed return/source views show an explicit unavailable state, while History and Workflow remain accessible.
3. Phase 4 was never implemented. This phase's proposal-level approvals are simulation attestations, not completed production verification, due diligence or per-dependency sign-offs. No accurate final tax liability is asserted. Original v3 summary/lines remain separate from modeled deltas and estimates. An explicit simulation acknowledgment is always required.
4. The packet's future approval and acknowledgments are replay evidence, not real integrations or fabricated successful actions. No amended-return acknowledgments exist; amendment acceptance is therefore unsupported.
5. No source file was rewritten. A pre-existing local leading blank line was found before implementation and preserved, including when committing this phase's code.

## Actual verification

| Check | Result |
|---|---|
| Migration `0005_season_and_filing.sql` | Applied successfully to development and isolated test PostgreSQL databases |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS, including new dynamic routes |
| Vitest, complete suite against verified original bytes | **110 tests passed, 12 files** |
| `npm run test:e2e` | **30 Chromium tests passed**, including all earlier phases; 1.8 minutes |
| Phase 7 browser rerun after outcome/rejection presentation update | **3 passed**, 40.2 seconds |
| Offline browser | Downloaded Letter 566 HTML opened with browser network disabled; source evidence rendered and no script/iframe/remote stylesheet existed |
| Desktop/mobile | Screenshots inspected; 390px viewport had no horizontal page overflow |
| Existing local development server | `/firm` returned HTTP 200; user-owned port 3000 server was left running |
| `git diff --check` | PASS |
| Root `npm run validate:packet` | **FAIL: pre-existing byte mismatch**, correctly rejected by the source guard |
| Read-only validator against separately copied committed original | PASS: counts, reference graphs, scenarios, examples and unchanged original SHA-256 |

The exact-byte suite was run from `/tmp/miraflores-phase7.C08PjT/fixture`, with symlinks to the current repository's source/tests/migrations/docs and a separate `git show HEAD:data/okafor_lindqvist_2025_packet.json` copy. Invocation: the repository's `node_modules/.bin/vitest run --config /Users/rutujashingate/Downloads/Miraflores/vitest.config.ts`. This ran the real tests against real PostgreSQL, including immutable import contracts; no persistence or tax engine was mocked. The same committed bytes are already stored unchanged in `packet_import.raw_bytes`. The validator itself was copied outside the repository so its relative source path selected that verified copy. Import guards were not weakened.

Original/canonical packet: 1,943,262 bytes; SHA-256 `ee01f8508bd2fd9854754b82fd9c4a055bdc55e2778a132002a25381c412ad19`.

Pre-existing working copy: one extra leading newline; SHA-256 `975f9307b703888e8e44089b398d57157089bfa4a913c07aa85f299debbea7ef`. JSON records are identical. Normal fresh import and root exact-byte tests remain blocked until that user edit is restored to the supplied original. The existing database/application works. This modified JSON is excluded from the Phase 7 commit; the committed source remains canonical.

Tests cover actual version differences, all five complete scenario outputs and isolation, rate estimates, event order, source/identity availability, server role filtering, signature-PIN masking, approval invalidation, unwaivable notes, exact rejection/correction/acceptance, original-household preservation, canonical snapshot hashes, SQL/API freeze, amendment independence, rewind privacy and offline/client export evidence/privacy. Existing tests also retain the v3 interest trace, document page fallback, review states, two-window collaboration, 260-lot performance and firm access controls.

## Files changed

- `AI_USAGE.md`
- `README.md`
- `db/migrations/0005_season_and_filing.sql`
- `docs/PHASE_7_VALIDATION.md`
- `src/app/api/engagements/[clientId]/[taxYear]/exports/route.ts`
- `src/app/api/engagements/[clientId]/[taxYear]/filings/route.ts`
- `src/app/api/engagements/[clientId]/[taxYear]/season/route.ts`
- `src/app/coverage/page.tsx`
- `src/app/engagements/[clientId]/[taxYear]/documents/[documentId]/page.tsx`
- `src/app/engagements/[clientId]/[taxYear]/documents/page.tsx`
- `src/app/engagements/[clientId]/[taxYear]/history/page.tsx`
- `src/app/engagements/[clientId]/[taxYear]/layout.tsx`
- `src/app/engagements/[clientId]/[taxYear]/records/[area]/page.tsx`
- `src/app/engagements/[clientId]/[taxYear]/return/page.tsx`
- `src/app/engagements/[clientId]/[taxYear]/review/page.tsx`
- `src/app/engagements/[clientId]/[taxYear]/workflow/page.tsx`
- `src/app/firm/page.tsx`
- `src/app/globals.css`
- `src/components/app-shell.tsx`
- `src/components/filing-panel.tsx`
- `src/components/season-desk.tsx`
- `src/components/source-date-unavailable.tsx`
- `src/components/version-picker.tsx`
- `src/components/workflow-desk.tsx`
- `src/lib/auth/permissions.ts`
- `src/lib/auth/session.ts`
- `src/lib/collaboration/service.ts`
- `src/lib/engagements/queries.ts`
- `src/lib/evidence/privacy.ts`
- `src/lib/evidence/queries.ts`
- `src/lib/firm/service.ts`
- `src/lib/records/coverage.ts`
- `src/lib/records/queries.ts`
- `src/lib/review/issues.ts`
- `src/lib/season/clock.ts`
- `src/lib/season/exports.ts`
- `src/lib/season/models.ts`
- `src/lib/season/service.ts`
- `src/lib/workpaper/preferences.ts`
- `tests/authorization.test.ts`
- `tests/coverage.test.ts`
- `tests/e2e/phase7.spec.ts`
- `tests/season.test.ts`

## Remaining limitations and next-phase readiness

Gate 7 is verified for an explicitly labeled local simulation. The code is ready for a delivery/handoff phase without adding tax/filing claims. Phase 8 has not started. Production tax readiness remains blocked by missing Phase 4 verification/corrections/sign-offs and unresolved underlying evidence. Real e-file, regulated signatures, actual amendments, next-year computation and production identity/hosting integrations are absent by scope. Local PostgreSQL works; no local DB credentials are missing. No production deployment or cloud credentials were used. The pre-existing source-byte discrepancy must be corrected before a fresh local import/exact-byte test run from the main directory.
