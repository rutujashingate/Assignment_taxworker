# CPA workpaper UX simplification

The primary flow is now **open household → Review next issue → compare reported/supported/difference → open evidence if needed → explain, assign or request information**. This change simplifies the presentation and uses the existing persistent operations; it does not complete the missing tax-correction/review-sign-off phase.

## What changed

- The five primary workpaper destinations are **Review, Tax Return, Documents, Tasks & Approvals, History**. Original URLs are unchanged. CPA Records, global search, time, administration, Coverage and Submission & audit remain under **More tools**. The administrator link remains role-specific; clients retain their restricted workspace.
- The household context is compact. The three large repeated data cards were removed; counts and the working version selector remain in the collapsed **Return version & data** disclosure. The role selector remains visible, including while the page scrolls.
- Review leads with attention/waiting counts and a recommended next issue. Selection favors unresolved, actionable work and the current user's assignments, without changing any check severity or state. Explained/resolved items remain accessible in a separate disclosure and through existing filters.
- Each issue presents **What happened**, **Reported value**, **Supported value**, **Difference to review**, a qualification and a next step. Donation uncertainty and suspected interest duplication remain uncertain; book/agency comparisons are not presented as corrected tax liabilities.
- **View source evidence** opens the actual linked inspector on demand; **Close evidence and return to issue** returns to the selected issue. Source cards use the actual typed resolver/document/page relationships. Opening a source retains the existing audited-view behavior. Printed content, extraction and human verification remain distinct.
- **Request information** opens a prefilled, source-linked question in Tasks & Approvals. Nothing is created until **Create record** succeeds. The draft explicitly identifies client sharing and does not silently change the issue state. The client can read and answer the saved question using the original permissions/APIs.
- **Explain** focuses the review note and selects Explained; **Assign** focuses the assignee. Both require **Save review status** to persist through the existing revision-checked/audited endpoint. Existing status choices, resolution evidence requirements, errors, 409 conflicts and native no-JavaScript POSTs remain available.
- Filters, import provenance, raw check code/certainty/facts, calculation messages and inspector technical details are collapsed by default. Normal source/return views retain their full inspector. Typography, contrast, spacing, focus outlines, selected outlines, text status labels and mobile density were improved within the existing palette/components.

## Before / after evidence

Actual Chromium captures, not generated mockups. Both sets use the supplied uncleared staff identity `st-04` and the same one-household test database/default v3 source date; unrelated test collaboration/notification counts can vary. Source identifiers remain masked. Human usability certification is not claimed.

| View | Before | After |
|---|---|---|
| Review, desktop 1440×1050 | [Before](screenshots/ux/before-review-desktop.png) | [After](screenshots/ux/after-review-desktop.png) |
| Selected payment issue, desktop | [Before](screenshots/ux/before-issue-desktop.png) | [After](screenshots/ux/after-issue-desktop.png) |
| Review, mobile 390×844 | [Before](screenshots/ux/before-review-mobile.png) | [After](screenshots/ux/after-review-mobile.png) |
| Tablet 1024×900 | — | [After](screenshots/ux/after-review-tablet.png) |
| Source opened explicitly | — | [After](screenshots/ux/after-evidence-desktop.png) |

The after-capture browser test also verifies the recommended action is inside the initial viewport at desktop/tablet/mobile sizes, that keyboard focus is visible, and that the role selector remains in the viewport after opening evidence. The [screenshot manifest](screenshots/ux/manifest.json) records the eight PNG hashes, viewports, masked identity, source date and reproducible routes. Codex visually inspected the desktop review/detail/evidence and mobile captures; this is agent review, not a human CPA usability study.

## Verification

Tests use the production Next server on port 3100 and the real isolated PostgreSQL test database. The user's existing port-3000 development server and application database are not replaced. New browser scenarios start independent signed sessions; the first-entry scenario clears cookies before using the actual welcome/household UI.

| Command | Actual result |
|---|---|
| `npm run test:canonical` | PASS: **129 tests in 14 files**, 21.20 seconds; existing unit/integration coverage plus nine presentation/recommendation checks. |
| `npm run test:e2e -- tests/e2e/ux-review.spec.ts tests/e2e/phase1.spec.ts tests/e2e/phase3.spec.ts` | PASS: **16/16**, 21.1 seconds, before the final mobile/header density refinements. |
| `npm run test:e2e` | **PASS: 43/43**, 2.2 minutes on the final full run; all existing regression tests plus four UX journeys. |
| `npm run lint` | PASS: ESLint. |
| `npm run build` | PASS: production build, including current UI routes/components. |
| `npm run typecheck` | PASS after restoring only the build-generated `next-env.d.ts` change. |
| `npm run findings:check` | PASS: deterministic original-source findings unchanged. |
| `npm run audit:check` | PASS: existing requirements audit still matches Coverage. |
| `npm run validate:canonical` | PASS: original packet counts, references, examples, scenarios and SHA-256 unchanged. |
| `git diff --check` | PASS; HEAD remains `00d2aaf`, with no staged files, commit or push. |

The expanded browser suite retains the existing tests and updates their labels/navigation/disclosure steps to match the intended UI. No existing permission, persistence, source, conflict, scenario, filing or export assertions were dropped. Added UX tests cover fresh CPA entry, five primary links, relocated record navigation, default-collapsed metadata, initial-viewport next action, clear discrepancy values, evidence open/close, saved Explain/Assign, unsaved-versus-created question drafts, client visibility, reviewer/partner/admin/client boundaries, unavailable actions and keyboard/responsive behavior.

An earlier full run was **41/43**. The new mobile viewport assertion caught the action button ending 11 pixels below the first screen; spacing was tightened until the original assertion passed. The filing test began checking state before its async response settled: its trace showed the POST and later read both accepted. It now awaits and asserts the actual POST response, then separately checks persisted state with a 15-second polling bound for the accumulated test fixture. No backend transition, permission, calculation or status assertion was changed. The entire suite was then rerun successfully. A large number of saved filing simulations still makes that existing history/list work slower; no backend performance refactor was included in this UI task.

Current synchronization guidance was verified through find-docs/Context7 against Playwright's [response-waiting documentation](https://playwright.dev/docs/api/class-page#page-wait-for-response) and [polling assertions](https://playwright.dev/docs/test-assertions#expectpoll); relevant installed Next.js navigation guides were read before implementation.

## Files in this change

Application:

- `src/components/app-shell.tsx`, engagement `layout.tsx`, `src/components/live-changes.tsx`: five destinations, secondary tools, compact context/data, simpler update copy and persistent identity access.
- Engagement `review/page.tsx`, `src/lib/review/presentation.ts`: action-first view and pure presentation/queue ranking over unchanged findings.
- `src/components/issue-triage-form.tsx`: clear existing actions, honest availability, explicit save/errors/conflicts and collapsed source-reference selection.
- `src/components/evidence-inspector.tsx`: optional compact/on-demand review presentation; original return/document/records modes preserved.
- Engagement `workflow/page.tsx`, `src/components/workflow-desk.tsx`: authorized actual-source question draft, explicit create, no automatic status mutation.
- `src/app/globals.css`: scoped review styles plus shared navigation/header/mobile density. Existing styling conventions and palette retained.

Verification/documentation: `tests/review-presentation.test.ts`, `tests/e2e/ux-review.spec.ts`; updated existing browser selectors/disclosure steps in Phase 1/2/3/5/8 tests and response synchronization in Phase 7; this report, before/after PNGs/manifest, README and AI disclosure. Existing unrelated uncommitted work was preserved.

## Constraints, assumptions and unfinished requirements

No supplied JSON, original engine output, validation rule, database schema/migration, API route/body contract, server permission rule or historical audit record was edited for this UX change. The new question query parameter is UI navigation state, not a new API or permission path. Creating questions/saving review state still uses the original real operations and audits. No dependency or environment was installed/changed, and no Git commit/push or deployment occurred.

**Record correction and formal Submit for review are still not implemented.** They are described as unavailable text, with no pretend buttons. Review status, an assigned task and a labeled filing simulation are not substitutes for a source correction or dependency-level sign-off. Other incomplete checklist requirements remain in [FINAL_CHECKLIST_VALIDATION.md](FINAL_CHECKLIST_VALIDATION.md); this UI work does not close those feature gaps.

The pre-existing working JSON has an extra leading newline, hash `975f9307b703888e8e44089b398d57157089bfa4a913c07aa85f299debbea7ef`. It was preserved. Normal strict tests/import validation still reject those changed bytes. `test:canonical` verifies the original `ee01f8508bd2fd9854754b82fd9c4a055bdc55e2778a132002a25381c412ad19` in an owned temporary copy, links the **current** code/tests/docs, uses real PostgreSQL and leaves the working source untouched. No integrity guard was relaxed to make a check pass.

No independent first-time CPA usability study, complete assistive-technology/cross-browser certification, public deployment or personal video is claimed. Readable software and automated task completion are verified; the human must still review the experience and complete external submission steps.
