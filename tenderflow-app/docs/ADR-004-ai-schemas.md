# ADR-004 — Versioned AI JSON contracts (extract/v1, qc/v1)

Status: accepted · Date: 2026-09-27 · Phase: 2

## Decision
All future AI features speak versioned, schema-locked JSON only. Prompts
are versioned (`extract/v1`, `qc/v1` in `lib/ai-schemas.ts`). The app
validates every model response against the matching JSON Schema and rejects
anything that does not parse — no free-text requirement rows, no silent
drops. The provider stays swappable behind an OpenAI-compatible adapter.

## Contracts
- `extract/v1`: requirements + deliverables + type + risk + risk reason +
  source grounding (`section_id`, `source_page`, `source_span`). Parents
  preserve sub-items; conditional items are flagged so they never count as
  missing.
- `qc/v1`: per deliverable+upload verdict
  (`compliant | review | non_compliant | not_reviewed`) plus a checks array
  with per-check pass/fail + detail. Uncertain cases must return `review`,
  never a false `compliant`.

## Grounding rule (PRD must-have)
Every extracted requirement stores page + character span + section id, and
the UI renders the source link. Dates are cited, never hallucinated.

## Human-control rule
AI suggests/detects; humans verify/assign/approve/resolve. Readiness only
counts human-accepted evidence (`accepted_by` set).
