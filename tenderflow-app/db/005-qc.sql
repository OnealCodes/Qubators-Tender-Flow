-- TenderFlow migration 005 — Phase 7 QC results + human reviews.
-- Apply: Get-Content db\005-qc.sql -Raw | docker exec -i tenderflow-db psql -U tenderflow -d tenderflow

CREATE TABLE IF NOT EXISTS qc_results (
  id TEXT PRIMARY KEY,
  deliverable_id TEXT NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  source_kind TEXT NOT NULL DEFAULT 'none',
  source_label TEXT,
  verdict TEXT NOT NULL DEFAULT 'not_reviewed',
  checks JSONB NOT NULL DEFAULT '[]',
  action TEXT,
  engine TEXT NOT NULL DEFAULT 'rules/v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Human override: verdict + reason are both required. The latest review
-- is the effective verdict shown in the UI.
CREATE TABLE IF NOT EXISTS qc_reviews (
  id TEXT PRIMARY KEY,
  qc_result_id TEXT NOT NULL REFERENCES qc_results(id) ON DELETE CASCADE,
  reviewer TEXT NOT NULL DEFAULT 'bid-manager',
  verdict TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qc_deliv ON qc_results(deliverable_id, created_at);
CREATE INDEX IF NOT EXISTS idx_qc_reviews_result ON qc_reviews(qc_result_id);
