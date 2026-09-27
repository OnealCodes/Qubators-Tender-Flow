-- TenderFlow migration 002 — Phase 4 extraction (requirements + sub-items).
-- Apply: Get-Content db\002-requirements.sql -Raw | docker exec -i tenderflow-db psql -U tenderflow -d tenderflow

CREATE TABLE IF NOT EXISTS extraction_runs (
  id TEXT PRIMARY KEY,
  tender_id TEXT NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  engine TEXT NOT NULL DEFAULT 'heuristic/v1',
  requirement_count INTEGER NOT NULL DEFAULT 0,
  deliverable_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tender_id, version)
);

CREATE TABLE IF NOT EXISTS requirements (
  id TEXT PRIMARY KEY,
  tender_id TEXT NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  run_version INTEGER NOT NULL DEFAULT 1,
  section TEXT NOT NULL DEFAULT 'General',
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'doc',
  risk TEXT NOT NULL DEFAULT 'mandatory',
  risk_reason TEXT,
  suggested_owner TEXT,
  owner TEXT,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'outstanding',
  source_page INTEGER,
  source_span TEXT,
  edited BOOLEAN NOT NULL DEFAULT FALSE,
  superseded BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deliverables (
  id TEXT PRIMARY KEY,
  requirement_id TEXT NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  expected_detail TEXT,
  status TEXT NOT NULL DEFAULT 'outstanding',
  owner TEXT,
  due_date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_requirements_tender ON requirements(tender_id, superseded);
CREATE INDEX IF NOT EXISTS idx_deliverables_req ON deliverables(requirement_id);
