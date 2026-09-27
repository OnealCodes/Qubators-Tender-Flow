# TenderFlow — Implementation Plan (Phased)

**Repo:** `Qubators-Tender-Flow` (`Tender Flow/` folder)
**Source of truth:** `PRD for TenderFlow.md` (30 sections, MVP §25 = 12 items)
**Current state:** PRD + README only. No code. `main` clean and synced with `origin/main` (commit `6a82340`).
**North star:** `Upload → Understand → Assign → Collect → Match → QC → Resolve → Submit`
**Philosophy:** AI extracts/suggests/detects → human verifies/assigns/approves/resolves/decides.

> **Decided technology direction (2026-09-26, owner decision — see PRD note):**
> - Database: **PostgreSQL from the beginning** (not SQLite), running **locally via Docker** when needed.
> - Local-first: Next.js + TypeScript + Tailwind (frontend) + Next.js Route Handlers (backend) + local `uploads/` storage. No deployment stage yet.
> - Auth: **Better Auth** (free/open-source), if it remains the best local fit at implementation time.
> - Cost principle: prefer free/open-source + local. No Supabase/hosted DB, no paid subscriptions, no billable cloud resources without explicit approval. Cloudflare R2 only evaluated later if local storage becomes insufficient.

This plan goes from design system → architecture → phased build → hardening → post-MVP. It does not claim anything is built yet.

---

## 0. What was reviewed

```
Qubators Project/
├── .gitignore          # contains: French game/ (root is container, not a repo)
├── .git-backup/        # old root .git, kept as backup
├── Tender Flow/        # <-- GitHub repo Qubators-Tender-Flow
│   ├── .git/
│   ├── PRD for TenderFlow.md
│   └── README.md
└── French game/        # separate repo Oneal-Conjugue, out of scope here
    ├── .git/
    ├── PRD_Oneal_Conjugue.md
    └── README.md
```

Key PRD constraints driving this plan:
- Parent requirement → sub-items/deliverables (e.g. Nigerian ownership → CO2, CO7, NOGIC JQS, NUPRC). Each sub-item has own status.
- Every extraction must link back to source section/page.
- Classification: document / information / form-template / evidence / action / conditional. Conditional must not count as missing.
- Matching ≠ compliance. QC statuses: 🟢 Appears compliant / 🟡 Review required / 🔴 Potential non-compliance / ⚪ Not reviewed.
- Risk: Critical / Mandatory / Conditional / Supporting / Informational + human-readable reason.
- MVP = 12 items (§25). Explicit non-MVP (§26): pricing engine, CRM, procurement/contract, invoicing, execution, advanced analytics, heavy integrations, multi-industry.

---

## Phase 0 — Foundations & Repo Hygiene (0.5–1 week)

**Goal:** make the repo safe to build in.

- [ ] Add `LICENSE` (e.g. proprietary or MIT — decide before pilot), `CONTRIBUTING.md`, PR template.
- [ ] Add `.gitignore` for code (Node, Next, Python, env), `.env.example`, `README` run section placeholder.
- [ ] Decide branching: `main` (protected) + `dev` + short-lived `feat/*`. Require PR + 1 review.
- [ ] Decide issue tracking: GitHub Projects board with columns: Backlog → Design → Build → AI-eval → Review → Done. One issue per MVP slice below.
- [ ] Freeze scope: MVP = PRD §25 only. Everything else goes to `Post-MVP` milestone.
- [ ] Collect 2–3 sample tenders (sanitised Chevron-like ITT PDFs) + 10–15 sample company docs (NUPRC, ISO, tax, audited accounts, CVs, HSE policy) as golden test fixtures. No real customer data in repo.

**Done when:** env example exists, board + milestones exist, fixtures stored locally outside git (not committed).

---

## Phase 1 — Design System & UX (1–2 weeks, parallel with Phase 2)

**Goal:** Bid Manager can scan readiness in 10 seconds; owner knows "what, by when, exactly what".

### 1.1 Brand & tokens
- Professional B2B trust palette. Decided (matches `design.html` + app shell):
  - Primary navy `#0A2C4E`, gold accent `#F5B301`, primary blue `#1D4C8D`, background slate `#F6F7F9`, surface white, text `#111827`.
  - QC semantic (must match PRD): green `#16A34A` / amber `#D97706` / red `#DC2626` / neutral `#9CA3AF`.
  - Risk: Critical red solid, Mandatory orange, Conditional purple, Supporting blue, Informational grey.
- Typography: Inter (UI) + IBM Plex Mono (refs/doc IDs). Base 14px tables, 16px reading.
- Radius 10px cards, 8px inputs; shadows minimal; density: comfortable for dashboards, compact for matrix.
- Dark mode: deferred post-MVP.

### 1.2 Layout shells
- App shell: left nav (Tenders, Library, Expiry, Team, Settings), top bar (search, deadline countdown, user).
- Tender Workspace tabs (PRD §4): Overview | Requirements | Matrix | Documents | Assignments | QC | Checklist | Activity.
- Matrix table columns (PRD §6/§21): Section | Requirement | Deliverables | Owner | Due | Status | QC | Source | ⋯. Expandable parent → sub-items. Sticky header, column filters, bulk assign.
- My Tasks view for owners (Oluchi example: 8 items, Pending/In Progress/Received).
- Readiness dashboard: Overall % + 🟢/🟡/🔴/⚪ counts + Critical outstanding + deadline. % always expands to item list (no false confidence).
- Final Review screen: grouped by Requirements/Documents/Content/Forms/Commercial/Nigerian Content/HSE (§19).

### 1.3 Component library (build once, reuse)
`Button, Input, Select, DatePicker, Badge(QC/Risk/Status), Avatar, Table(DataGrid), Drawer(Source preview), FileUploader, Timeline(Activity), EmptyState, ConfirmDialog, Toast, Tooltip(Why this risk?)`
- Source-link drawer: clicking Source opens tender PDF at page/section highlight. This is a PRD must-have (§5).
- Accessibility: keyboard navigable matrix, ARIA for status badges, colour + icon + text (never colour alone).

### 1.4 Prototyping
- Figma (or code prototype) for: Workspace header, Matrix with expanded parent, QC result panel (audited-accounts example from §15), Readiness, Final Checklist.
- Usability test with 1–2 bid managers using Chevron example before coding Phase 3+.

**Done when:** tokens + components documented in `design/` or Storybook, 5 core screens prototyped, source-trace interaction agreed.

**Status 2026-09-27:** Phase 1 built in `tenderflow-app/` — shared shell (sidebar, topbar search, tabs) + 7 routed views (Matrix, Overview, Documents, Assignments, QC, Checklist, Activity) on demo data, matching `design.html` tokens. Source-trace UI (Source drawer opening the tender PDF at page) is still to build in Phase 3+.

---

## Phase 2 — Architecture Decisions (ADRs) (1 week, parallel with Phase 1)

**Goal:** small team can ship MVP without rewrites.

### Recommended MVP stack (decided direction, local-first, change via ADR if needed)

| Concern | Choice | Why |
|---|---|---|
| Frontend | Next.js App Router + TypeScript + Tailwind + shadcn/ui + TanStack Table/Query | Great tables/dashboards, fast iteration, runs locally |
| Backend | Next.js Route Handlers (same app, no separate server) | Avoids separate backend for MVP; runs locally |
| Database | PostgreSQL from day one, running locally via Docker (no SQLite migration, no hosted DB) | TenderFlow data is strongly relational (tenders → requirements → sub-items → assignments → documents → QC → activity); production-suitable from the start |
| DB setup timing | Install/configure Docker + PostgreSQL only when implementation reaches database setup phase | Avoids unnecessary installs during planning/docs work |
| Auth/RBAC | Better Auth (free/open-source, local-first); 2 roles only: Manager / Contributor (see Two-Group Model below) | Works locally, no paid auth service; Managers coordinate, Contributors provide evidence |
| File storage (MVP) | Local project `uploads/` folder | Zero cost, zero setup, sufficient for local MVP |
| File storage (later) | Cloudflare R2 evaluated only if local storage becomes insufficient | Low-cost option, only if genuinely needed |
| AI | Provider-agnostic LLM adapter (OpenAI-compatible first), structured JSON output + function calling | Extraction/QC need schema-locked JSON, easy to swap models |
| PDF parse | Local-first parser worker (PyMuPDF + pdfplumber + Tesseract fallback for scans) or Node worker v1, local job queue | Oil & Gas ITTs are long/scanned; need page numbers + text spans for source links |
| Embeddings | pgvector in local PostgreSQL for library matching + previous-bid reuse | Keeps matching in one local DB, no extra vector service |
| Jobs | Local background worker / file-based queue for MVP; Inngest/BullMQ only if needed later | Long AI jobs must not block requests, but stay local first |
| Hosting | Local only for now (`npm run dev` + local Postgres). No Vercel/Supabase/deployment at this stage | Per owner decision: application and database remain local |
| Notifications | Email first via local/dev SMTP or free tier, in-app bell; SMS/WhatsApp deferred | Reduces chasing (§13) without integration sprawl or subscriptions |

Cost principle: prefer free/open-source + local. Do not create paid accounts, subscriptions, or billable cloud resources without explicit owner approval.

### Data model (v1 sketch)
- `companies(id, name)`; `users(id, company_id, role[manager|contributor], dept)` — 2-group model only; `team_members` view.
- `role` semantics: `manager` = Bid Manager (full workspace control); `contributor` = department owner (tasks only). No admin/viewer/management roles in MVP.
- `tenders(id, company_id, client, title, reference, submission_deadline, clarification_deadline, status, raw_files[])`
- `tender_sections(id, tender_id, title, page_start, page_end)` — for source links.
- `requirements(id, tender_id, section_id, title, description, type[doc|info|form|evidence|action|conditional], risk[critical|mandatory|conditional|supporting|info], risk_reason, source_page, source_span, status)`
- `deliverables(id, requirement_id, title, expected_detail, status, owner_id, due_date)` — sub-items.
- `assignments(id, deliverable_id, assignee_id, assigned_by, due_date, state)`
- `library_docs(id, company_id, name, doc_type, version, issue_date, expiry_date, dept, entity, storage_path, embedding)`
- `evidence_links(id, deliverable_id, library_doc_id | upload_id, match_confidence, accepted_by, accepted_at)` — matching ≠ approval.
- `uploads(id, tender_id, deliverable_id, path, mime, pages)`
- `qc_results(id, deliverable_id, upload_id, verdict[compliant|review|non_compliant|not_reviewed], checks JSON[{label, pass, detail}], created_by_ai, reviewed_by)`
- `activities(id, tender_id, actor_id, action, payload, created_at)` — audit trail.
- `checklists` derived view, not a table (computed from requirements + QC).

### Key ADRs to record
1. Monolith-first (Next.js + local PostgreSQL via Docker) vs separate FastAPI — choose monolith for MVP speed and local simplicity.
2. Two-Group User Model — MVP has exactly 2 roles: Manager + Contributor (see below). PRD §3 secondary roles (Finance/HSE/HR/etc., Management, Doc Admin) map to `contributor` + `dept` field, not separate roles. Management dashboard is read-only Manager view, not a role.
3. Structured-output contract for AI (Zod schemas, versioned prompts `extract/v1`, `qc/v1`).
4. Source grounding: every AI requirement stores `page + char_span + section_id`; UI must render it.
5. File strategy: originals immutable in local `uploads/`; derived text in `tender_pages(page_no, text)`.
6. Multi-tenancy: `company_id` on every row + Postgres row-level checks (app-enforced in MVP, RLS when hardened).
7. No auto-compliance: `accepted_by` human required before QC passes to readiness %.

### Two-Group User Model (Manager + Contributor)
- `Manager` (Bid Manager): creates tenders, edits matrix, assigns/reassigns, accepts/rejects matches, overrides QC with reason, views readiness + final review, manages library/expiry.
- `Contributor` (all requirement owners — Finance, HSE, HR, Operations, Nigerian Content, Commercial, Technical, etc.): sees only My Tasks, uploads evidence, comments, marks complete, flags issues. Cannot reassign, edit matrix structure, or approve QC.
- RLS: Managers full access within own `company_id`; Contributors access only assigned deliverables/uploads, no delete, no matrix schema edits.
- Management views (§24) = Manager read-only dashboard, not a third role. Doc Admin duties = Manager in MVP.

**Done when:** `docs/ADR-*.md` merged, ERD reviewed, Postgres Docker compose verified locally, AI JSON schemas frozen for v1.

**Status 2026-09-27:** ADRs 001–004 recorded in `tenderflow-app/docs/`, `docker-compose.yml` (local pgvector Postgres) added, `extract/v1` + `qc/v1` contracts frozen in `tenderflow-app/lib/ai-schemas.ts`. **Verified live:** Docker Desktop installed, `tenderflow-db` healthy, migration `db/001-init.sql` applied, upload test persists to Postgres (`backend: postgres`).

---

## Phase 3 — Tender Intake + Overview (MVP 1–2)

PRD §5. Upload → parsed pages → overview fields + source links.
- Drag-drop ITT package (PDF, multi-file), progress + virus/size limits, store originals.
- Parse worker: text per page + page count + language detect + scanned-PDF flag.
- AI overview extraction: client, title, scope, refs, deadlines, meetings, instructions, submission format, bucketed requirements counts (Technical/Nigerian Content/HSE/Financial/Commercial).
- Overview screen + Source drawer. Edit + re-run. Activity log.
- Eval: 3 golden ITTs, check deadline extraction accuracy ≥95%, no hallucinated dates (must cite page).

**Status 2026-09-27:** built with local heuristic extraction (no model calls yet). `POST /api/tenders` accepts PDF ≤200 MB, stores the original in `uploads/<id>/`, parses per-page text with pdfjs-dist (scanned PDFs flagged, unreadable files rejected 422), extracts overview fields with page citations, persists via Postgres-when-reachable else local JSON (`lib/tenders.ts`), migration in `db/001-init.sql`. Overview route has drag-drop upload, tender list, and a source drawer showing extracted page text. Verified with a generated 2-page Chevron-like fixture: reference, deadlines, meeting and buckets all correct with page numbers.

---

## Phase 4 — Extraction + Responsibility Matrix (MVP 3–5, heart of product)

PRD §6–§7. The demo moment.
- AI `extract/v1`: requirements + deliverables + type + risk + risk_reason + source. Preserve parent→sub-items.
- Matrix UI: expand/collapse, inline edit, add/split/merge requirements, filter by Section/Type/Risk/Status, search.
- Classification badge + conditional logic (conditional excluded from missing counts).
- Versioning: re-run extraction creates new version with diff; human edits win.
- Eval: on Chevron-like fixture target 83 reqs / 126 deliverables shape; manual spot-check for missed CO2/CO7/NUPRC-type splits. Measure precision/recall; keep human-verify loop prominent.

**Status 2026-09-27:** built with heuristic engine v1 (`lib/extract.ts`: obligation/entity detection, year-split, type + risk + reason, owner suggestion, page sources). `POST /api/tenders/[id]/extract` versions runs with added/removed/carried diff; `PATCH /api/requirements/[id]` edits with human-edits-win carried across re-runs (`lib/requirements.ts`, migration `db/002-requirements.sql`). Matrix route serves real data with tender picker, Section/Type/Risk/Status filters, search, expand/collapse, inline edit, and missing counts excluding conditional. Verified on the 2-page fixture: 5 requirements / 9 deliverables, correct NOGIC+NUPRC / HSE / 2022-2024 splits, critical Commercial rule flagged, PATCH + re-run carried the hand-edit (v3). Test rows reset afterwards.

---

## Phase 5 — Assignment + Collection + Collaboration (MVP 6–7)

PRD §8, §12–§13.
- Suggest owner by dept map + doc-type map + history (heuristic v1, ML later). Bid Manager Accept/Change.
- My Tasks, file upload per deliverable, comments, mark complete, flag issue, request clarification, due dates.
- Reminders: daily digest + overdue nudges (email + in-app). Bid Manager sees overdue by person.
- Presence/activity feed for audit.

**Status 2026-09-27:** built. `POST /api/requirements/[id]/assign` accepts/changes suggested owners with due-date cascade to sub-items (`lib/requirements.ts`); deliverable APIs for evidence upload (PDF/DOC/XLS/PNG/JPG/ZIP ≤200 MB into `uploads/<tender>/evidence/`), status/due edits, and comments with kinds (comment/issue/clarification_request); `GET activity` audit feed auto-logged from upload/extract/assign/evidence/comment/status; `GET reminders` computes overdue + due-within-3-days with overdue-by-owner. Assignments route shows suggestions with Accept/Change, per-owner groups with expandable evidence/notes/status/due controls, and the reminders panel; Activity route reads the real feed. Email digest deferred (no paid service). Verified end-to-end on Postgres: assign → evidence → issue → complete → 1 overdue reminder → 6-entry audit trail.

---

## Phase 6 — Library + Matching + Expiry (MVP 8–9 + §11)

PRD §9–§11.
- Library CRUD + metadata (name, type, owner, version, issue/expiry, dept, entity, status) + deduplication + version history.
- Matching: embedding + rules (e.g. NUPRC → NUPRC) → candidate list with confidence + expiry badge. `Use this document? [Accept][Reject]`.
- Expiry engine: 🔴 expires before submission, 🟠 expires during contract, dashboard table. Cron daily.
- Eval: matching precision on 15-doc fixture; never auto-approve.

**Status 2026-09-27:** built. `library_docs` + `evidence_links` tables (migration `004`); library CRUD with file upload, dedup-by-name+entity versioning, expiry edit, delete (`/api/library`); rule-based matcher v1 (title-weighted entity tags + term overlap, embeddings deferred) with confidence + reasons + expiry badge (`lib/matching.ts`); Accept/Reject recorded with human + timestamp and activity-logged, never auto-approved (`/api/links`); expiry engine red/amber/green/grey vs submission date (`/api/.../expiry` dashboard). Documents route rebuilt: upload form, library table, match suggestions with Use/Reject, expiry dashboard. Verified on Postgres with 6 docs: exact NUPRC/NOGIC high matches, audited-accounts false positives fixed by title weighting, dedup → v2, accept excludes deliverable, reject clears it, expiry 1 red / 1 amber / 2 green.

---

## Phase 7 — Intelligent QC + Risk Engine (MVP 10, differentiator)

PRD §14–§17.
- QC worker `qc/v1` per deliverable+upload: checks array (type, entity, dates/years, completeness, signatures/stamps, template preserved, expiry, version, inconsistencies) → verdict + action message (e.g. "2024 accounts not found").
- Risk engine: rule-based v1 (keywords like "shall lead to disqualification", "no changes allowed" → Critical + reason). LLM assists, rules decide.
- QC panel UI mirroring §15 example. Human override with reason required.
- Eval: build 20-case QC suite (missing year, wrong entity, expired cert, altered template). Track false-compliant rate — must be ~0; prefer Review over false-Compliant.

**Status 2026-09-27:** built. Rules engine v1 (`lib/qc.ts`): document-type, required-years, expiry, company, signatures, template, completeness checks → compliant/review/non-compliant/not-reviewed with per-check evidence + action; uncertainty always resolves to review, never false-compliant. Risk engine refines requirement risk with quoted reasons on every run. `qc_results` + `qc_reviews` tables (migration `005`); run-one/history/run-all/override APIs (`lib/qc-store.ts` resolves latest evidence parsed from PDF, else accepted library link, else none); QC route rebuilt with verdict counts, per-item checks, re-run, and override requiring a reason (effective verdict shown). Eval `scripts/qc-eval.mjs`: **20/20, false-compliant 0**. Verified live: run-all over 9 items, NUPRC library verdict corrected to compliant after title-only tag fix, override + reason-required rejection enforced.

---

## Phase 8 — Readiness + Final Checklist + Compilation (MVP 11–12 + §20 partial)

PRD §18–§20.
- Readiness: computed % (weighted: Critical > Mandatory > others), counts, critical list, deadline countdown. Drill-down everywhere.
- Final Compliance Review grouped checks (§19). Exportable PDF summary. "Ready for final human review" state — never "auto-submit".
- Compilation v1: map deliverables to client structure (Technical → Part A/B/C → Nigerian Content/Financial/HSE/Experience/Equipment & Personnel/Commercial). Generate ordered folder + manifest. Full reformatting deferred.

**MVP Demo script ( dogfood this):** 9:00 upload Chevron PDF → 9:02 overview → 9:05 83 reqs → 9:10 suggest owners → 9:15 library matches → 9:20 tasks sent → uploads QC → readiness + final review.

---

## Phase 9 — Hardening for Pilot (1–2 weeks, still local)

- Security: access-control tests, local signed file access, PII redaction in logs, rate limits, audit export.
- Performance: paginated matrix (100+ rows), PDF streaming, job retries/timeouts, large-file (200MB+) handling.
- Testing: Vitest + Playwright (matrix, QC override, readiness math), AI eval suite (golden fixtures, schema validation).
- Observability: local logs + minimal OSS metrics (funnel: upload→matrix→assignments→QC→ready), cost tracking per AI job.
- Local readiness: `dev` local only; Postgres Docker volume backups; restore drill. Pilot with 1 Nigerian service company, 1 live tender, weekly feedback. No deployment at this stage.

---

## Phase 10 — Post-MVP (do not start early)

Per PRD §21–§24, §30: templates, tender history, reuse-from-previous ("similar to 4 previous"), management dashboard across tenders, tender intelligence search, advanced analytics, integrations (SharePoint/Teams), pricing module. Each gets its own RFC.

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| AI misses requirements → disqualification | Source links + version diff + human-verify gate; eval on golden ITTs |
| False-compliant QC | Bias to Review; human accept required; track override rate |
| Long/scanned PDFs break parsing | OCR fallback + page-level status + manual section mapping |
| Scope creep (§26) | MVP milestone locked; new asks → Post-MVP backlog |
| Data residency/cost (NG) | Local-first Postgres via Docker; local backups; cache extractions; cap tokens/page; no paid services without approval |

---

## Immediate next actions (this week)

1. Approve local-first stack above (or amend via ADR).
2. Create GitHub Projects board + `mvp` milestone with issues for Phases 0–8.
3. Add LICENSE + `.env.example` (no secrets, local Postgres + Better Auth placeholders only).
4. Produce Figma/code prototype for Matrix + QC panel.
5. Gather 3 sanitised ITT fixtures + 15 library docs.

*Last updated: 2026-09-26. Status: plan only, no code yet. Database decision: PostgreSQL via local Docker (owner-approved). No Docker/Postgres install yet — will be done at database setup phase.*
