# Miraflores Workpaper — Phase 1

A local, persistent foundation for the one supplied Okafor–Lindqvist 2025 engagement. Firm search, signed demo identities, scoped server access, immutable packet import and audited viewing preferences work. Review Desk shows a staff-only import overview. Later product features clearly say **not built yet**.

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

If the database already exists, skip `createdb`. Open **http://127.0.0.1:3000**. Leave **Start as** set to Priya Raman and click **Open workspace**. Search for Okafor, CL-20417 or 2025, or click **Open workpaper**. Review Desk displays the packet's imported document/page/value counts and original SHA-256. Change **Computed version**, wait for its saved revision, and refresh to confirm persistence. The header identity selector groups firm staff and restricted clients separately; choosing a client opens the unfinished client entry, where firm tools are unavailable.

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
- Client summaries and staff search use explicit response allow-lists. There are no raw-packet, source-page, internal-note or export APIs in Phase 1. Future source-reading routes must add masking and sensitive-view logging before exposing any packet content.
- Viewing preferences are per identity and engagement. Writes validate an expected revision, serialize competing changes and commit exactly one audit event with the update. A stale write returns 409.
- Engine versions and original values are immutable. No tax engine is rerun; no filing, signature or external integration is claimed.

Application source, runtime data, database migrations, scripts and tests live in the repository root. The original plans, prompts and assignment PDF remain in the ignored `Miraflores_Codex_Product_Engineering_Bundle/` reference folder.

See [data inventory](docs/DATA_INVENTORY.md), [validation report](docs/PHASE_1_VALIDATION.md) and the local original [execution playbook](Miraflores_Codex_Product_Engineering_Bundle/docs/Miraflores_03_Codex_Execution_Plan.md). Continue with **Phase 2 only** once Phase 1's gate passes.

## Documentation consulted

Current documentation was fetched with Context7 for [Next.js server authentication](https://nextjs.org/docs/app/guides/authentication), [Drizzle transactions](https://orm.drizzle.team/docs/transactions), [Tailwind's PostCSS installation](https://tailwindcss.com/docs/installation/using-postcss), [Zod](https://zod.dev/api), [Vitest configuration](https://vitest.dev/config/) and [Playwright web servers](https://playwright.dev/docs/test-webserver).
