# Phase 0 data inventory and Phase 1 decisions

Source precedence: original three-page company assignment, original JSON and embedded README, product plan, engineering plan, execution playbook. This inventory records source facts, not completed product capabilities.

## Original workspace

The delivered bundle contained START_HERE, three Markdown plans, the original assignment PDF and the JSON packet. No application, package scripts, styles, tests, database configuration or Git repository existed. Phase 1 uses this bundle as its app root without moving or modifying those six files.

Available tooling: Node 22.17.1, npm 10.9.2 and local PostgreSQL 16.14. PostgreSQL was reachable before implementation. Docker and pnpm were unavailable. No application DATABASE_URL or session-signing environment variable was configured.

## Verified original packet

File: `data/okafor_lindqvist_2025_packet.json`; 1,943,262 bytes.

SHA-256: `ee01f8508bd2fd9854754b82fd9c4a055bdc55e2778a132002a25381c412ad19`.

| Record | Count |
|---|---:|
| Genuine engagement | 1: CL-20417, 2025 joint federal/California |
| Documents / textual pages | 74 / 199 |
| Extracted values | 3,012 |
| Extracted / partial / not extracted documents | 68 / 2 / 4 |
| v1 / v2 / v3 return lines | 625 / 625 / 627 |
| Staff / client users | 6 / 2 |
| Questionnaire / messages / call notes | 45 / 10 / 1 |
| Timeline events / exact what-if alternatives | 29 / 5 |
| D74 sales lots | 260 |
| Engine parameters / rules | 40 / 97 |

Top-level keys: `packet`, `readme`, `household`, `documents`, `extracted_values`, `client`, `firm`, `prior_years`, `tax_agency_records`, `timeline`, `engine_reference`, `return_versions`, `what_if`, `planning_reference_2026`, `post_filing_rates`, `fx_rates`.

Alternatives: `equipment_section179`, `equipment_no_bonus`, `hvac_improvement`, `standard_deduction`, `penalty_annualized`. All five base summaries, changed-line starting values and tax deltas agree with v3. The annualized alternative has no changed lines or tax delta; display the supplied result honestly.

Reproduce with `npm run validate:packet` (Python standard library only). The validator hashes bytes before parsing, checks every document/value relationship, traverses all version line graphs, checks structured references and named examples, validates scenario consistency and rechecks original bytes. The importer also requires the exact source hash. PostgreSQL stores original BYTEA separately from JSONB; JSONB cannot preserve delivered bytes. Specifically, 48 negative-zero numeric values become zero in the query projection; the original `-0` representations remain recoverable from BYTEA.

## References and calculation graphs

| Format | Meaning |
|---|---|
| `ev-NNNN`, `D01`–`D74` | Extraction and document |
| `qa-NN`, `msg-NN`, `call-NN` | Questionnaire, message and call evidence |
| `py:/…`, `agency:/…` | RFC 6901 pointer; decode `~1` then `~0` |
| `asset:<id>` | Same-version asset, then prior-year asset |
| `household:<id>` | Household member |
| `ref:param.<name>`, `ref:fx.SEK.<rate>` | Engine parameters and exchange rates |
| `timeline:<id>` | Scripted event; extension ID is `extension-2026-04-14` |
| `doc:<id>#page<n>` | Document page, including unextracted pages |
| Form/line key | Input line in the selected version |

Timeline refs also contain plain `v1`/`v2`/`v3`; actor IDs point to staff. Prior-year `return_2024.line_sources` contains 106 scalar reference strings, not arrays.

| Version | Computed at (UTC) | Input edges | Source edges |
|---|---|---:|---:|
| v1 | 2026-03-04 09:12 | 680 | 2,006 |
| v2 | 2026-03-19 07:40 | 680 | 2,006 |
| v3 | 2026-06-23 06:05 | 682 | 2,015 |

All version input/source references, line rules, timeline refs and prior-year line sources resolve, with no calculation cycles. No version uses documents received after its computation.

**Disclosed provenance gap:** all six `prior_years.asset_records[*].sources[0]` contain `prior_preparer_depreciation_schedule`. This label has no exact document/page reference. Preserve and display it as unresolved; do not invent a mapping to D07. Asset IDs: SAC-BLDG, SAC-APPL, SAC-ROOF, AUS-BLDG, AUS-FLOOR, STU-LAPTOP.

## Verified discrepancies and negative case

- **Interest:** actual path is `F1040.2b → SchB.4 → SchB.2 → SchB.1.1/SchB.1.2 → ev-0492/ev-0538 → D28/D29 p1`. The illustrative playbook omits SchB.2. Both $1,840 items cite the same Northlake sweep account ending 7731, year and owner. Both extractions have 0.99 confidence; CPA disposition remains separate.
- **Mileage:** D23 p2/p3 have identical trip details after the second-scan annotation. Page totals 2,600 + 3,700 + 3,700 + 1,800 = 11,800; unique pages total 8,100; excess 3,700.
- **Receipts:** D14 p1 books income is $151,300; D15 p3 says $12,400 through Paywell is already recorded; D21 p1 reports that same amount. SchC.1 is $163,700. Evidence supports an overlap finding rather than matching on amount alone.
- **Payment year:** D68 p1 / ev-1076 designate the September $3,500 payment to 2024. FTB's 2025 account totals $10,500; F540NR.72 reports $14,000. Payment designation is a code string, not a date-year inference.
- **Missing extraction:** D30/D31 p32 contain M18, $250 proceeds / $310 basis (arithmetic loss $60), with zero extracted fields. Use page refs, no invented ev IDs. D30 is superseded by D31 and must not create a second missing-lot correction.
- **Donation:** D64 p1 says `$?,500`; ev-1049 reads $1,500 at 0.41. Later msg-08 confirms $1,500, but is unavailable at the default date.
- **Passing W-2 case:** F1040.1a uses D08 and D09; D10 is another image of D09 and correctly not counted twice.

## Historical availability and limitations

Default cursor is **2026-06-23T06:05:00Z**, not the computer's date. At this point 72 documents, six messages, 17 timeline events and five staff are available. Seed all eight identities but do not offer Sam Adeyemi before 2027-01-04.

Later records: msg-07 (2026-06-30 crypto clarification), msg-08 (2026-07-01 donation confirmation), msg-09 (2026-07-10 approval), msg-10 (2026-07-13 dependent ID correction), D71 (2026-07-13 19:02 UTC), later e-file outcomes, the 2026-08-03 IRS snapshot, Sam in 2027, and D72 (2028-01-26 15:00 UTC). D72 is printed January 20 but is not available until received. Filter agency arrays element by element; resolving `agency:/efile` must not expose future entries.

The printed page text, fallible extraction, immutable engine results and human decisions are separate layers. Positions are synthetic, not scan geometry. There is no callable engine, OCR pipeline, live IRS service or regulated signature provider. Use packet rates only for labeled custom estimates, and exact supplied alternatives for named scenarios. Missing basis years and related-return gaps remain missing. Filing simulation cannot imply recomputed liability.

## Prioritized coverage and phase sequence

| Priority | Original requirement | Phase | Phase 1 status |
|---|---|---:|---|
| P0 | Persistent source import, roles, engagement search | 1 | Implemented foundation; see validation report |
| P0 | Bidirectional tracing and source rendering | 2 | Explicit placeholder |
| P0 | Independent checks / review queue | 3 | Explicit placeholder |
| P0 | Corrections, verification, audit, stale sign-offs, bulk undo | 4 | Review commands deferred; preference audit implemented |
| P0 | Questions, evidence attachments, blocking notes, concurrency | 5 | Restricted client entry; collaboration deferred |
| P1 | CPA records, judgment/completeness, firm controls | 6 | Deferred |
| P1 | Scenarios, timeline, filing, amendments, notice export, planning | 7 | Deferred |
| P0 delivery | Live URL, concept/data-model page, findings, personal video, AI disclosure | 8 | Deferred |

## Phase 1 architecture decisions

Use npm, Next.js App Router, React, strict TypeScript, Tailwind, PostgreSQL, Drizzle, Zod, Vitest and Playwright. Current docs were fetched with ctx7 before implementation; exact dependencies are pinned and package-lock retained. No pre-existing app conventions required preservation.

Use isolated local `miraflores_workpaper` and `miraflores_workpaper_test` databases; no cloud service or deployment is required for this phase. Original-byte import is transactional and keyed by SHA-256. Immutable imported projections have database triggers rejecting update/delete/truncate. App-created preferences and sessions are separate. Audit records are append-only.

Signed demo cookies carry an opaque session ID and HMAC; each session's signing key and identity live only in PostgreSQL. No secret file or external credential was created. Switching revokes the previous session. This remains demo identity selection, not production authentication.

Every implemented read/write checks server identity, engagement and availability. Clients cannot call staff search, statistics or preferences. Returned objects use explicit field allow-lists; source data is not exposed by Phase 1 APIs. Source-page redaction, sensitive reveals and view logs must be implemented before source-reading features in Phase 2/5.

Preference writes require expectedRevision and commit the new revision plus audit event in one transaction. A scoped transaction lock also protects first insert; conflicting requests get 409. Readiness says “Review not evaluated”; no fabricated blockers or approvals are seeded.

Only Phase 1 is implemented. Gate 2 requires a generic typed resolver and source viewer, including explicit missing_source for the six provenance labels.
