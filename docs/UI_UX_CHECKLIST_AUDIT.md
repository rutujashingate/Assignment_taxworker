# UI/UX and plain-English checklist audit

Reviewed **October 16, 2026 (America/Phoenix)** against the newly supplied 80 requirements and 10 end-to-end checks. Attachment SHA-256: `f4012b24c25fe773828effa0b69548d52bc8aabddd6933d7d19b44a2a6b54b9e`.

**The assignment remains incomplete:** 52 PASS (including 12 explicitly labeled permitted simulations), 21 PARTIAL, 7 FAIL, 0 NOT TESTED. FAIL includes five missing product operations and two missing external deliverables. No absent operation is checked off because a UI exists. A prototype/simulation pass means the stated permitted demonstration works; it never means real IRS transmission, regulated signatures, original scanned PDFs or a tax engine rerun. The 70 Coverage rows group requirements differently from these 80 IDs.

## Starting and tracing

Choose Priya Raman (preparer), open the household and select **Review next issue**. Compare the figures, follow the checking instructions, open supporting records, then save a conclusion and selected evidence. Request information prepares an unsent question until Create record is used. This records a review disposition; formal field verification, source corrections and production sign-offs remain missing.

In **Tax Return**, click an amount. Actual input amounts and source records are selectable. Formatted search accepts `$6,450`; filters survive tracing. **Back to return amount** returns to the selected figure; **Return to line list** returns to the table. In a document, choose a linked printed field to land directly on **Tax line usage**, then select a return amount to navigate back. Proceeds/basis open supplied lot extraction references; gain opens its original calculation. Multi-record totals lead to supporting comparisons, without pretending one field establishes them. Unconfirmed figures stay unlinked.

All authored link underlines are removed. Hover backgrounds, borders, visible keyboard focus and touch targets identify links. Printed text remains intact; source highlights require literal matching, never synthetic PDF coordinates. Requested evidence leads with the document before reading metadata. A selected matched field is centered and focused; an unlocalized reading falls back to its actual page without inventing a highlight. The standalone document view retains field-to-usage navigation.

## Evidence key

`B` = `/engagements/CL-20417/2025`. Tests use a real production build on local port 3100, signed roles and isolated PostgreSQL; development port 3000 is not a public deployment. [New UI tests](../tests/e2e/ui-tracing.spec.ts) cover eight pages without underlines, hover/focus, interest/sales/review figures, ten routes at five screen sizes, keyboard-only wages → D09 → return, source-before-metadata order, and later-field focus/ambiguous-page fallback. Wages are **$212,400 = D08 $104,600 + D09 $107,800**. The interest path includes **SchB.2**; the two $1,840 reports remain a probable overlap requiring CPA confirmation.

CL/B1/B2/B3/B5/B6/B7/B8 and REF/REC/OPS/COL/REV/SEA/DEL refer to the actual existing suites listed in [the prior detailed evidence key](FINAL_CHECKLIST_VALIDATION.md#evidence-key-and-routes). Their implementation boundaries remain applicable; the final fresh commands and results are recorded below. No backend gap is promoted by presentation changes.

## Evidence

| ID | Requirement | Result | Demonstration / remaining limit |
|---|---|---|---|
| **E01** | Trace any return number to its source | **PASS** | **New UI:** click an actual return amount, follow input amounts, and navigate back (UI tracing plus CL/B2/B8). `B/return?line=F1040.1a&ref=F1040.1a`: actual v3 wages **$212,400**, rule `R-W2-BOX1-SUM`, sources `ev-0016` / `ev-0035` → D08 / D09. **CL wages**, REF, B2/B8 prove source tracing. All 627 v3 lines' direct inputs/sources resolve; six deeper prior-asset provenance labels remain explicit gaps. |
| **E02** | Trace any document to every use | **PARTIAL** | `B/documents/D28` shows direct/downstream usage; D31 page 32 says extraction/usage is missing, D30 says superseded. **REF, B2** pass. Formal used/reference-only/excluded/not-applicable dispositions and human reasons are absent. “No usage recorded” is not a completed disposition. |
| **E03** | Record how every reviewed number was verified | **FAIL** | The inspector explicitly says “Human verification: Not recorded.” No method/reviewer/time verification write exists. Extraction confidence and lot observations cannot check this box. **B2/B8** verify the truthful display, not verification functionality. |
| **E04** | Link related items within the return | **PASS** | **New UI:** proceeds/basis amounts open exact supplied extraction refs; gain opens its calculation. `B/records/sales?lot=F8949.D.X1`: selected lot, actual basis/proceeds field refs, original calculation and tax-line usage. **REC, B6 sales/source trace**. |
| **E05** | Link related items across years | **PASS** | `B/records/carryovers`, opening `py:/carryovers_into_2025`, prior line/basis and asset pointers. **CL prior evidence, REF, REC**. No missing prior value is fabricated. |
| **E06** | Link related returns | **PASS** | `B/records/k1`, “Related returns · evidence stubs” → `household:/related_returns`; absent entity returns show the readable **In this packet: No** field. **CL related returns, REC, B6**. |
| **E07** | Attach evidence of different kinds | **PASS** | `B/workflow`: linked questions/threads accept persistent file/note attachments and dated messages. **COL, B5** reopen actual saved bytes and notes after refresh. Attachments are workpaper evidence, not new fabricated packet documents. |
| **E08** | Display the source and highlight the precise field | **PASS** | **Labeled prototype/simulation.** D08/D09 Box 1 and D28/D29 interest have actual matching literal spans, highlighted in printed text. **CL wages, B2, B8 keyboard**. D64 has no invented highlight. |
| **E09** | Generate simulated source documents from the JSON | **PASS** | **Labeled prototype/simulation.** `B/documents`: 74 records / 199 complete printed pages, 68/2/4 extraction states. **DEL, REF, B2/B7**. Only 72 are available at default v3; D71/D72 become available at their actual replay dates. |
| **E10** | Make source links independent of the renderer | **PASS** | Typed `ev-NNNN`, document and `doc:Dxx#pageN` refs resolve independently; changing synthetic positions does not change literal localization. **REF syntax/position-invariance tests, DEL all-page contract**. No pixel coordinates are the stored provenance. |
## Calculation

| ID | Requirement | Result | Demonstration / remaining limit |
|---|---|---|---|
| **C01** | Explain the construction of any number | **PASS** | `B/return`: inspector shows supplied rule/description, direct addends/input lines and source refs. **CL wages**, REF and B2 interest trace. Engine-derived math is not replaced with invented calculations. |
| **C02** | Reconcile numbers that should agree | **PASS** | `B/review`: Northlake account/program/year evidence and both used Schedule B contributions are shown together. **REV, B3**. This is a probable economic overlap requiring CPA confirmation, not a duplicate finding solely from equal amounts. |
| **C03** | Handle hundreds of entries without overwhelming the CPA | **PASS** | `B/records/sales`: D74's 260 lots, category/exception groups, totals, search, selected detail, bulk observations and at most 12 mounted rows. **REC, OPS, B6 performance/bulk tests**. |
| **C04** | Show the journey from bookkeeping profit to taxable business profit | **PARTIAL** | `B/records/business`: bridge **89,834 + 12,400 − 19,180 − 1,200 = 81,854**, with actual refs and open D14/D15/D21 reconciliation. **REC bridge, B6** pass. The $19,180 expense difference is aggregated, not a complete reasoned disposition of each book-to-tax adjustment; no corrected taxable result exists. |
| **C05** | Split income between states | **PASS** | `B/records/california`: residency periods and federal / California-law / California-source columns and rules. **REC state allocation, B6 area trace**. Supplied allocation is inspectable, not independently recomputed. |
| **C06** | Run checks that don’t blindly trust the tax engine | **PASS** | `B/review`: deterministic printed-page, receipt/account and agency reconciliations. **REV, DEL, B3** prove four source/calculation mismatches plus two uncertain findings and a passing duplicate-W-2 control; no runtime LLM. |
## Safe changes

| ID | Requirement | Result | Demonstration / remaining limit |
|---|---|---|---|
| **CH01** | Make adjustments without losing the original | **PARTIAL** | `B/history` persists isolated modeled deltas, reason/actor/audit and labeled rate estimates (**SEA/B7**). Original v3 is unchanged. Real source corrections/exclusions and a corrected live return are absent; the duplicate-correction acceptance test cannot be completed. |
| **CH02** | Show other people’s changes live | **PASS** | `B/workflow`: two browser sessions observe a preparer's question correction through documented three-second polling. **B5 two-window test**, COL. This proves supported collaboration edits, not absent tax-field correction propagation. |
| **CH03** | Show what changed since *this user* last looked | **PARTIAL** | Persistent unread notifications exist (**COL/B5**); there is no complete reviewer checkpoint/diff for changed amounts, documents and decisions. |
| **CH04** | Compare versions | **PASS** | `B/history`: original v1/v2/v3 values, computed times, triggers, supplied changes and per-line differences. **SEA/B7**, immutable packet validation. |
| **CH05** | Explore what-if scenarios without changing the official work | **PASS** | **Labeled prototype/simulation.** `B/history`: five exact packet alternatives; custom amounts are only rate estimates and change no live state. **SEA/B7** prove named outputs and isolation. |
| **CH06** | Act on many records at once | **PASS** | `B/records/sales`: all 260 D74 lot observations persist in one audited, revision-checked batch; a stale member rejects the whole batch. **OPS/B6**. This is a batch review observation, not E03 field verification or a bulk tax correction. |
| **CH07** | Undo a change safely | **FAIL** | No compensating undo operation or batch undo exists. Controls do not pretend otherwise. **OPS** only proves atomic writes/conflicts; it does not prove undo. |
## Judgment and completeness

| ID | Requirement | Result | Demonstration / remaining limit |
|---|---|---|---|
| **J01** | Flag unusually large changes from last year | **PASS** | `B/records/comparison` shows dollars, percentages and firm-threshold flags. `B/workflow` can retain a source-linked explanation referencing both years. **REC variance, OPS thresholds, CL linked variance task**. A flag is not automatically an error. |
| **J02** | Record professional judgment calls | **PARTIAL** | Audited source-linked notes and Explained/Resolved triage can retain rationale/author/time (**COL/REV**). There is no complete structured judgment/authority approval and treatment-history workflow; no professional tax conclusion is certified by these notes. |
| **J03** | Record tax elections | **FAIL** | Original computed choices/scenarios are visible, but no election record with period, rationale, evidence and review status can be saved. |
| **J04** | Record due diligence | **FAIL** | Diligence-related inputs and firm standards are visible. There is no dated per-position due-diligence completion/attestation with reviewer evidence. Editing the firm's checklist text is not completing it. |
| **J05** | Record penalty-related decisions | **PARTIAL** | `B/records/payments` displays F2210/FTB5805 and payment evidence (**REC**); generic notes can be saved. No dedicated penalty disposition/election/review workflow exists. |
| **J06** | Account for every document | **PARTIAL** | Original availability/extraction/supersession/computed usage is present (**REF/B2**). Unclassified-document dispositions and a completeness sign-off gate are not implemented. 74 indexed records do not establish 74 completed reviews. |
| **J07** | Show that every tax area was considered | **PARTIAL** | Fifteen data-backed area routes exist (**REC/B6**). There is no per-area reviewed/not-applicable conclusion, responsible reviewer and completeness gate. |
| **J08** | Identify separate/outside filings | **PARTIAL** | Related-return stubs, foreign-filing gaps, supplied prior open items and deadlines are displayed. **REC/B6**. No handled/excluded/follow-up disposition tracker is implemented. |
## People

| ID | Requirement | Result | Demonstration / remaining limit |
|---|---|---|---|
| **P01** | Ask the client questions | **PASS** | `B/workflow`: real D64 ambiguity question is created and visible only when shared. **COL/B5** exercise the form and client answer. No email delivery is claimed. |
| **P02** | Ask coworkers questions | **PASS** | Internal questions/review notes and replies persist; client UI, direct API, search, attachments and cursors cannot expose them. **COL/B5/B8**. |
| **P03** | Turn answers into evidence | **PASS** | Dated `answer:<uuid>` records retain author and linked original refs. **COL/B5/B8** prove preparer visibility and refresh/new-session persistence. |
| **P04** | Create review notes that can block filing | **PASS** | **Labeled prototype/simulation.** Open internal review notes block submission/acceptance on the server; only permitted roles close them. **COL/SEA/B5/B7**. This gate applies to the labeled filing simulation. |
| **P05** | Reopen sign-offs when what was approved changes | **PARTIAL** | Fingerprinted simulation approvals become stale on covered model/evidence changes (**SEA/B7**). No wages/source verification/sign-off layer exists, so the preparer-source-edit/reviewer-reopen test is unavailable. |
| **P06** | Enforce user roles | **PASS** | Signed demo sessions plus server scope/role/clearance checks reject private client reads, forged roles and preparer reviewer approvals. **B1/B5/B7/B8, authorization/visibility unit suites**. Demo switching is not a production identity provider. |
| **P07** | Let multiple people work at once | **PASS** | **B5** uses independent browser contexts: preparer update arrives, stale reviewer save returns safe **409**, draft is preserved and database retains the winning edit. |
| **P08** | Support assignments | **PASS** | `B/workflow` assignee filter/work list; `B/review` issue assignment. **CL assignment, COL/REV/B3** prove authorized assignees persist. |
| **P09** | Support deadlines | **PARTIAL** | Deadline fields save and survive reload (**CL/COL**). `workflow-desk.tsx` renders “Due YYYY-MM-DD” but has no computed overdue indicator/filter. The assigned past-date task proves persistence, not overdue behavior. |
| **P10** | Send notifications | **PASS** | Task/question/reply events create recipient-owned database notifications, unread state and audited mark-read. **CL/COL/B5**. Direct Review Desk issue assignment is not independently wired to this notification stream; the demonstrated assignment is a workflow task. |
| **P11** | Collect client approval | **PASS** | **Labeled prototype/simulation.** `B/workflow`: approval records identity/time/fingerprint and covered changes invalidate it. **SEA/B7**. Client summary remains an original-v3-based simulation with distinct estimates. |
| **P12** | Handle e-file signature/authorization | **PARTIAL** | Current combined “Approve & authorize simulation” consent is labeled and server-gated (**SEA/B7**). It is stored in one approval object, not a separate approval-versus-authorization lifecycle. No regulated e-signature exists or is required for the labeled prototype. |
## Filing and after

| ID | Requirement | Result | Demonstration / remaining limit |
|---|---|---|---|
| **F01** | Support extensions | **PASS** | **Labeled prototype/simulation.** `B/history`: supplied extension amount/event/status and deadlines are replayed (**SEA/B7**). It is a scripted record, not a real extension request or a new time-to-pay claim. |
| **F02** | Support the filing workflow | **PASS** | **Labeled prototype/simulation.** `B/history`: readiness, current reviewer/partner/client consent, explicit modeling acknowledgment, submit and supplied response operations persist. **SEA/B7** test transitions and refusal paths. |
| **F03** | Handle electronic filing rejections | **PASS** | **Labeled prototype/simulation.** Scripted federal **R0000-504-02**, CA hold, D71 dependent-ID overlay, renewed approvals, resubmission and federal/CA acceptance. **SEA/B7**, with clock-based D71 availability. |
| **F04** | Produce the client’s copy | **PASS** | **Labeled prototype/simulation.** `B/history` / client Workflow exposes a real masked HTML download without internal notes, exception reasons or staff approval details. **SEA/B7/B8 privacy**. It is a simulated return summary, not government-ready forms. |
| **F05** | Freeze the filed version | **PASS** | **Labeled prototype/simulation.** Server and PostgreSQL triggers reject updates to accepted snapshot bytes. Later CA acknowledgment does not replace the frozen federal submission. **SEA/B7**. |
| **F06** | Amend *on top* of the filed version | **PASS** | **Labeled prototype/simulation.** Modeled child branch/diff preserves accepted parent. **SEA/B7**. The packet supplies no amended-return acknowledgments; none are fabricated. |
| **F07** | Answer a notice with a self-contained record | **PASS** | **Labeled prototype/simulation.** Replay `tl-29`, export `kind=notice`: masked printed pages, distinct extraction/calculation context, dated collaboration and evidence gaps in offline HTML. **SEA/B7** open it with network disabled. No IRS response is sent. |
| **F08** | Carry relevant information and history forward | **PARTIAL** | `B/records/carryovers` and accepted/amendment history retain original balances/provenance (**REC/SEA**). There is no 2026 engagement creation/import, seeded decisions or next-year computation. |
| **F09** | Support next-year planning | **FAIL** | Supplied `planning_reference_2026` exists in the packet, but no planning page/save operation is implemented. Generic notes are not presented as a completed planning feature. |
## Firm controls

| ID | Requirement | Result | Demonstration / remaining limit |
|---|---|---|---|
| **FM01** | Apply firm-wide standards | **PASS** | Jo (`st-05`), `/firm/admin`: threshold changes persist and affect variance flags; revisions/roles enforced. **OPS/B6** restore original thresholds afterward. Required-step text cannot disable core security gates. |
| **FM02** | Protect sensitive data | **PASS** | Uncleared staff/client serialization, source views and search mask/restrict protected identifiers; unauthorized reveals fail. **COL/B2/B5/B8**, authorization/visibility tests. |
| **FM03** | Keep sensitive-data view logs | **PASS** | Authorized reveal/document view appends actor/time/target; Jo can inspect safe metadata. **COL/OPS/B5/B6**. Private audit before/after payloads are not serialized in the access-log response. |
| **FM04** | Track time against budget | **PASS** | `/firm/time` saves actual minutes by supplied area; administrator totals compare to original budget. **OPS/B6** prove persistence and visibility. No hours are inferred from budget. |
| **FM05** | Show firm/engagement status | **PARTIAL** | Real issue counts, blocking-note gate and individual simulated filing states exist. **OPS/SEA**. There is no complete firm-wide ready/reviewed/filed rollup across missing verification/completeness gates; “Review not evaluated” is intentional. |
| **FM06** | Provide search | **PARTIAL** | `/firm/search`: client/ID/year, document, line, lot, amount and authorized conversations work; **CL** proves CL-20417, D23 and interest. **OPS/B6/B8** prove filtering. `firm/search.ts` does not index independent `workpaper_issue` records; an exact check-code query has no issue hit. Review Desk filters are the current issue-finding route. |
## CPA records

| ID | Requirement | Result | Demonstration / remaining limit |
|---|---|---|---|
| **R01** | Return summary vs last year | **PASS** | `B/records/comparison`: actual current/prior amounts, dollar/percentage variance, flags and two-sided source links. **REC/B6/CL variance refs**. Changed payer/detail meanings remain not-comparable. |
| **R02** | Tax computation | **PASS** | `B/records/computation` plus `B/records/california`: supplied v3 income/deductions/tax/credits/payments with rules and dependencies. **REC/B6**. No engine rerun. |
| **R03** | Area summaries | **PARTIAL** | `B/records` provides meaningful area metrics/data/gaps and sources (**REC/B6**). Area-specific review notes, approvals, conclusion and outstanding-work aggregation are not all available together. |
| **R04** | Document index | **PARTIAL** | `B/documents`: D31 is corrected/partial; text search matches issuer/type/year and extraction filter works (**B2**). There is no human review-status classification/filter because that overlay is absent. |
| **R05** | Depreciation by asset | **PASS** | `B/records/depreciation`: supplied method/life/bonus, federal/CA/AMT, disposals/recapture and prior records. **REC/B6**. No extra California AMT result is computed; six unsupported exact prior-document labels remain gaps. |
| **R06** | Sales detail | **PASS** | `B/records/sales`: dates/proceeds/basis/adjustments/gain, D74 categories reconcile to 260 source lots. **REC/B6**. Missing crypto basis and M18 missing extraction remain explicit. |
| **R07** | Books to tax | **PARTIAL** | The five-step bridge reconciles supplied totals and links both sides (**REC bridge**); **C04** describes its exact amounts. Aggregated expense difference and unresolved business-use issues do not constitute a complete adjustment-by-adjustment workpaper. |
| **R08** | Rentals and passive losses | **PASS** | `B/records/rentals`: two activities, rents/expenses/depreciation/disposition, passive limits and prior carryovers. **REC/B6**, opening Fremont passive balance **$6,300** remains source-linked. |
| **R09** | K-1 lines | **PARTIAL** | `B/records/k1` displays supplied D37/D39 boxes, engine destinations, prior K-1s and missing-return stubs (**REC/B6**). Unused boxes lack formal human exclusion/disposition reasons, as in E02/J06. |
| **R10** | Retirement items | **PASS** | `B/records/retirement-foreign`: D41–D43, F8606 calculation, prior IRA basis and linked source values. **CL retirement pages/prior basis, REC/B6**. |
| **R11** | Foreign items | **PASS** | Same area: D36 Swedish records, SEK parameters and foreign-reporting evidence gaps. **CL** resolves actual `ref:fx.SEK.2025_average` = **9.86**; **REF/REC** verify original relationships. An outside filing is not assumed completed. |
| **R12** | Deductions with limits | **PASS** | `B/records/deductions-credits`: SchA amounts/limits and source/rule traces; D64 remains ambiguous. **REC/REV/B6**. Not a claim that every original claimed amount is substantiated. |
| **R13** | Credits with limits | **PASS** | Same area: F8812/F8863/F2441/F8995 original inputs, phaseouts/limits and allowed/disallowed computations. **REC/B6**. Due diligence completion is separately missing under J04. |
| **R14** | Payments | **PASS** | `B/records/payments`: D68's September **$3,500 → 2024**, agency 2025 total **$10,500** versus F540NR.72 **$14,000**. **REV/REC/B3/B6**; no transfer is invented. |
| **R15** | State split | **PASS** | `B/records/california`: actual July move/residency, California-source vs total-under-CA-law/federal values and traceable supplied allocation. **REC/B6**. |
| **R16** | Carryovers | **PARTIAL** | `B/records/carryovers` shows source-linked opening balances, selected utilization computations and original output balances (**REC**). There is no uniform opening/used/added/closing approved rollforward for every carryover category. |
| **R17** | Basis by year | **PASS** | `B/records/basis`: actual S-corp/partnership/IRA history and null unknown years; computed assumptions are separate. **REC/B6**. Missing 2023 ending S-corp basis is not silently filled from a K-1 or capital account. |
| **R18** | Prior preparer vs what we changed | **PARTIAL** | `B/records/prior-treatment`: D07/prior memo and current original-engine treatment link correctly (**REC/B6**). The current team has no Phase 4 tax-correction history or complete reason-for-every-change ledger to show. |
## Submission

| ID | Requirement | Result | Demonstration / remaining limit |
|---|---|---|---|
| **S01** | Working web app accessible by link | **FAIL** | **External deliverable missing.** Local `/firm` and signed roles/persistent PostgreSQL work (**B1/B8**). No public deployment exists. Hosting project/login and reachable remote PostgreSQL are missing; original source-byte release discrepancy must be addressed. [Exact unblock checklist](DEPLOYMENT_HANDOFF.md). |
| **S02** | One page on your core idea and data model | **PASS** | [PRODUCT_AND_DATA_MODEL.md](PRODUCT_AND_DATA_MODEL.md), 451 words, actual immutable source/overlay model; `/handoff` downloads real bytes. **DEL/B8**. |
| **S03** | Errors found, and how your design surfaced them | **PASS** | [FINDINGS_REPORT.md](FINDINGS_REPORT.md), JSON and seven actual masked screenshots with routes/hashes. **DEL/REV/B8**. Four confirmed mismatches, two uncertain findings, one passing control; warnings are not all called errors. |
| **S04** | Video recording with a link | **FAIL** | **External deliverable missing.** [VIDEO_SCRIPT.md](VIDEO_SCRIPT.md) is ready; recording and actual shareable URL must be supplied by the human applicant. No invented video link. AI/tool assistance is disclosed in [AI_USAGE.md](../AI_USAGE.md). |

## Ten end-to-end checks

| ID | Check | Result | Demonstration / limit |
|---|---|---|---|
| **X01** | Fresh entry, role and household navigation | **PASS** | **B1** exercises native entry, one household search, every primary destination, signed role persistence and fresh context. |
| **X02** | Forward highlighted source and reverse uses | **PASS** | New direct-amount/keyboard round trips plus **Labeled simulation.** **CL wages, B2 interest, B8 keyboard**. Real packet refs and literal printed fields, simulated document view. |
| **X03** | Reproducible independent mismatch | **PASS** | **REV/B3/DEL**, e.g. D68 tax-year mismatch or duplicate D23 pages. |
| **X04** | Adjustment refresh preserving original/audit | **PARTIAL** | **SEA/B7** prove isolated modeled adjustments; **OPS/B6** prove lot overlays. Live tax/source correction is unavailable under CH01. |
| **X05** | Source edit reopens affected reviewer sign-off | **FAIL** | Phase 4 verification/sign-off/dependency layer is absent. Simulation-level approval invalidation is not this wages-source acceptance test. |
| **X06** | Client private-note UI/API isolation | **PASS** | **COL/B5/B8** exercise direct read/search/attachment/export/cursor boundaries, not just hidden navigation. |
| **X07** | Rejection → correction → acceptance and freeze | **PASS** | **Labeled simulation.** **SEA/B7** use supplied acknowledgment records, dated D71 and immutable accepted bytes. |
| **X08** | Independent offline 2028 notice package | **PASS** | **Labeled simulation.** **SEA/B7** open self-contained HTML offline; original-v3 and modeled assumptions remain distinct. |
| **X09** | Suites, responsive/keyboard and every control | **PARTIAL** | New five-size / ten-route navigation and trace checks; Full suites/build and desktop/tablet/mobile/keyboard journeys are executed. Boundary controls and every interaction family were audited, but missing checklist operations and ordinary exact-source guard failures prevent blanket acceptance. No full assistive-technology/cross-browser certification is claimed. |
| **X10** | All four submissions, external simulation disclosure | **FAIL** | Model/findings/disclosure ready; public app and recorded video URLs are absent. Full feature gaps above remain. |

## Remaining scope

The incomplete core loop is human field verification → source/tax correction → stale dependency sign-offs → safe undo and completeness. Dedicated elections, diligence and planning; complete document/area dispositions and carryforwards; overdue indicators; independent-issue global search; and separate approval/authorization remain absent or partial as listed above. The five missing operations are E03, CH07, J03, J04 and F09. No new clients, sources, tax amounts or successful integrations were fabricated.

Public hosting/remote PostgreSQL and the personal video URL remain missing (S01/S04). See [deployment handoff](DEPLOYMENT_HANDOFF.md) and [video script](VIDEO_SCRIPT.md). There is no deployment, personal recording, independent CPA usability study or exhaustive assistive-technology/cross-browser certification to claim.

## Exact verification results

| Command / check | Actual final result |
|---|---|
| `npm run test:canonical` | **133 passed / 14 files**, 25.47 seconds; complete current unit/integration suite with real isolated PostgreSQL and separately verified original source bytes |
| `npm run test:e2e` | **57 passed**, 4.1 minutes, against the final production build; includes 12 new UI-focused cases |
| `npm run build` | Passed; no application changes after this build |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run validate:canonical` | Passed: exact original hash; 74 documents, 199 pages, 3,012 values; 68/2/4 extraction states; 625/625/627 lines; 29 events; five alternatives; six staff/two clients. Six prior-asset provenance labels remain disclosed gaps |
| `npm run findings:check` | Passed; six deterministic findings and one passing control remain unchanged |
| `npm run audit:check` | Passed; original 70-row Coverage registry remains consistent |
| `git diff --check` | Passed |
| Checklist integrity | All 80 IDs and 10 end-to-end IDs appear exactly once as matrix rows; statuses and local proof links checked |
| Screenshot integrity | All 19 real image hashes verified against four manifests |
| Local `GET http://127.0.0.1:3000/firm` | HTTP 200; local development only |

The complete final browser run retains original source/role/persistence/concurrency/260-lot/filing/notice checks and adds actual clickable numbers, physical selected-field viewport bounds, keyboard focus and direct document-to-usage navigation. Source-only reports and provided engine results are unchanged. No original packet, API body/route contract, schema, permission or historical audit event was changed.

Intermediate responsive runs exposed firm-table overflow and the small-phone Start action 8 pixels below the viewport. Those layouts were fixed without hiding the page overflow or relaxing the viewport assertions. Visual review exposed metadata leading the selected source; the source now leads and matched fields receive focus. A keyboard test initially raced document navigation against an identical source field on the prior page; it now waits for the actual document route before asserting the usage destination. Full final suites passed after these fixes.

### Actual screenshots

- [Review before this work](screenshots/tracing/review-before.png), [Review after](screenshots/tracing/review-after.png), [capture provenance/hashes](screenshots/tracing/review-manifest.json). Before is the real committed `f91e5d1` artifact, not a reconstructed mockup.
- [Desktop: return amount and selected W-2 field](screenshots/tracing/desktop-number-source.png), [360-pixel phone: selected field in view](screenshots/tracing/phone-number-source.png), [capture routes/hashes](screenshots/tracing/source-manifest.json). Uncleared preparer `st-04`, masked identifiers, original v3 source date.
- [Five-size browser scenarios and keyboard tests](../tests/e2e/ui-tracing.spec.ts); existing findings and UX PNGs/manifests were refreshed by the real final Chromium run.

These checks demonstrate the specified local flows, not an independent human usability study, complete tax accuracy, formal verification/sign-offs, production authentication, deployment or a personal video recording.


## Changed files and assumptions

Application changes are limited to shared link/responsive CSS; the return, review, document and tax-area pages; the evidence inspector, source renderer and sales table; and a small source-focus component. [UI tracing tests](../tests/e2e/ui-tracing.spec.ts) contain the new behavioral checks. README/AI disclosure and real screenshots/manifests accompany this audit. Existing APIs, database tables, tax rules, source references and calculated results remain unchanged.

UI source data comes from the already authorized, date-filtered server projections. A source preview focuses a literal matched field, or the actual page if a field cannot be established. Browser-only focus is a navigation enhancement, not a persisted verification. Native document links and the existing no-JavaScript entry/navigation remain supported. Audit and mutable review/workpaper operations keep their existing server authorization, persistence and revision checks.

The user's pre-existing working JSON adds a leading newline (`975f9307b703888e8e44089b398d57157089bfa4a913c07aa85f299debbea7ef`). It was preserved and excluded from every commit. The committed/delivered bytes remain `ee01f8508bd2fd9854754b82fd9c4a055bdc55e2778a132002a25381c412ad19`. Ordinary `npm run test` / `npm run validate:packet` retain their strict guard against those edited working bytes; this work uses the explicit canonical runner, without normalizing the packet or weakening the importer.

## Incremental implementation pushes

Each implementation batch contains three files including its relevant browser test updates. Supporting evidence images/manifests are published together so their checksums agree.

| Commit | Change | Focused verification before pushing |
|---|---|---|
| `46dc5cb` | Link surfaces, hover/focus, no underlines | Eight-page link inspection and keyboard source usage; lint/build |
| `b848fa8` | Clickable return figures, formatted search, readable input/source values | Seven source/tracing browser cases; lint/build |
| `2bb4282` | Sale proceeds/basis source fields and gain calculation | Eight records/tracing browser cases, including 260-lot behavior; lint/build |
| `91e4314` | Review figures link to existing references or multi-source comparison | Ten review/tracing browser cases; lint/build |
| `f0a413a` | Responsive figures, retained search, return navigation and table containment | Ten UI cases including five screen sizes/keyboard; 133 unit/integration tests; lint/build |
| `a4f7d17` | Requested source before extraction metadata | Sixteen source/collaboration browser cases; lint/build |
| `08dd80f` | Selected-field focus and honest page fallback | Seventeen source/tracing browser cases; lint/build |
| `dbb6e15` | Document field opens return-usage section directly | Three focused forward/reverse cases, including real keyboard navigation; lint/build |


## Navigation cleanup follow-up — October 16, 2026

Assignment research, requirements coverage and submission materials are no longer linked from the working interface. The sidebar and Tax areas exclude `/coverage` and `/handoff`; repository documents remain the submission record. Legacy authenticated URLs are preserved for earlier links and existing route compatibility. Actual CPA review checks, missing-evidence warnings and simulated filing disclosures remain visible where needed.

Workpaper tools now appear without expanding a menu: Filing & Approvals (Simulation), CPA Records, search, time and administrator-only firm administration. The filing shortcut reaches the existing Tasks & Approvals filing section by a keyboard-accessible fragment link and respects existing server permissions. Client identities retain their restricted workspace. Phones show compact scrolling navigation rows; the next review action remains in the initial tested viewport. No original JSON, tax calculation, validation rule, schema, API contract, permission or historical audit event changed. The 80-item assessment and its remaining feature gaps above are unchanged.

Changed implementation files: `src/components/app-shell.tsx`, `src/components/filing-panel.tsx`, `src/app/globals.css`, the Tax areas and Review page components, and `tests/e2e/ux-review.spec.ts`. README, AI disclosure and actual masked screenshot artifacts were refreshed. The fresh-session test now waits for the signed-in firm landing page and workpaper URL; its initial run exposed a redirect race in the test before those waits were added.

Actual follow-up verification:

- `npm run test:canonical`: **133 passed / 14 files**, 26.87 seconds, real isolated PostgreSQL and separately verified original packet bytes; local packet unchanged.
- `npm run test:e2e`: **59 passed**, 4.0 minutes; includes absence of assignment links across seven working pages, direct keyboard filing navigation for preparer/reviewer/partner/admin, role restrictions, persistence, source tracing and five responsive sizes.
- `npm run lint`, `npm run typecheck`, `npm run build`, `npm run findings:check`, `npm run audit:check` and `git diff --check`: passed. The production build and lint were rerun after the final administrator wording change; `npm run test:e2e -- tests/e2e/ux-review.spec.ts --grep 'role-specific'` then passed **1 test** against that final build.
- All **19** screenshot hashes verified. The five current UX captures and seven findings captures were refreshed by the production-build browser run; the tracing review-after image uses that same real capture. Historical before images and older source-trace captures are unchanged.

[Current desktop](screenshots/ux/after-review-desktop.png) · [Current phone](screenshots/ux/after-review-mobile.png) · [Earlier desktop baseline](screenshots/ux/before-review-desktop.png). Screenshots use masked staff identity st-04 and source clock June 23, 2026. Agent visual inspection is not independent CPA certification. GitHub pushes were authorized; no deployment or recording was performed.
