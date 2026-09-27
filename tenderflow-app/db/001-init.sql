-- TenderFlow migration 001 — Phase 3 intake (tenders + parsed pages).
-- Applied manually once local Postgres runs (psql $DATABASE_URL -f db/001-init.sql).
-- Later phases add: requirements, deliverables, assignments, library_docs,
-- uploads, qc_results, activities (see IMPLEMENTATION_PLAN Phase 2 sketch).

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenders (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  client TEXT,
  title TEXT,
  reference TEXT,
  scope TEXT,
  submission_deadline TEXT,
  clarification_deadline TEXT,
  clarification_meeting TEXT,
  submission_format TEXT,
  instructions TEXT,
  bucket_counts JSONB NOT NULL DEFAULT '{}',
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  page_count INTEGER NOT NULL DEFAULT 0,
  scanned BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'intake',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tender_pages (
  tender_id TEXT NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  page_no INTEGER NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  char_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tender_id, page_no)
);

INSERT INTO companies (id, name) VALUES ('demo-company', 'Demo Company')
ON CONFLICT (id) DO NOTHING;
