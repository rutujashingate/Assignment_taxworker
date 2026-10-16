# Miraflores Workpaper — Phase 3

A persistent workpaper for the one supplied Okafor–Lindqvist 2025 engagement. Review Desk now runs independent deterministic checks and saves issue triage with evidence, assignments and audit history. The searchable return, typed reference tracing, bidirectional Evidence Inspector and printed document pages remain available. Corrections, sign-offs and filing readiness are not built yet.

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

Choose **v3 · latest**, then **Tax Return**. Start at `F1040.2b` and follow `SchB.4 → SchB.2 → SchB.1.1 / SchB.1.2 → ev-0492 / ev-0538`. The inspector shows the actual D28/D29 printed interest fields, pipeline reading/confidence and a separate unrecorded human-verification status. To go in reverse, open **Documents**, search **D29**, open it and click its underlined interest field. **Tax line usage** links back to `F1040.2b` and the other actual dependent lines.

On **Review Desk**, seven independent checks produce six v3 findings and one passing W-2 control. They cover sweep interest, duplicate mileage pages, card receipts already in the books, payment-year designation, the unextracted M18 lot and the ambiguous donation. The 11 supplied engine diagnostics appear separately. Select an issue and open a source reference to inspect it beside the queue; filter by review state, blocker, tax area or assignee.

Preparer/reviewer/partner identities can save **Open**, **Investigating**, **Waiting**, **Explained**, or **Resolved with evidence** triage, with an active assignee and supporting references. State is shared per engagement and computed version; reviewers must select the same version to see the same triage. Waiting/explanation/resolution needs a reason; resolution needs source evidence. An ambiguous amount cannot be resolved by citing its own uncertain reading. Save conflicts return 409. Native POST forms also work without JavaScript. A saved disposition does not correct the immutable engine return or establish filing readiness.

Every available page is addressable, including `/engagements/CL-20417/2025/documents/D31?page=32`, which explicitly has no extraction. Printed text is preserved; the ambiguous D64 receipt is not rewritten to match the extraction. Source representations are simulated from packet text, with conservative literal-field matching and no invented PDF geometry.

The index reports full-packet **74 / 68 extracted / 2 partial / 4 not extracted** totals. At the fixed June 23, 2026 clock, **72** documents and **197** pages are accessible; two future records remain withheld. The pure resolver supports all 199 supplied pages when given the later availability date, but replay controls are outside Phase 2.

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
- Source access is staff-only and engagement-scoped on the server, including `GET /api/engagements/:clientId/:taxYear/evidence?ref=…`. Clients cannot retrieve workpaper evidence through direct requests. Uncleared staff receive masked SSNs, IP PINs, dates of birth and full account/routing numbers in both printed text and structured records. Source opens append a durable view audit before content is returned; a logging failure surfaces an error. No raw-packet, internal-note or export API is exposed.
- The typed resolver follows actual `inputs` and `sources`, handles all supplied reference families and RFC 6901 escaping, indexes direct and downstream usage, and returns explicit missing sources, cycles and display-limit states. Six prior-asset provenance labels remain unresolved. Field highlights require a unique literal reading tied to a printed label; uncertain matches stay at page level.
- Viewing preferences are per identity and engagement. Writes validate an expected revision, serialize competing changes and commit exactly one audit event with the update. A stale write returns 409.
- Independent findings and triage live in `workpaper_issue`, separately from original packet/engine records. First access creates missing findings with audit events; repeat checks preserve status unless the finding itself changes. Triage writes serialize competing changes, validate role/scope/version/assignee/evidence, and commit the update and audit atomically. Administrators can inspect tax findings; tax-review roles save dispositions. Clients cannot read internal findings or notes through APIs or pages.
- Engine versions and original values are immutable. No tax engine is rerun; no filing, signature or external integration is claimed.

Application source, runtime data, database migrations, scripts and tests live in the repository root. The original plans, prompts and assignment PDF remain in the ignored `Miraflores_Codex_Product_Engineering_Bundle/` reference folder.

See the original [data inventory](docs/DATA_INVENTORY.md), [Phase 1 report](docs/PHASE_1_VALIDATION.md), [Phase 2 report](docs/PHASE_2_VALIDATION.md), [Phase 3 report](docs/PHASE_3_VALIDATION.md), and local [execution playbook](Miraflores_Codex_Product_Engineering_Bundle/docs/Miraflores_03_Codex_Execution_Plan.md). Phase 4 corrections and sign-offs require a separate request.

## Documentation consulted

Current documentation was fetched with Context7 for [Next.js server authentication](https://nextjs.org/docs/app/guides/authentication), [Drizzle transactions](https://orm.drizzle.team/docs/transactions), [Tailwind's PostCSS installation](https://tailwindcss.com/docs/installation/using-postcss), [Zod](https://zod.dev/api), [Vitest configuration](https://vitest.dev/config/) and [Playwright web servers](https://playwright.dev/docs/test-webserver).
