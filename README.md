# Miraflores Workpaper — Phase 8

A persistent workpaper for the one supplied Okafor–Lindqvist 2025 engagement. CPA Records provides 15 tax-area views with the existing Evidence Inspector, a virtualized sales browser and review overlay. Firm search, standards, audit-log metadata, actual work-time entry and requirement coverage are available. Review Desk and collaboration remain intact. History & Scenarios now compares v1/v2/v3, the five supplied alternatives, and a non-destructive season replay. Filing, amendments and exports are explicitly simulated. Phase 4 tax corrections/verification/production sign-offs remain unbuilt.

## Run locally

Requires Node 22.17+ and PostgreSQL 16+. Run from the main `Miraflores` repository directory, where `package.json` now lives:

```sh
npm ci
createdb miraflores_workpaper
npm run validate:packet
npm run db:migrate
npm run db:import
npm run dev
```

If the database already exists, skip `createdb`. Open **http://127.0.0.1:3000**. Leave **Start as** set to Priya Raman and click **Open workspace**, then **Open workpaper**. Your identity is the CPA; the engagement is the client. The header selector also offers restricted taxpayer identities for permission demonstrations.

Expand **Return version & data**, choose **v3 · latest**, then **Tax Return**. Start at `F1040.2b` and follow `SchB.4 → SchB.2 → SchB.1.1 / SchB.1.2 → ev-0492 / ev-0538`. The inspector shows the actual D28/D29 printed interest fields, pipeline reading/confidence and a separate unrecorded human-verification status. To go in reverse, open **Documents**, search **D29**, open it and select its linked interest field. **Tax line usage** links back to `F1040.2b` and the other actual dependent lines.

On **Review**, seven independent checks produce six v3 findings and one passing W-2 control. They cover sweep interest, duplicate mileage pages, card receipts already in the books, payment-year designation, the unextracted M18 lot and the ambiguous donation. The 11 supplied engine diagnostics appear separately. Select an issue and open a source reference to inspect it beside the queue; filter by review state, blocker, tax area or assignee.

Preparer/reviewer/partner identities can save **Open**, **Investigating**, **Waiting**, **Explained**, or **Resolved with evidence** triage, with an active assignee and supporting references. State is shared per engagement and computed version; reviewers must select the same version to see the same triage. Waiting/explanation/resolution needs a reason; resolution needs source evidence. An ambiguous amount cannot be resolved by citing its own uncertain reading. Save conflicts return 409. Native POST forms also work without JavaScript. A saved disposition does not correct the immutable engine return or establish filing readiness.

Open **CPA Records** for prior-year comparison, tax computation, the document index, depreciation, sales, Schedule C, rentals/passive losses, K-1s, retirement/foreign items, deductions/credits, payments/agency reconciliation, California allocation, carryovers, basis by year and prior-preparer treatment. Every area has a representative source trace using the existing resolver and Evidence Inspector. Book-profit reconciliation only compares supplied book and engine totals; it does not calculate a new return. Depreciation shows the actual federal/California/AMT regimes, methods, lives and dispositions. Unknown 2023 stock basis, partnership outside basis and absent related returns remain gaps/stubs.

In **Brokerage & crypto sales**, D74 has **260** trades. Across the packet there are **294 source-backed trades**, a separate computed S-corp distribution entry, and seven category totals: **302 Form 8949 lines** in all. Trade rows follow the actual `R-8949-LOT` source relationships; computed totals are not counted as transactions. Crypto retains the supplied **H/K** category codes. Choose category/exception groups, search a lot/amount, inspect any item and open its original source references. At most **12** detail rows mount at once; search, keyboard scrolling and window controls reach the whole list. Null crypto basis is displayed as unknown; M18 remains an explicit unextracted-page gap.

Select one or all matching lots and save a **bulk review observation** with a reason. Tax staff can persist `reviewed` / `needs_review` overlays with exact source refs and audit history. Revision conflicts reject the whole batch. These observations are not field verification, tax corrections or approval; bulk undo is not implemented. Changes update the staff engagement polling cursor without changing the client cursor.

Use **Search all records** (`/firm/search`) for household/ID/year, exact currency amounts, lines, documents/printed pages, lots, assets, prior records and authorized conversations. M18 can be found on its unextracted printed page without inventing a lot record. Search is engagement-scoped and identifiers are masked for every role before matching or serialization. Results link to actual records; future evidence is withheld. Client identities continue to use only the shared Workflow search.

Choose **Jo Kimura · firm administrator** to open `/firm/admin`: edit variance criteria, policy rules and the required-step checklist; inspect observed issue/note status, supplied budget vs manually logged time, and filtered/paginated audit metadata. Private before/after payloads and note bodies never appear in the access-log response. Core role/privacy/note-gate enforcement is independent of editable policy wording. Other staff can log **their own** actual time at `/firm/time`; only the administrator sees engagement-wide entries/totals. An empty category says no time recorded, not zero effort. Original budget and starting standards stay unchanged in the packet.

**Coverage** (`/coverage`) maps the original three-page brief to working routes/tests, the labeled simulated source renderer, partial capability or explicit limitation. It does not claim all assignment phases or handoff deliverables are complete.

The resolver additionally supports `computed:v3:/carryovers_out/...` (immutable supplied metadata, not re-execution) and `household:/related_returns/...` RFC 6901 pointers. The prior memo’s actual `source_document` link resolves to its supplied source; the six unresolved depreciation provenance labels are still unresolved.

Open **Tasks & Approvals** as Priya. Expand **Create a question, thread, task or review note**, click **Use real D64 donation question**, then **Create record**. This asks for confirmation of an actually ambiguous source; it does not assert a new tax fact. Switch to Ngozi (`cu-01`) to answer and attach evidence; switch back to Priya to see the dated answer, author and source links. Both supplied taxpayers share client-visible conversations. Internal threads and review notes are excluded from client responses, direct URLs, search, attachments and notification cursors.

As Daniel (`st-02`) or Helen (`st-03`), create an **internal review note**. An open note blocks the server-side review-note filing gate. Only reviewer/partner roles may close it, with a reason; preparers can reply. The gate does not mean other filing requirements have passed, and the separate Phase 7 simulation also enforces this gate. Tasks and conversation metadata support persisted assignments and due dates. The six supplied deadlines and starting preparer/reviewer/partner assignments are displayed separately from new tasks.

Attachments are retained in PostgreSQL, with SHA-256 checksums, rather than browser storage or a temporary server directory. Files support text, CSV, PDF, PNG and JPEG, up to 2 MiB each, and are served as downloads with authorization and view audit. Firm staff need sensitive-data clearance to upload/download files; both taxpayers may upload/download their explicitly shared attachments. Text notes are masked when serialized. New attachments are workpaper evidence, never fabricated original packet documents or OCR results.

**Live transport: polling fallback.** Engagement pages check an authenticated, non-cached endpoint every **3 seconds** while visible, and refresh on returning to the page. Notifications persist per recipient and can be marked read. Workflow conversations update across independent sessions; forms retain their original revision and draft. A stale save returns 409 rather than overwriting another person’s work. Elsewhere, a dirty form prompts for refresh rather than being replaced. Tradeoff: normal updates can lag by one interval plus network time, polling adds read load, and offline/hidden pages do not receive instantaneous push. There is no Supabase Realtime connection or external messaging integration.

New collaboration text is masked by default, including for cleared staff. Explicit protected-text/identifier reveals require server-verified clearance and append audit metadata before returning the value. Sensitive source-document views and attachment downloads are also logged. Source pages shown to already-cleared staff retain the original Phase 2 behavior, with audited views. Shared client source views use a separate, masked allow-list with no calculation trace or internal notes.

Source availability defaults to **June 23, 2026** and follows the shared season clock when replay changes it. New human activity carries its **actual UTC entry time**, separately from the replay source date; answers do not import later packet messages or alter engine results. Collaboration evidence references use `answer:<uuid>` and `attachment:<uuid>` in the authorized collaboration evidence endpoint. No computed tax-line usage is invented for a newly submitted answer.

**Phase dependency:** Phase 4 has not been requested or implemented. Two-window verification in Phase 5 covers edits/corrections to questions and notes, plus stale-write rejection. Tax-field correction propagation, sign-off invalidation and bulk undo still require Phase 4 and its own regression tests.

Every available page is addressable, including `/engagements/CL-20417/2025/documents/D31?page=32`, which explicitly has no extraction. Printed text is preserved; the ambiguous D64 receipt is not rewritten to match the extraction. Source representations are simulated from packet text, with conservative literal-field matching and no invented PDF geometry.

The index reports full-packet **74 / 68 extracted / 2 partial / 4 not extracted** totals. At the default June 23, 2026 clock, **72** documents and **197** pages are accessible; two future records remain withheld. The resolver supports all 199 supplied pages at the appropriate later dates, reached through the shared History & Scenarios replay controls.

Workspace entry and navigation also work without JavaScript: the identity form creates the same signed, audited session on the server, then redirects. The header provides a **Switch identity** submit button in that mode. Saving a computed-version preference requires JavaScript and displays a message when it is disabled.

The default connection is the local Unix-socket database `postgresql:///miraflores_workpaper?host=/tmp`, using your OS database user. To use another connection, provide `DATABASE_URL` to the process. `.env.example` documents the optional setting; no secret file is required. Migration/import commands read process environment variables; when using a connection other than the default, supply the same DATABASE_URL to each command and the app.

Signed cookies use per-session keys held in the database. Sessions expire after 24 hours, and changing identity revokes the old cookie. The selector intentionally lets evaluators choose seeded identities; this is **demo authentication**, not a public production login. Production deployment and external authentication are outside this phase and have not been performed.

## Verify

Use a separate test database; unit/integration tests refuse a database name without `_test`:

```sh
createdb miraflores_workpaper_test
npm run validate:packet
npm test
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm test` migrates/imports its isolated database automatically. Playwright starts a production server on port 3100 against that test database and stops it afterward. Optional `TEST_DATABASE_URL` overrides the test connection. It should point to a disposable database ending in `_test`; neither suite resets the development database. The e2e suite expects the test database initialized by `npm test`.

## Architecture and boundaries

- The original 1,943,262 JSON bytes are stored as BYTEA with a database SHA-256 check, beside JSONB and indexed projections. The importer requires the recorded source hash and is idempotent. Database triggers reject modifications to source projections and the append-only audit.
- All eight identities are seeded; only five staff and two clients are active at the fixed June 23, 2026 cursor. Signed HTTP-only cookies resolve identity server-side. No role header or client-supplied role is trusted.
- Source access is staff-only and engagement-scoped on the server, including `GET /api/engagements/:clientId/:taxYear/evidence?ref=…`. Clients cannot use the general evidence resolver. Only references explicitly shared on a client-visible conversation have a masked client projection. Uncleared staff receive masked SSNs, IP PINs, dates of birth and full account/routing numbers in both printed text and structured records. Source opens append a durable view audit before content is returned; a logging failure surfaces an error. No raw-packet API is exposed. Client-copy/notice exports are separately authorized masked projections; internal collaboration APIs enforce staff access before serialization.
- The typed resolver follows actual `inputs` and `sources`, handles all supplied reference families and RFC 6901 escaping, indexes direct and downstream usage, and returns explicit missing sources, cycles and display-limit states. Six prior-asset provenance labels remain unresolved. Field highlights require a unique literal reading tied to a printed label; uncertain matches stay at page level.
- Viewing preferences are per identity and engagement. Writes validate an expected revision, serialize competing changes and commit exactly one audit event with the update. A stale write returns 409.
- Independent findings and triage live in `workpaper_issue`, separately from original packet/engine records. First access creates missing findings with audit events; repeat checks preserve status unless the finding itself changes. Triage writes serialize competing changes, validate role/scope/version/assignee/evidence, and commit the update and audit atomically. Administrators can inspect tax findings; tax-review roles save dispositions. Clients cannot read internal findings or notes through APIs or pages.
- Engine versions and original values are immutable. No tax engine is rerun; no real filing, regulated signature or external integration is claimed.

Application source, runtime data, database migrations, scripts and tests live in the repository root. The original plans, prompts and assignment PDF remain in the ignored `Miraflores_Codex_Product_Engineering_Bundle/` reference folder.

See the original [data inventory](docs/DATA_INVENTORY.md), [Phase 1 report](docs/PHASE_1_VALIDATION.md), [Phase 2 report](docs/PHASE_2_VALIDATION.md), [Phase 3 report](docs/PHASE_3_VALIDATION.md), [Phase 5 report](docs/PHASE_5_VALIDATION.md), [Phase 6 report](docs/PHASE_6_VALIDATION.md), and local [execution playbook](Miraflores_Codex_Product_Engineering_Bundle/docs/Miraflores_03_Codex_Execution_Plan.md). Phase 4 corrections and sign-offs require a separate request.

## Documentation consulted

Current documentation was fetched with Context7 for [Next.js server authentication](https://nextjs.org/docs/app/guides/authentication), [Drizzle transactions](https://orm.drizzle.team/docs/transactions), [Tailwind's PostCSS installation](https://tailwindcss.com/docs/installation/using-postcss), [Zod](https://zod.dev/api), [Vitest configuration](https://vitest.dev/config/) and [Playwright web servers](https://playwright.dev/docs/test-webserver).

## Phase 7: history, replay and simulated filing

Open **History & Scenarios**. Compare immutable v1/v2/v3 metadata and per-line differences. Each of the five named scenarios displays its exact supplied `what_if.alternatives` result in isolation. The custom calculator uses only supplied per-dollar rates and changes no live state.

Daniel (`st-02`) and Helen (`st-03`) can move the shared season clock through all 29 supplied events or reset to v3 **2026-06-23T06:05:00Z**. Direct evidence/search/client-source APIs and exports use the same availability rules. D71 appears at `tl-22`; D72 appears at `tl-29`. Early dates show no computed return until March 4. Source records and original engine outputs never change. Human decisions keep actual timestamps. Later-dated simulation rows remain saved but are withheld when replay rewinds before their recorded source dates.

For a complete demonstration:

1. As Daniel, replay through `tl-20` (July 10 approval). As Priya, create a filing simulation.
2. Enter a reason for every evidenced simulation exception, optionally add separate modeled line changes with supplied rate categories, acknowledge the accuracy limitations, and save. Exceptions do **not** resolve Review Desk findings.
3. Switch to Daniel and Helen separately and approve the simulation in each role. The creator cannot approve their own work. As a taxpayer in **Workflow**, review original v3 amounts and separate estimates, then **Approve & authorize simulation**. Alternatively, a reviewer can explicitly link the now-available scripted `msg-09` authorization. Neither path is a regulated signature.
4. As Priya, submit the simulation. Open blocking review notes cannot be waived. Changes to modeled assumptions, review dispositions, lot reviews, firm standards, collaboration evidence or newly available packet evidence invalidate approvals before submission. Acknowledgments attach to the already-authorized submitted payload; later activity cannot replace it or strand its rejection. Blocking review notes still prevent acceptance.
5. Replay `tl-21`, then process the scripted response: federal **R0000-504-02**, California held. At `tl-22`, link D71's printed/extracted dependent-ID correction as a separate overlay; the original household entry remains unchanged. Renew approvals and resubmit.
6. At `tl-23`, process federal acceptance; the snapshot freezes. At `tl-24`, process California acceptance against that exact frozen snapshot. Server operations and database triggers reject edits. Later California acknowledgment does not replace the federally accepted proposal with a current workpaper view.
7. Create an amendment branch from an available accepted snapshot. Its modeled changes and numeric diff are independent of the parent. No amended-return acknowledgments are supplied, so original-return responses cannot be reused for amendments.
8. Download the masked client HTML. At `tl-29`, download the **self-contained offline Letter 566 evidence HTML**, containing printed pages, distinct unverified pipeline readings, dated answers, charity/receipts reconciliation and explicit substantiation gaps. It includes no external resources or scripts and is never sent to the IRS.

The readiness result is **simulation readiness**, not production tax readiness. Phase 4 verification, accurate corrections and production sign-offs do not exist. Explicit acknowledgment and evidence-backed exceptions let an evaluator exercise the scripted lifecycle while preserving this limitation. No engine re-execution or accurate final filed liability is claimed. See `docs/PHASE_7_VALIDATION.md` for actual verification and the source-byte discrepancy found at the start of this phase.

## Phase 8 submission and audit

Open **Submission & audit** (`/handoff`) as staff for authenticated downloads of the one-page product/model statement, deterministic findings, actual UI screenshots, every-requirement matrix, interaction audit, deployment checklist, video script and exact QA results. Client identities cannot access these internal submission artifacts. `docs/REQUIREMENTS_AUDIT.md` is generated from the same 70-row registry as Coverage; it explicitly records incomplete requirements. The complete original brief is **not** claimed fulfilled.

Generate/check the source-only reports with:

```sh
npm run findings:generate -- --canonical
npm run findings:check
npm run audit:generate
npm run audit:check
npm run validate:canonical
```

`--canonical` explicitly reads the committed original JSON and validates its SHA-256; it never changes the working file or relaxes import contracts. This matters because the user's pre-existing working-copy edit added a leading newline. `npm run test:canonical` executes the complete current Vitest unit/integration suite against a separate verified original copy, with symlinks to current source/tests and real isolated PostgreSQL persistence. Ordinary `npm run test` / `npm run validate:packet` correctly reject that edited working source; restore/supply the original through a reviewed release copy before a fresh import. No source bytes were silently normalized.

Phase 8 fixes unavailable filing/window controls and role combinations that could never obtain separate approvals. Production start now binds `0.0.0.0`; development stays on `127.0.0.1`. No deployment occurred: hosting access/project and a remote PostgreSQL connection are missing. See `docs/DEPLOYMENT_HANDOFF.md` for exact external steps and `docs/PHASE_8_VALIDATION.md` for actual commands/results. The personal 10–11 minute video script is not a recording or URL; the human applicant must record and share it. Phase 8 implementation was completed without committing or pushing; repository publication is a separate authorized step.

## Simplified CPA review flow

Open the household and choose **Review next issue**. Compare the reported value, supported value and difference, then open **View source evidence** when needed. **Explain** and **Assign** prepare a review-status edit; choose **Save review status** to persist it. **Request information** opens a linked question draft in **Tasks & Approvals**; **Create record** actually saves and shares it. Source corrections and formal **Submit for review** remain unavailable.

The primary navigation is **Review / Tax Return / Documents / Tasks & Approvals / History**. **More tools** retains CPA Records, search, time, administration, Coverage and submission downloads. See [UX validation and before/after screenshots](docs/UX_SIMPLIFICATION_VALIDATION.md) for exact changes, tests and limits.


## Click an amount to trace it

In **Tax Return**, select a displayed amount (for example **$6,450**); the inspector shows its actual input amounts and supporting records. Search accepts formatted amounts such as `$6,450`. Follow input amounts to a linked source field; the selected field is brought into view and receives keyboard focus. If it cannot be localized, the actual page is shown without a false highlight. Use **Tax line usage** to return from the document to its tax destinations; selecting a standalone document field jumps directly to that usage section. The search stays in place during the trace. **Return to line list** and **Selected amount & evidence** provide navigation on smaller screens.

Review figures open their existing related reference or the complete reconciliation; unknown amounts remain unlinked. Sale proceeds/basis link to the supplied extracted fields, while gain links to the original calculation. Original computed amounts, source text and permissions are unchanged. Links use backgrounds, borders, hover and keyboard focus instead of underlines.

The latest complete 80-item checklist audit and remaining limitations are in [UI_UX_CHECKLIST_AUDIT.md](docs/UI_UX_CHECKLIST_AUDIT.md). Formal human verification, source corrections and production sign-offs are still not implemented.
