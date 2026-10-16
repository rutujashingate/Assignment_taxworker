# Final working-flow validation against the supplied checklist

**Verdict: the demonstrated review and simulated filing flows work, but the complete checklist is not satisfied.** This is a validation pass, not authorization to implement the missing phases. No product code, original source bytes, dependencies, migration, user environment, Git commit or push was changed for this validation.

Authority: the user's 80-item checklist and 10 end-to-end checks in `Pasted text.txt`, SHA-256 `f1587dbdf0d0c6db1b41bfec5f52eb63a6a6d2842cf7cd135f3ad1ff9f1871a4`, interpreted against the original packet/brief. Suggested demonstrations do not replace the full stated requirement. A successful demonstration is not automatically a full pass for a broader requirement.

Only **PASS** and **SIMULATION PASS** rows are checked. Simulation passes apply only where the brief permits a labeled prototype/supplied output; they do not mean actual IRS filing, real signatures, original scanned PDFs or a tax engine rerun. **PARTIAL** means a useful subset works but the complete requirement remains unchecked. **MISSING** means the required operation is not implemented. **BLOCKED** requires an external deliverable/access. The 70 Coverage rows combine requirements differently from these 80 checklist IDs; their counts are not interchangeable.

**80 requirements: 40 PASS + 12 SIMULATION PASS = 52 checked; 21 PARTIAL + 5 MISSING + 2 BLOCKED = 28 unchecked.** Of the 10 end-to-end checks, six are supported (three real, three explicitly simulated); four remain partial, missing or blocked. Final command results are recorded below.

| Checklist group | Checked | Unchecked |
|---|---:|---:|
| Evidence E01–E10 | 8 | 2 |
| Calculation C01–C06 | 5 | 1 |
| Change CH01–CH07 | 4 | 3 |
| Judgment J01–J08 | 1 | 7 |
| People P01–P12 | 9 | 3 |
| Filing F01–F09 | 7 | 2 |
| Firm FM01–FM06 | 4 | 2 |
| CPA records R01–R18 | 12 | 6 |
| Submission S01–S04 | 2 | 2 |
| **Total** | **52** | **28** |

## Evidence key and routes

`B` means `/engagements/CL-20417/2025`, using staff demo identity Priya (`st-01`) unless otherwise stated. Preparer/reviewer/partner/client roles are different signed sessions. Local manual entry is `http://127.0.0.1:3000`; browser automation uses a production server on port 3100 and the isolated test PostgreSQL database. These are local URLs, not public deployment URLs.

Proof references identify actually executed suites:

- **CL**: [checklist browser tests](../tests/e2e/checklist.spec.ts), added for wages, prior/related evidence, retirement/foreign pages, exact search terms and persistent assignment/deadline/notifications.
- **B1/B2/B3/B5/B6/B7/B8**: [entry](../tests/e2e/phase1.spec.ts), [evidence](../tests/e2e/phase2.spec.ts), [review](../tests/e2e/phase3.spec.ts), [collaboration](../tests/e2e/phase5.spec.ts), [CPA records/firm](../tests/e2e/phase6.spec.ts), [season/filing](../tests/e2e/phase7.spec.ts), [privacy/responsive/keyboard/delivery](../tests/e2e/phase8.spec.ts) browser suites.
- **REF**: [resolver/renderer contracts](../tests/evidence-resolver.test.ts); **REC**: [record projections/reconciliations](../tests/records.test.ts); **OPS**: [persistent firm/lot operations](../tests/records-operations.test.ts).
- **COL**: [collaboration/attachments/notifications/privacy](../tests/collaboration.test.ts); **REV**: [independent checks](../tests/review-checks.test.ts) and [review dispositions](../tests/review-issues.test.ts).
- **SEA**: [version/scenario/filing/immutability/export tests](../tests/season.test.ts); **DEL**: [deterministic reports/all-page/private-download tests](../tests/delivery.test.ts).

Unchecked rows cite both the working subset and the missing operation. File inspection is supporting evidence of a limitation, not a passing behavioral test.

## A. Evidence

| Check | Result | Working route / proof and remaining boundary |
|---|---|---|
| [x] **E01** — Return number → source | PASS | `B/return?line=F1040.1a&ref=F1040.1a`: actual v3 wages **$212,400**, rule `R-W2-BOX1-SUM`, sources `ev-0016` / `ev-0035` → D08 / D09. **CL wages**, REF, B2/B8 prove source tracing. All 627 v3 lines' direct inputs/sources resolve; six deeper prior-asset provenance labels remain explicit gaps. |
| [ ] **E02** — Document → every use or reason for non-use | PARTIAL | `B/documents/D28` shows direct/downstream usage; D31 page 32 says extraction/usage is missing, D30 says superseded. **REF, B2** pass. Formal used/reference-only/excluded/not-applicable dispositions and human reasons are absent. “No usage recorded” is not a completed disposition. |
| [ ] **E03** — Human verification history | MISSING | The inspector explicitly says “Human verification: Not recorded.” No method/reviewer/time verification write exists. Extraction confidence and lot observations cannot check this box. **B2/B8** verify the truthful display, not verification functionality. |
| [x] **E04** — Related items within return | PASS | `B/records/sales?lot=F8949.D.X1`: selected lot, actual basis/proceeds field refs, original calculation and tax-line usage. **REC, B6 sales/source trace**. |
| [x] **E05** — Related items across years | PASS | `B/records/carryovers`, opening `py:/carryovers_into_2025`, prior line/basis and asset pointers. **CL prior evidence, REF, REC**. No missing prior value is fabricated. |
| [x] **E06** — Related returns and availability | PASS | `B/records/k1`, “Related returns · evidence stubs” → `household:/related_returns`; absent entity returns show `in_this_packet: false`. **CL related returns, REC, B6**. |
| [x] **E07** — Different evidence attachments | PASS | `B/workflow`: linked questions/threads accept persistent file/note attachments and dated messages. **COL, B5** reopen actual saved bytes and notes after refresh. Attachments are workpaper evidence, not new fabricated packet documents. |
| [x] **E08** — Display precise source field | SIMULATION PASS | D08/D09 Box 1 and D28/D29 interest have actual matching literal spans, highlighted in printed text. **CL wages, B2, B8 keyboard**. D64 has no invented highlight. |
| [x] **E09** — Simulated source documents | SIMULATION PASS | `B/documents`: 74 records / 199 complete printed pages, 68/2/4 extraction states. **DEL, REF, B2/B7**. Only 72 are available at default v3; D71/D72 become available at their actual replay dates. |
| [x] **E10** — Renderer-independent provenance | PASS | Typed `ev-NNNN`, document and `doc:Dxx#pageN` refs resolve independently; changing synthetic positions does not change literal localization. **REF syntax/position-invariance tests, DEL all-page contract**. No pixel coordinates are the stored provenance. |

## B. Calculation

| Check | Result | Working route / proof and remaining boundary |
|---|---|---|
| [x] **C01** — Explain construction | PASS | `B/return`: inspector shows supplied rule/description, direct addends/input lines and source refs. **CL wages**, REF and B2 interest trace. Engine-derived math is not replaced with invented calculations. |
| [x] **C02** — Independent reconciliation | PASS | `B/review`: Northlake account/program/year evidence and both used Schedule B contributions are shown together. **REV, B3**. This is a probable economic overlap requiring CPA confirmation, not a duplicate finding solely from equal amounts. |
| [x] **C03** — Hundreds of entries | PASS | `B/records/sales`: D74's 260 lots, category/exception groups, totals, search, selected detail, bulk observations and at most 12 mounted rows. **REC, OPS, B6 performance/bulk tests**. |
| [ ] **C04** — Books → taxable business profit, each adjustment | PARTIAL | `B/records/business`: bridge **89,834 + 12,400 − 19,180 − 1,200 = 81,854**, with actual refs and open D14/D15/D21 reconciliation. **REC bridge, B6** pass. The $19,180 expense difference is aggregated, not a complete reasoned disposition of each book-to-tax adjustment; no corrected taxable result exists. |
| [x] **C05** — State split | PASS | `B/records/california`: residency periods and federal / California-law / California-source columns and rules. **REC state allocation, B6 area trace**. Supplied allocation is inspectable, not independently recomputed. |
| [x] **C06** — Checks independent of engine | PASS | `B/review`: deterministic printed-page, receipt/account and agency reconciliations. **REV, DEL, B3** prove four source/calculation mismatches plus two uncertain findings and a passing duplicate-W-2 control; no runtime LLM. |

## C. Change

| Check | Result | Working route / proof and remaining boundary |
|---|---|---|
| [ ] **CH01** — Correct live work without losing originals | PARTIAL | `B/history` persists isolated modeled deltas, reason/actor/audit and labeled rate estimates (**SEA/B7**). Original v3 is unchanged. Real source corrections/exclusions and a corrected live return are absent; the duplicate-correction acceptance test cannot be completed. |
| [x] **CH02** — Other users' changes live | PASS | `B/workflow`: two browser sessions observe a preparer's question correction through documented three-second polling. **B5 two-window test**, COL. This proves supported collaboration edits, not absent tax-field correction propagation. |
| [ ] **CH03** — Per-user changes since last look | PARTIAL | Persistent unread notifications exist (**COL/B5**); there is no complete reviewer checkpoint/diff for changed amounts, documents and decisions. |
| [x] **CH04** — Compare actual versions | PASS | `B/history`: original v1/v2/v3 values, computed times, triggers, supplied changes and per-line differences. **SEA/B7**, immutable packet validation. |
| [x] **CH05** — Isolated what-ifs | SIMULATION PASS | `B/history`: five exact packet alternatives; custom amounts are only rate estimates and change no live state. **SEA/B7** prove named outputs and isolation. |
| [x] **CH06** — Supported batch operation | PASS | `B/records/sales`: all 260 D74 lot observations persist in one audited, revision-checked batch; a stale member rejects the whole batch. **OPS/B6**. This is a batch review observation, not E03 field verification or a bulk tax correction. |
| [ ] **CH07** — Safe audited undo | MISSING | No compensating undo operation or batch undo exists. Controls do not pretend otherwise. **OPS** only proves atomic writes/conflicts; it does not prove undo. |

## D. Judgment and completeness

| Check | Result | Working route / proof and remaining boundary |
|---|---|---|
| [x] **J01** — Flag prior-year variance and attach reason | PASS | `B/records/comparison` shows dollars, percentages and firm-threshold flags. `B/workflow` can retain a source-linked explanation referencing both years. **REC variance, OPS thresholds, CL linked variance task**. A flag is not automatically an error. |
| [ ] **J02** — Professional judgment record | PARTIAL | Audited source-linked notes and Explained/Resolved triage can retain rationale/author/time (**COL/REV**). There is no complete structured judgment/authority approval and treatment-history workflow; no professional tax conclusion is certified by these notes. |
| [ ] **J03** — Tax elections | MISSING | Original computed choices/scenarios are visible, but no election record with period, rationale, evidence and review status can be saved. |
| [ ] **J04** — Due-diligence completion | MISSING | Diligence-related inputs and firm standards are visible. There is no dated per-position due-diligence completion/attestation with reviewer evidence. Editing the firm's checklist text is not completing it. |
| [ ] **J05** — Penalty decisions | PARTIAL | `B/records/payments` displays F2210/FTB5805 and payment evidence (**REC**); generic notes can be saved. No dedicated penalty disposition/election/review workflow exists. |
| [ ] **J06** — Every document accounted for | PARTIAL | Original availability/extraction/supersession/computed usage is present (**REF/B2**). Unclassified-document dispositions and a completeness sign-off gate are not implemented. 74 indexed records do not establish 74 completed reviews. |
| [ ] **J07** — Every area considered | PARTIAL | Fifteen data-backed area routes exist (**REC/B6**). There is no per-area reviewed/not-applicable conclusion, responsible reviewer and completeness gate. |
| [ ] **J08** — Outside filings tracker | PARTIAL | Related-return stubs, foreign-filing gaps, supplied prior open items and deadlines are displayed. **REC/B6**. No handled/excluded/follow-up disposition tracker is implemented. |

## E. People

| Check | Result | Working route / proof and remaining boundary |
|---|---|---|
| [x] **P01** — Ask client linked question | PASS | `B/workflow`: real D64 ambiguity question is created and visible only when shared. **COL/B5** exercise the form and client answer. No email delivery is claimed. |
| [x] **P02** — Private coworker questions | PASS | Internal questions/review notes and replies persist; client UI, direct API, search, attachments and cursors cannot expose them. **COL/B5/B8**. |
| [x] **P03** — Answers become evidence | PASS | Dated `answer:<uuid>` records retain author and linked original refs. **COL/B5/B8** prove preparer visibility and refresh/new-session persistence. |
| [x] **P04** — Blocking review notes | SIMULATION PASS | Open internal review notes block submission/acceptance on the server; only permitted roles close them. **COL/SEA/B5/B7**. This gate applies to the labeled filing simulation. |
| [ ] **P05** — Dependency-level stale sign-offs | PARTIAL | Fingerprinted simulation approvals become stale on covered model/evidence changes (**SEA/B7**). No wages/source verification/sign-off layer exists, so the preparer-source-edit/reviewer-reopen test is unavailable. |
| [x] **P06** — Server roles | PASS | Signed demo sessions plus server scope/role/clearance checks reject private client reads, forged roles and preparer reviewer approvals. **B1/B5/B7/B8, authorization/visibility unit suites**. Demo switching is not a production identity provider. |
| [x] **P07** — Concurrent collaboration | PASS | **B5** uses independent browser contexts: preparer update arrives, stale reviewer save returns safe **409**, draft is preserved and database retains the winning edit. |
| [x] **P08** — Assignments | PASS | `B/workflow` assignee filter/work list; `B/review` issue assignment. **CL assignment, COL/REV/B3** prove authorized assignees persist. |
| [ ] **P09** — Deadlines and overdue work | PARTIAL | Deadline fields save and survive reload (**CL/COL**). `workflow-desk.tsx` renders “Due YYYY-MM-DD” but has no computed overdue indicator/filter. The assigned past-date task proves persistence, not overdue behavior. |
| [x] **P10** — Persistent in-app notifications | PASS | Task/question/reply events create recipient-owned database notifications, unread state and audited mark-read. **CL/COL/B5**. Direct Review Desk issue assignment is not independently wired to this notification stream; the demonstrated assignment is a workflow task. |
| [x] **P11** — Client approval current to content | SIMULATION PASS | `B/workflow`: approval records identity/time/fingerprint and covered changes invalidate it. **SEA/B7**. Client summary remains an original-v3-based simulation with distinct estimates. |
| [ ] **P12** — E-file authorization distinct from approval | PARTIAL | Current combined “Approve & authorize simulation” consent is labeled and server-gated (**SEA/B7**). It is stored in one approval object, not a separate approval-versus-authorization lifecycle. No regulated e-signature exists or is required for the labeled prototype. |

## F. Filing and after

| Check | Result | Working route / proof and remaining boundary |
|---|---|---|
| [x] **F01** — Extensions | SIMULATION PASS | `B/history`: supplied extension amount/event/status and deadlines are replayed (**SEA/B7**). It is a scripted record, not a real extension request or a new time-to-pay claim. |
| [x] **F02** — Validated filing workflow | SIMULATION PASS | `B/history`: readiness, current reviewer/partner/client consent, explicit modeling acknowledgment, submit and supplied response operations persist. **SEA/B7** test transitions and refusal paths. |
| [x] **F03** — Rejection and recovery | SIMULATION PASS | Scripted federal **R0000-504-02**, CA hold, D71 dependent-ID overlay, renewed approvals, resubmission and federal/CA acceptance. **SEA/B7**, with clock-based D71 availability. |
| [x] **F04** — Safe client copy | SIMULATION PASS | `B/history` / client Workflow exposes a real masked HTML download without internal notes, exception reasons or staff approval details. **SEA/B7/B8 privacy**. It is a simulated return summary, not government-ready forms. |
| [x] **F05** — Immutable accepted snapshot | SIMULATION PASS | Server and PostgreSQL triggers reject updates to accepted snapshot bytes. Later CA acknowledgment does not replace the frozen federal submission. **SEA/B7**. |
| [x] **F06** — Isolated amendment above original | SIMULATION PASS | Modeled child branch/diff preserves accepted parent. **SEA/B7**. The packet supplies no amended-return acknowledgments; none are fabricated. |
| [x] **F07** — Self-contained notice response | SIMULATION PASS | Replay `tl-29`, export `kind=notice`: masked printed pages, distinct extraction/calculation context, dated collaboration and evidence gaps in offline HTML. **SEA/B7** open it with network disabled. No IRS response is sent. |
| [ ] **F08** — Next-year seeded engagement/history | PARTIAL | `B/records/carryovers` and accepted/amendment history retain original balances/provenance (**REC/SEA**). There is no 2026 engagement creation/import, seeded decisions or next-year computation. |
| [ ] **F09** — Next-year planning | MISSING | Supplied `planning_reference_2026` exists in the packet, but no planning page/save operation is implemented. Generic notes are not presented as a completed planning feature. |

## G. Firm

| Check | Result | Working route / proof and remaining boundary |
|---|---|---|
| [x] **FM01** — Firm standards affect flags | PASS | Jo (`st-05`), `/firm/admin`: threshold changes persist and affect variance flags; revisions/roles enforced. **OPS/B6** restore original thresholds afterward. Required-step text cannot disable core security gates. |
| [x] **FM02** — Sensitive-data protection | PASS | Uncleared staff/client serialization, source views and search mask/restrict protected identifiers; unauthorized reveals fail. **COL/B2/B5/B8**, authorization/visibility tests. |
| [x] **FM03** — Sensitive view logs | PASS | Authorized reveal/document view appends actor/time/target; Jo can inspect safe metadata. **COL/OPS/B5/B6**. Private audit before/after payloads are not serialized in the access-log response. |
| [x] **FM04** — Actual time vs budget | PASS | `/firm/time` saves actual minutes by supplied area; administrator totals compare to original budget. **OPS/B6** prove persistence and visibility. No hours are inferred from budget. |
| [ ] **FM05** — Complete computed engagement status | PARTIAL | Real issue counts, blocking-note gate and individual simulated filing states exist. **OPS/SEA**. There is no complete firm-wide ready/reviewed/filed rollup across missing verification/completeness gates; “Review not evaluated” is intentional. |
| [ ] **FM06** — Global search including issues | PARTIAL | `/firm/search`: client/ID/year, document, line, lot, amount and authorized conversations work; **CL** proves CL-20417, D23 and interest. **OPS/B6/B8** prove filtering. `firm/search.ts` does not index independent `workpaper_issue` records; an exact check-code query has no issue hit. Review Desk filters are the current issue-finding route. |

## H. CPA records

| Check | Result | Working route / proof and remaining boundary |
|---|---|---|
| [x] **R01** — Return vs prior year | PASS | `B/records/comparison`: actual current/prior amounts, dollar/percentage variance, flags and two-sided source links. **REC/B6/CL variance refs**. Changed payer/detail meanings remain not-comparable. |
| [x] **R02** — Tax computation | PASS | `B/records/computation` plus `B/records/california`: supplied v3 income/deductions/tax/credits/payments with rules and dependencies. **REC/B6**. No engine rerun. |
| [ ] **R03** — Complete area review summaries | PARTIAL | `B/records` provides meaningful area metrics/data/gaps and sources (**REC/B6**). Area-specific review notes, approvals, conclusion and outstanding-work aggregation are not all available together. |
| [ ] **R04** — Full document index filters | PARTIAL | `B/documents`: D31 is corrected/partial; text search matches issuer/type/year and extraction filter works (**B2**). There is no human review-status classification/filter because that overlay is absent. |
| [x] **R05** — Depreciation by asset/regime/year | PASS | `B/records/depreciation`: supplied method/life/bonus, federal/CA/AMT, disposals/recapture and prior records. **REC/B6**. No extra California AMT result is computed; six unsupported exact prior-document labels remain gaps. |
| [x] **R06** — Sales detail | PASS | `B/records/sales`: dates/proceeds/basis/adjustments/gain, D74 categories reconcile to 260 source lots. **REC/B6**. Missing crypto basis and M18 missing extraction remain explicit. |
| [ ] **R07** — Every books-to-tax difference explained | PARTIAL | The five-step bridge reconciles supplied totals and links both sides (**REC bridge**); **C04** describes its exact amounts. Aggregated expense difference and unresolved business-use issues do not constitute a complete adjustment-by-adjustment workpaper. |
| [x] **R08** — Rentals/passive losses | PASS | `B/records/rentals`: two activities, rents/expenses/depreciation/disposition, passive limits and prior carryovers. **REC/B6**, opening Fremont passive balance **$6,300** remains source-linked. |
| [ ] **R09** — Every K-1 box accounted for | PARTIAL | `B/records/k1` displays supplied D37/D39 boxes, engine destinations, prior K-1s and missing-return stubs (**REC/B6**). Unused boxes lack formal human exclusion/disposition reasons, as in E02/J06. |
| [x] **R10** — Retirement records and basis | PASS | `B/records/retirement-foreign`: D41–D43, F8606 calculation, prior IRA basis and linked source values. **CL retirement pages/prior basis, REC/B6**. |
| [x] **R11** — Foreign records and currency evidence | PASS | Same area: D36 Swedish records, SEK parameters and foreign-reporting evidence gaps. **CL** resolves actual `ref:fx.SEK.2025_average` = **9.86**; **REF/REC** verify original relationships. An outside filing is not assumed completed. |
| [x] **R12** — Deductions/limits | PASS | `B/records/deductions-credits`: SchA amounts/limits and source/rule traces; D64 remains ambiguous. **REC/REV/B6**. Not a claim that every original claimed amount is substantiated. |
| [x] **R13** — Credits/limits | PASS | Same area: F8812/F8863/F2441/F8995 original inputs, phaseouts/limits and allowed/disallowed computations. **REC/B6**. Due diligence completion is separately missing under J04. |
| [x] **R14** — Payments and designated year | PASS | `B/records/payments`: D68's September **$3,500 → 2024**, agency 2025 total **$10,500** versus F540NR.72 **$14,000**. **REV/REC/B3/B6**; no transfer is invented. |
| [x] **R15** — Federal/California split | PASS | `B/records/california`: actual July move/residency, California-source vs total-under-CA-law/federal values and traceable supplied allocation. **REC/B6**. |
| [ ] **R16** — Complete carryover rollforward | PARTIAL | `B/records/carryovers` shows source-linked opening balances, selected utilization computations and original output balances (**REC**). There is no uniform opening/used/added/closing approved rollforward for every carryover category. |
| [x] **R17** — Basis by year with gaps | PASS | `B/records/basis`: actual S-corp/partnership/IRA history and null unknown years; computed assumptions are separate. **REC/B6**. Missing 2023 ending S-corp basis is not silently filled from a K-1 or capital account. |
| [ ] **R18** — Prior preparer vs our changes | PARTIAL | `B/records/prior-treatment`: D07/prior memo and current original-engine treatment link correctly (**REC/B6**). The current team has no Phase 4 tax-correction history or complete reason-for-every-change ledger to show. |

## Submission requirements

| Check | Result | Working route / proof and remaining boundary |
|---|---|---|
| [ ] **S01** — Public working app link | BLOCKED | Local `/firm` and signed roles/persistent PostgreSQL work (**B1/B8**). No public deployment exists. Hosting project/login and reachable remote PostgreSQL are missing; original source-byte release discrepancy must be addressed. [Exact unblock checklist](DEPLOYMENT_HANDOFF.md). |
| [x] **S02** — One-page idea/model | PASS | [PRODUCT_AND_DATA_MODEL.md](PRODUCT_AND_DATA_MODEL.md), 451 words, actual immutable source/overlay model; `/handoff` downloads real bytes. **DEL/B8**. |
| [x] **S03** — Actual findings and demonstration | PASS | [FINDINGS_REPORT.md](FINDINGS_REPORT.md), JSON and seven actual masked screenshots with routes/hashes. **DEL/REV/B8**. Four confirmed mismatches, two uncertain findings, one passing control; warnings are not all called errors. |
| [ ] **S04** — Personal video URL | BLOCKED | [VIDEO_SCRIPT.md](VIDEO_SCRIPT.md) is ready; recording and actual shareable URL must be supplied by the human applicant. No invented video link. AI/tool assistance is disclosed in [AI_USAGE.md](../AI_USAGE.md). |

## Ten end-to-end checks

| Check | Result | Reproducible proof / blocker |
|---|---|---|
| [x] **X01** — Fresh entry, role and household navigation | PASS | **B1** exercises native entry, one household search, every primary destination, signed role persistence and fresh context. |
| [x] **X02** — Forward highlighted source and reverse uses | SIMULATION PASS | **CL wages, B2 interest, B8 keyboard**. Real packet refs and literal printed fields, simulated document view. |
| [x] **X03** — Reproducible independent mismatch | PASS | **REV/B3/DEL**, e.g. D68 tax-year mismatch or duplicate D23 pages. |
| [ ] **X04** — Adjustment refresh preserving original/audit | PARTIAL | **SEA/B7** prove isolated modeled adjustments; **OPS/B6** prove lot overlays. Live tax/source correction is unavailable under CH01. |
| [ ] **X05** — Source edit reopens affected reviewer sign-off | MISSING | Phase 4 verification/sign-off/dependency layer is absent. Simulation-level approval invalidation is not this wages-source acceptance test. |
| [x] **X06** — Client private-note UI/API isolation | PASS | **COL/B5/B8** exercise direct read/search/attachment/export/cursor boundaries, not just hidden navigation. |
| [x] **X07** — Rejection → correction → acceptance and freeze | SIMULATION PASS | **SEA/B7** use supplied acknowledgment records, dated D71 and immutable accepted bytes. |
| [x] **X08** — Independent offline 2028 notice package | SIMULATION PASS | **SEA/B7** open self-contained HTML offline; original-v3 and modeled assumptions remain distinct. |
| [ ] **X09** — Suites, responsive/keyboard and every control | PARTIAL | Full suites/build and desktop/tablet/mobile/keyboard journeys are executed. Boundary controls and every interaction family were audited, but missing checklist operations and ordinary exact-source guard failures prevent blanket acceptance. No full assistive-technology/cross-browser certification is claimed. |
| [ ] **X10** — All four submissions, external simulation disclosure | BLOCKED | Model/findings/disclosure ready; public app and recorded video URLs are absent. Full feature gaps above remain. |

## Highest-priority incomplete flow

1. **E03 → CH01 → P05/CH07 → J06/J07:** implement real persistent verification/corrections, dependency-level stale sign-offs, compensating undo and completeness gates. The current simulation model cannot substitute for this review loop.
2. Finish specific workflow gaps: overdue indicators (**P09**), distinct approval/authorization lifecycle (**P12**), complete issue search (**FM06**), and area/document/K-1/carryover/treatment dispositions and summaries (**E02, R03/R04/R09/R16/R18**).
3. Finish adjustment-level business reconciliation (**C04/R07**), judgment/election/diligence/penalty/outside-filing decisions (**J02–J08**), and next-year carryforward/planning (**F08/F09**).
4. Follow [DEPLOYMENT_HANDOFF.md](DEPLOYMENT_HANDOFF.md), personally verify the release, record the video and supply both actual URLs (**S01/S04**).

## Fresh execution results and source integrity

Fresh run: **October 16, 2026 UTC** (October 15 in the local America/Phoenix timezone).

| Exact command | Actual result |
|---|---|
| `npm run test:canonical` | **PASS: 120 tests / 13 files**, 20.79 seconds; complete current unit and real PostgreSQL integration suite. |
| `npm run validate:canonical` | **PASS:** 74 documents / 199 pages / 3,012 values, 68/2/4 states, 625/625/627 lines, 29 events, five scenarios, six staff, two clients; no direct calculation cycles or missing input/source targets; six disclosed deeper prior-asset provenance gaps. |
| `npm run build` | **PASS:** production Next.js build. No application code was changed after it. |
| `npm run lint` | **PASS:** ESLint, including the new checklist test file. |
| `npm run typecheck` | **PASS:** TypeScript with the final checklist tests, after restoring only the build-generated `next-env.d.ts` change. |
| `npm run findings:check` | **PASS:** source-only Markdown/JSON report still deterministic against original bytes. |
| `npm run audit:check` | **PASS:** existing 70-row Coverage audit still matches its registry. |
| `npm run test:e2e -- tests/e2e/checklist.spec.ts` | **PASS: 3/3**, 12.8 seconds, after correcting the new test to open the K-1 related-return disclosure before clicking its hidden link. |
| `npm run test:e2e` | **Final full rerun PASS: 39/39 Chromium tests, 2.0 minutes.** The first expanded run was 38/39, failing only the new test's closed-disclosure navigation; no product fix was required. |
| `git diff --check` | **PASS:** no whitespace errors; read-only Git inspection also confirms unchanged HEAD `00d2aaf` and no staged files. |

The final browser run includes all original regression suites and the three new checklist cases. Independent source checks, 260-lot grouping, refresh/new-session persistence, two-window conflicts, server permissions/search/export privacy, all 15 area traces, all five what-ifs, replay, scripted filing recovery, immutable snapshots and actual offline HTML are exercised. B8 repeats responsive navigation at desktop 1536×960, landscape tablet 1024×768, portrait tablet 768×1024 and mobile 390×844, keyboard-only tracing and textual status checks. These tests do not check off missing functionality or claim exhaustive manual usability certification.

`test-results/checklist-observed-limits.json` records actual runtime observations, without asserting that missing features should remain missing:

```json
{"issueSearch":{"query":"INTEREST_SWEEP_OVERLAP","total":0,"kinds":[]},"deadline":{"dueDate":"2026-06-22","hasOverdueIndicator":false}}
```

The unchanged original is SHA-256 `ee01f8508bd2fd9854754b82fd9c4a055bdc55e2778a132002a25381c412ad19`. The preserved working copy has the pre-existing leading newline, SHA-256 `975f9307b703888e8e44089b398d57157089bfa4a913c07aa85f299debbea7ef`. Canonical verification reads separately SHA-checked original Git bytes while running the **current uncommitted** source/tests against real isolated PostgreSQL; it never weakens the importer or rewrites source data. Ordinary `npm run test` / `npm run validate:packet` were already observed failing this guard in Phase 8, were not rerun here, and were not relabeled as passing. A release still needs reviewed original bytes as explained in the deployment checklist.

Files added in this validation: this report and `tests/e2e/checklist.spec.ts`; AI disclosure updated in `AI_USAGE.md`; browser screenshots/observations under ignored `test-results/checklist-*`. Existing Phase 8 finding PNGs/manifest are recaptured by its real browser test. No product feature implementation or commit/push was performed. Human review, deployment/restart verification and the personal recording remain unperformed external actions.

Report integrity checks passed: all 80 supplied IDs occur once; checked rows have actual PASS/SIMULATION PASS status; all 22 report file links resolve; all seven refreshed finding screenshot hashes match their manifest; original working-file hash and Git HEAD are unchanged.
