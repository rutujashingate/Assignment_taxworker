# AI assistance

Codex reviewed the supplied brief/specifications and packet, wrote the Phase 0 validator and inventory, implemented the Phase 1 application, schema, importer and session flow, and added the Phase 2 reference resolver, reverse index, document/return views, masking, evidence view audit and tests. Context7 CLI and installed framework guides supplied current documentation. No LLM runs in the application, and no agent generates tax judgments or modifies engine results.

Codex also implemented Phase 3's deterministic reconciliations, independent findings, database migration, Review Desk, triage permissions/audit and regression tests. These checks use the supplied printed evidence and calculation references; they make no LLM calls and do not rerun a tax engine.

Automated validation and observed browser checks are recorded in `docs/PHASE_1_VALIDATION.md`, `docs/PHASE_2_VALIDATION.md` and `docs/PHASE_3_VALIDATION.md`. Tax discrepancies were checked against supplied printed text, extraction and engine relationships, not external tax-law assumptions. Phase 3 records human triage separately from original evidence, engine diagnostics and unchanged computed amounts. No personal video or deployment is claimed.
