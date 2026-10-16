# Phase 2 — Evidence tracing and source documents

Validated October 15, 2026. Phase 2 only; no full review workflow or issue checks were implemented.

## What works

The existing root Next.js/TypeScript/Tailwind/PostgreSQL/Drizzle application now has a searchable, paginated tax return, an Evidence Inspector, a searchable document index and a page viewer. Select a supplied staff identity, open CL-20417, choose v3, then open **Tax Return** or **Documents**. Taxpayer identities remain restricted.

The actual acceptance path works in both directions:

```text
F1040.2b $6,450 → SchB.4 → SchB.2
  → SchB.1.1 $1,840 → ev-0492 → D28 page 1
  → SchB.1.2 $1,840 → ev-0538 → D29 page 1

D29 → click its printed Box 1 interest field → ev-0538
  → direct SchB.1.2 usage → downstream SchB.2 / SchB.4 / F1040.2b
```

SchB.2 is an actual input that the illustrative prompt omitted. Relationships come from the selected version's original `inputs` and `sources`; document relationships are not hard-coded for these examples. Original engine values are unchanged.

## Resolver and source contract

- Typed parsing supports line keys, `ev-NNNN`, document IDs, `qa-NN`, `msg-NN`, `call-NN`, `py:` and `agency:` RFC 6901 pointers, `asset:`, `household:`, `ref:param.`, `ref:fx.`, `timeline:`, `doc:Dxx#pageN`, and timeline version identifiers. Pointer resolution respects own properties, escaped tokens and array-index syntax.
- The bidirectional index follows calculated inputs, direct evidence, extracted-value/page/document relationships, same-version assets with prior-year fallback, related source references and prior-return line-source mappings. It distinguishes direct from downstream line usage.
- Missing sources, invalid syntax, cycles and a bounded trace display are explicit. A truncated branch can be opened as its own reference. Six `prior_preparer_depreciation_schedule` provenance labels remain unresolved; no D07 mapping was invented.
- The v3 graph has 627 lines, 682 input edges and 2,015 direct source references. Tests resolve all actual line inputs/direct sources.
- Source pages render `printed_content`; templates cover information returns, business ledgers and statements, with a generic text fallback. Extracted values, text as read, pipeline confidence and human-verification status are separate. No verification actions are offered.
- Field links require a unique literal extraction reading and an anchored printed label, with no intervening field/value or sentence. Repeated, conflicting or unlocalized readings remain page-level evidence. No synthetic position is used as PDF geometry. D64 retains its ambiguous `$?,500.00` source while separately showing the pipeline's $1,500/41% reading.
- D30 and D31 page 32 remain accessible through page references and the page navigator, with explicit missing extraction. Their M18 printed proceeds/basis are not converted into an invented extracted lot. D30 is visibly superseded in v3.

## Availability, privacy and persistence

The source clock remains **2026-06-23T06:05:00Z**. Full delivered-packet counts are displayed separately: **74 documents, 199 pages, 68 extracted / 2 partial / 4 not extracted**. At this date the index exposes **72 documents and 197 pages**, with **67 extracted / 2 partial / 3 not extracted**. The two future records' names and contents are withheld. All 199 original pages are addressable by the pure resolver at the later test date; UI replay controls remain Phase 7 work. This resolves the tension between an all-document inventory and the packet's mandatory historical availability rule.

The staff-only data-access layer reads immutable projections in batches and applies engagement authorization. It never reads runtime data from the filesystem or sends a raw packet to the browser. The selected computed version comes from the existing persisted per-identity preference; v3 remains labeled latest. No original source or engine record is modified.

`GET /api/engagements/:clientId/:taxYear/evidence?ref=…` enforces the signed server session and staff/engagement access, returns a bounded inspection with safe trace summaries, and uses private/no-store responses. Clients cannot retrieve evidence through direct API requests or staff-page URLs. Uncleared staff receive masked SSNs, IP PINs, birth dates and full bank/account/routing numbers in printed text, extraction and nested referenced records. Future messages, documents, timeline entries and agency outcomes are filtered before reference resolution.

Each server evidence open appends an `evidence_viewed` event to the existing append-only PostgreSQL audit table, including actor, engagement, reference, selected version, clock and masking mode, without copying source values. Source links disable prefetching to avoid background source access. The page/API returns source content only after the audit insert succeeds; a real audit-insert failure is tested. No migration or new overlay table was necessary for this phase.

## Actual verification

| Check | Observed result |
|---|---|
| `npm run validate:packet` | PASS: exact bytes/hash, inventory, graphs, named examples and scenarios; source unchanged |
| `npm test` | PASS: 34 unit/integration tests in five files, including the 18 existing tests |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS: optimized production build, including new document and evidence routes |
| `npm run test:e2e` | PASS: 12 Chromium tests against the production server, including all seven Phase 1 regressions |
| Live app at `http://127.0.0.1:3000` | PASS: actual input/source clicks and document-to-return navigation, no observed browser page errors |
| Mobile document index | PASS: document width equals the 390px viewport after overflow fix |
| `git diff --check` | PASS |

New unit/integration coverage checks every reference family, RFC escaping/null/array/prototype boundaries, all v3 direct references, transitive reverse usage, version isolation, missing references, cycles/trace limits, all 199 page references, missing page extraction, literal source matching and rejected false highlights, immutable masking, role/scope denial, document states/availability, persisted view audit and actual logging failure.

New browser coverage follows the complete interest chain through both sources, returns from a printed D29 field to F1040.2b, searches/filters documents, opens D30/D31 page 32, checks the ambiguous receipt, rejects direct client and future-source requests, verifies uncleared masking, and uses keyboard activation at a mobile viewport.

The first browser pass found document-index horizontal overflow at 390px caused by a positioned screen-reader label outside the table's scroll container. The container now establishes its positioning context; the complete regression suite passed afterward. Desktop source and mobile inspector screenshots were generated and visually inspected (`test-results/phase2-interest-source.png`, `test-results/phase2-mobile-inspector.png`). These ignored artifacts are regenerated by the browser suite. No full accessibility audit, Firefox/WebKit or deployment testing is claimed.

## Files changed

New files:

```text
docs/PHASE_2_VALIDATION.md
src/app/api/engagements/[clientId]/[taxYear]/evidence/route.ts
src/app/engagements/[clientId]/[taxYear]/documents/[documentId]/page.tsx
src/components/document-page.tsx
src/components/evidence-inspector.tsx
src/lib/evidence/format.ts
src/lib/evidence/printed-fields.ts
src/lib/evidence/privacy.ts
src/lib/evidence/queries.ts
src/lib/evidence/references.ts
src/lib/evidence/resolver.ts
tests/e2e/phase2.spec.ts
tests/evidence-resolver.test.ts
tests/evidence-visibility.test.ts
```

Updated files:

```text
AI_USAGE.md
README.md
src/app/engagements/[clientId]/[taxYear]/documents/page.tsx
src/app/engagements/[clientId]/[taxYear]/layout.tsx
src/app/engagements/[clientId]/[taxYear]/return/page.tsx
src/app/engagements/[clientId]/[taxYear]/review/page.tsx
src/app/firm/page.tsx
src/app/globals.css
src/components/app-shell.tsx
src/lib/packet/schema.ts
```

## Assumptions, limitations and next phase

The existing stack, styles, package versions, importer and PostgreSQL schema were preserved. No dependency installation, environment changes, secrets, branch creation or deployment was needed. Local databases and the already-running development server were reused; tests use the isolated test database. No DB credential blocks local verification. External hosting/authentication remains unconfigured and was not attempted.

The return and printed-source views are read-only. Human verification is explicitly unrecorded. No independent checks, issue queue, correction, sign-off, assignment, client response, filing, export or tax-engine re-execution was implemented. Exact printed localization is intentionally conservative. Six prior-asset provenance gaps and other original evidence gaps remain unresolved. Display limits bound large traces; opening a reference continues inspection.

Source SHA-256 remains `ee01f8508bd2fd9854754b82fd9c4a055bdc55e2778a132002a25381c412ad19` (1,943,262 bytes).

**Gate 2: PASS. Next-phase readiness:** Phase 3 may start only when requested. Its independent checks can reuse the typed, version-aware resolver and evidence links; review workflow and corrections remain later-phase work. Stopped after Phase 2.
