# ADR-001 — Local monolith first (Next.js + Route Handlers)

Status: accepted · Date: 2026-09-27 · Phase: 2

## Decision
Build the MVP as a single Next.js App Router codebase. Browser pages and
backend endpoints (Route Handlers) live in `tenderflow-app/`. No separate
FastAPI/Express service for the MVP. No deployment at this stage; everything
runs on the developer machine (`npm run dev` + local Postgres when wired).

## Why
- One process to run locally, one language for the shell, smallest ops load.
- Workspace UI is table/dashboard heavy — Next.js + React fits directly.
- Route Handlers are enough for intake, matrix CRUD, library, QC job triggers.

## Consequences
- Long AI/PDF jobs must run outside request handlers (local worker/queue, Phase 3+).
- If Python parsing proves necessary, add a small local worker later — the
  Next.js app stays the system of record.
