# Deployment status and unblock checklist

**Actual status: NOT DEPLOYED. No public application URL is claimed.** The existing local app is at `http://127.0.0.1:3000`. This loopback address is reachable only on the developer's computer; it is not a submission URL. PostgreSQL persistence, signed role switching and the exact original packet are already present locally.

## Verified blockers

- No hosting project/configuration, Vercel CLI executable/authentication file, `VERCEL_TOKEN`, `VERCEL_ORG_ID` or `VERCEL_PROJECT_ID` was found in this workspace/session. No hosting account was changed or project created.
- No remote `DATABASE_URL`, Supabase project URL or Supabase access token is configured. The existing fallback `postgresql:///miraflores_workpaper?host=/tmp` is a local Unix-socket database and cannot serve a remote host.
- The working JSON has a pre-existing extra leading newline. Its SHA-256 is `975f9307b703888e8e44089b398d57157089bfa4a913c07aa85f299debbea7ef`; the original is `ee01f8508bd2fd9854754b82fd9c4a055bdc55e2778a132002a25381c412ad19`. The working file was preserved. Normal validation/import intentionally rejects changed bytes. The committed original and immutable database copy retain the correct hash.
- The current instruction prohibits Git commits/pushes. Changes are local and must be transferred through an authorized direct upload/CLI deployment, or committed by the human in a later authorized step. No Git action is required to deploy a reviewed local source directory.

Sites hosting was assessed as an alternative, but this existing Node.js Next/PostgreSQL application is not a prepared Sites Worker/static project. Substituting a static shell or migrating its framework/database would not deliver this application. No such substitution was made.

## Exact human unblock and release steps

1. Select a Node.js host/project that supports the existing Next.js Node runtime and an HTTPS URL. Provide its deployment access through that provider's supported login/secrets mechanism. Vercel or a conventional Node host can be used; no account or paid plan is assumed. Preserve this repository as the application root.
2. Provision reachable PostgreSQL (16+ compatible) and put its TLS connection URL in the hosting project's **server-only** `DATABASE_URL`. Do not use a `NEXT_PUBLIC_` variable, paste credentials into the video/chat, or commit an environment file. Configure network access and connection pooling for the host. Keep any migration credentials separate from least-privilege runtime access where the provider supports this.
3. Supply the exact delivered JSON to the release directory, without rewriting the user's working copy. A read-only way to obtain the verified committed original is:

   ```sh
   git show HEAD:data/okafor_lindqvist_2025_packet.json > /absolute/release-directory/data/okafor_lindqvist_2025_packet.json
   ```

   The destination must be a separate release copy. Include all current uncommitted application/doc changes there; `git archive HEAD` alone omits Phase 8. Confirm the original SHA-256 before importing. Do not relax the guard or import normalized JSON.
4. In that reviewed release directory, with the remote database URL supplied by the provider, run:

   ```sh
   npm ci
   npm run validate:packet
   npm run db:migrate
   npm run db:import
   npm run db:import
   npm run findings:generate
   npm run lint
   npm run typecheck
   npm run build
   ```

   The second import must report no duplicate import. Migrations are release operations, not request-time work. Retain `tsx` for migration/import commands (currently a dev dependency). A provider that installs production dependencies only needs a separate release stage with the full lockfile install.
5. For a conventional Node host, use `npm run start` with the provider's `PORT`. It now binds `0.0.0.0`; the development command remains loopback-only. Put HTTPS/reverse proxy and provider request limits in front of a self-hosted server. For a managed Next platform, use its Next.js build/runtime rather than exporting static HTML. Include the packet for import and all `docs/` artifacts/screenshots for handoff downloads; the dynamic handoff route declares output-file tracing includes.

   If the human selects Vercel, these are the concrete interactive CLI steps in the **reviewed release copy**, after completing the remote migration/import in step 4:

   ```sh
   npx vercel login
   npx vercel link
   npx vercel env add DATABASE_URL production --sensitive
   npx vercel deploy --prod
   ```

   Enter the remote database URL only at the CLI's secret prompt. Select the intended project and verify that it uses this application's root. These commands were documented, not executed; no project, secret or deployment was created in Phase 8. The final command must return a reachable HTTPS URL before the status can change to deployed.
6. Verify the **returned HTTPS URL**, not only a build message. In a fresh browser choose Priya, search `Okafor`, open CL-20417, and verify 72 currently available documents / 627 v3 lines, with full original inventory 74 / 199 / 3,012. Switch identities and confirm client APIs/search/internal-note reads fail. Verify signed session survives refresh.
7. Save one permitted overlay with a reason, refresh, then sign in again in a new browser session and read it back. If the provider permits it, restart/redeploy the application and verify the same PostgreSQL-backed record remains. Do not replace persistence with browser storage or ephemeral files. These **remote** persistence/redeploy checks are pending until hosting exists.
8. Test `F1040.2b → SchB.4 → SchB.2 → SchB.1.2 → ev-0538 → D29` and the reverse field-to-usage path; inspect D31 page 32. Exercise the labeled simulated filing flow only, then download the offline notice response after replaying `tl-29`. Reset the source clock to v3 for the evaluator and leave the packet unchanged.
9. Download the product page, findings, audit and screenshots from `/handoff`. Open the notice HTML with network disabled. Confirm HTTPS cookies, private/no-store responses, database connectivity and artifact presence on the actual host. Treat the role switcher as demonstration access to invented packet data, not production identity authentication or a home for real client records.
10. Record the applicant's personal video and verify its sharing permissions in a signed-out browser. Add the **actual app URL and actual video URL** to the final submission and update these status documents. Until then, report both as blocked/missing. No real IRS filing, regulated e-signature or tax accuracy claim belongs in the submission.

## Credentials and live verification still needed

The human must supply/select: hosting project/login, remote PostgreSQL connection and network access, the exact source release copy, public URL after a successful deployment, and a personally recorded video URL. Local tests do not prove those external steps. Phase 4 functional gaps remain in `REQUIREMENTS_AUDIT.md`; deploying does not complete them.

Current setup guidance was checked against the [official Next.js deployment guide](https://nextjs.org/docs/app/getting-started/deploying), [self-hosting guide](https://nextjs.org/docs/app/guides/self-hosting), [output tracing documentation](https://nextjs.org/docs/app/api-reference/config/next-config-js/output), [Vercel CLI deployment steps](https://vercel.com/docs/projects/deploy-from-cli), and [Vercel environment commands](https://vercel.com/docs/cli/env) through Context7 and installed Next.js docs. No external tax-law source was used.
