-- TenderFlow migration 008 — AI refinement assessments (Gemini).
-- Apply: Get-Content db\008-ai.sql -Raw | docker exec -i tenderflow-db psql -U tenderflow -d tenderflow

-- One assessment per requirement per AI run. Verdicts are suggestions only;
-- rows change only when a human clicks Apply.
CREATE TABLE IF NOT EXISTS ai_assessments (
  id TEXT PRIMARY KEY,
  tender_id TEXT NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  requirement_id TEXT NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  verdict TEXT NOT NULL DEFAULT 'keep',
  detail TEXT,
  model TEXT NOT NULL DEFAULT '',
  applied BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_tender ON ai_assessments(tender_id, run_id);
