-- TenderFlow migration 006 — Phase 4 tuning v2 (envelopes + run meta).
-- Apply: Get-Content db\006-envelopes.sql -Raw | docker exec -i tenderflow-db psql -U tenderflow -d tenderflow

ALTER TABLE requirements ADD COLUMN IF NOT EXISTS envelope TEXT NOT NULL DEFAULT 'Technical';
ALTER TABLE extraction_runs ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_requirements_envelope ON requirements(tender_id, envelope, superseded);
