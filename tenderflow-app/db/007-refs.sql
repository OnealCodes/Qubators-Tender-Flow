-- TenderFlow migration 007 — product correction: refs + kinds.
-- Apply: Get-Content db\007-refs.sql -Raw | docker exec -i tenderflow-db psql -U tenderflow -d tenderflow

ALTER TABLE requirements ADD COLUMN IF NOT EXISTS ref TEXT;
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'requirement';
CREATE INDEX IF NOT EXISTS idx_requirements_ref ON requirements(tender_id, ref, superseded);
