-- TenderFlow migration 009 — upload dedup (file hash).
-- Apply: Get-Content db\009-hash.sql -Raw | docker exec -i tenderflow-db psql -U tenderflow -d tenderflow

ALTER TABLE tenders ADD COLUMN IF NOT EXISTS file_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_tenders_hash ON tenders(company_id, file_hash);
