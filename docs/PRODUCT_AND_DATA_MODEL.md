# Miraflores: evidence before confidence

**One-page product and data-model statement · CL-20417 · 2025**

The workpaper is a review record for one supplied household, not a spreadsheet or AI agent. A CPA starts with an independent finding, inspects the actual printed evidence next to the engine's number, records a dated decision or asks a linked question, and sees what remains open. A new reviewer can follow the same references in either direction without reconstructing the preparer's reasoning.

**Three kinds of truth stay distinct.** `printed_content` represents what the document says. Extracted values record what the pipeline read, including confidence and mistakes. The immutable v1/v2/v3 engine outputs record what the engine used. Human notes, answers and modeled simulation changes never overwrite these sources. Simulated documents render all supplied page text; only supportable literal spans receive field links. Synthetic coordinates do not imply PDF/OCR precision.

| Model | Actual storage and purpose |
|---|---|
| Immutable source | `packet_import` stores exact original bytes, JSONB and SHA-256. `source_document`, `source_value`, `engine_version`, `engine_line` and `packet_auxiliary` are read-only projections protected by PostgreSQL triggers. |
| Reference index | A typed resolver reads actual line `inputs`/`sources`, document/page and extracted-value IDs, client evidence, RFC 6901 prior-year/agency pointers, assets and parameters. Recursive traversal detects missing references and cycles; a reverse index shows downstream line use. No graph database or replacement tax engine exists. |
| Review and collaboration | Separate tables persist issue dispositions, source-linked threads/questions, dated answers, blocking notes, files, assignments, notifications, lot-review observations, standards, preferences and actual work time. Every successful state change appends an audit event; revisions reject conflicting writes with 409. |
| Identity and lifecycle | Canonical identities, engagement access and database-backed signed demo sessions enforce permissions on the server. A persistent source clock limits historical availability. Filing simulations retain separate modeled assumptions, fingerprinted authorizations, immutable accepted snapshots and amendment parents. |

Client projections exclude internal notes and staff review data. Uncleared views mask protected identifiers; authorized reveals and sensitive source views are logged. PostgreSQL persists sessions, overlays and attachment bytes across refresh and new sessions. Three-second polling supplies engagement updates while preserving unsaved drafts.

The stack is the existing Next.js App Router, strict TypeScript/React, Tailwind, Drizzle and PostgreSQL, with Vitest and Playwright. Five named alternatives are exact packet precomputations; custom tax effects are labeled supplied-rate estimates. No engine rerun, real e-file or regulated signature is claimed.

**Limits:** Phase 4 production corrections, verification and dependency-level sign-offs are absent. Simulation exceptions do not establish an accurate filed liability. Standalone source inspection before the first computation and next-year computation remain incomplete. Public deployment needs hosting/remote-database access; the personal video must be recorded by the applicant. Full requirement dispositions and evidence appear in the accompanying audit and findings report.
