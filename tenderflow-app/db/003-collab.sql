-- TenderFlow migration 003 — Phase 5 collaboration (evidence, comments, activity).
-- Apply: Get-Content db\003-collab.sql -Raw | docker exec -i tenderflow-db psql -U tenderflow -d tenderflow

CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  deliverable_id TEXT NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_by TEXT NOT NULL DEFAULT 'bid-manager',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  deliverable_id TEXT NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  author TEXT NOT NULL DEFAULT 'bid-manager',
  kind TEXT NOT NULL DEFAULT 'comment',
  body TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  tender_id TEXT NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  actor TEXT NOT NULL DEFAULT 'bid-manager',
  action TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_deliv ON evidence(deliverable_id);
CREATE INDEX IF NOT EXISTS idx_comments_deliv ON comments(deliverable_id);
CREATE INDEX IF NOT EXISTS idx_activities_tender ON activities(tender_id, created_at);
