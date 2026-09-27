# ADR-002 — Better Auth with exactly two roles (Manager + Contributor)

Status: accepted · Date: 2026-09-27 · Phase: 2

## Decision
Use Better Auth (free/open-source, local-first) when login is implemented
(Phase 3+). The MVP has exactly two roles:

- `manager` (Bid Manager): creates tenders, edits the matrix, assigns and
  reassigns, accepts/rejects library matches, overrides QC with a reason,
  views readiness + final review, manages the library/expiry.
- `contributor` (all requirement owners — Finance, HSE, HR, Operations,
  Nigerian Content, Commercial, Technical, …): sees only assigned tasks,
  uploads evidence, comments, marks complete, flags issues. Cannot reassign,
  edit matrix structure, or approve QC.

PRD secondary groups (Finance/HSE/HR/etc., Management, Doc Admin) map to
`contributor` + a `dept` field, not separate roles. The management dashboard
is a read-only manager view. Doc Admin duties are manager duties in the MVP.

## Permissions sketch
- Managers: full control within their own `company_id`.
- Contributors: read assigned deliverables + insert uploads/comments on them;
  no delete, no matrix schema edits, no QC approval.
- Every mutating decision (match accept, QC override, final ready flag)
  records `accepted_by`/`reviewed_by` + timestamp. Matching never
  auto-approves compliance.

## Why Better Auth
- Free/open-source, runs locally with our own Postgres — no paid auth
  service, consistent with the cost principle.
- If it proves a poor fit at implementation time, revisit via a new ADR.
