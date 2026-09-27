# ADR-003 — PostgreSQL from day one, locally via Docker Compose

Status: accepted · Date: 2026-09-27 · Phase: 2

## Decision
PostgreSQL is the only database — no SQLite stage, no hosted DB
(Supabase or other) for the current local stage. It runs on the developer
machine through `tenderflow-app/docker-compose.yml` (official
`pgvector/pgvector:0.8.0-pg16` image so `pgvector` is available in the same
local DB for later library matching). Data persists in a named Docker
volume. Connection string lives in `.env` (see `.env.example`); no secrets
are committed.

## Way to run (once Docker Desktop is installed — pending manual step)
- `docker compose up -d db` (from `tenderflow-app/`)
- `DATABASE_URL=postgresql://tenderflow:tenderflow@localhost:5432/tenderflow`

## Migrations
Plain versioned SQL files (`drizzle/` or `prisma/` to be chosen at Phase 3;
no ORM committed yet). Every table carries `company_id` for multi-tenancy;
access is enforced in the app first, Postgres RLS hardened before any pilot.

## Why
- TenderFlow data is strongly relational (tenders → requirements →
  sub-items → assignments → documents → QC → activity). Starting on the
  production-suitable engine avoids a later SQLite migration.
- Local Docker keeps the free/open-source + local cost principle: zero
  hosting spend, backups via volume snapshots.

## Status note
Docker Desktop is not installed on this machine yet, so the database has
not been started. The compose file is the contract; `docker compose up`
happens at the database setup phase.
