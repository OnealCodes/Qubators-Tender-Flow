-- TenderFlow migration 004 — Phase 6 library + matching links.
-- Apply: Get-Content db\004-library.sql -Raw | docker exec -i tenderflow-db psql -U tenderflow -d tenderflow

CREATE TABLE IF NOT EXISTS library_docs (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'general',
  version TEXT NOT NULL DEFAULT 'v1',
  version_no INTEGER NOT NULL DEFAULT 1,
  superseded BOOLEAN NOT NULL DEFAULT FALSE,
  issue_date TEXT,
  expiry_date TEXT,
  dept TEXT,
  entity TEXT,
  storage_path TEXT,
  file_size INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'valid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A suggested or accepted link between a deliverable and a library doc.
-- status: proposed (never auto-approved) | accepted | rejected.
CREATE TABLE IF NOT EXISTS evidence_links (
  id TEXT PRIMARY KEY,
  deliverable_id TEXT NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  library_doc_id TEXT NOT NULL REFERENCES library_docs(id) ON DELETE CASCADE,
  match_confidence TEXT NOT NULL DEFAULT 'low',
  match_reasons TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'proposed',
  accepted_by TEXT,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deliverable_id, library_doc_id)
);

CREATE INDEX IF NOT EXISTS idx_library_company ON library_docs(company_id, superseded);
CREATE INDEX IF NOT EXISTS idx_links_deliv ON evidence_links(deliverable_id, status);
