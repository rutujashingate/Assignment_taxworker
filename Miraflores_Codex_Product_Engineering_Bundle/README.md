# Miraflores Workpaper — Phase 1

A local, persistent foundation for the one supplied Okafor–Lindqvist 2025 engagement. Firm search, signed demo identities, scoped server access, immutable packet import and audited viewing preferences work. The five engagement destinations clearly label later features as **not built yet**.

## Run locally

Requires Node 22.17+ and PostgreSQL 16+. Run from this directory:

```sh
npm ci
createdb miraflores_workpaper
npm run validate:packet
npm run db:migrate
npm run db:import
npm run dev
```

If the database already exists, skip `createdb`. Open **http://127.0.0.1:3000** and choose Priya Raman in the demo identity selector. Search for Okafor, CL-20417 or 2025; open the engagement and change the computed version. Refresh to confirm persistence. Choose a client identity to inspect the restricted client entry.

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

See [data inventory](docs/DATA_INVENTORY.md), [validation report](docs/PHASE_1_VALIDATION.md) and the original [execution playbook](docs/Miraflores_03_Codex_Execution_Plan.md). Continue with **Phase 2 only** once Phase 1's gate passes.

## Documentation consulted

Current documentation was fetched with Context7 for [Next.js server authentication](https://nextjs.org/docs/app/guides/authentication), [Drizzle transactions](https://orm.drizzle.team/docs/transactions), [Tailwind's PostCSS installation](https://tailwindcss.com/docs/installation/using-postcss), [Zod](https://zod.dev/api), [Vitest configuration](https://vitest.dev/config/) and [Playwright web servers](https://playwright.dev/docs/test-webserver).
