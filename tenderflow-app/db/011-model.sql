-- TenderFlow migration 011 — extraction v2 foundations (Phase 1).
-- Additive + nullable only. No renames, no drops, no data deletion.
-- Preserves edited rows, owners, statuses and deliverables.
--
-- BACKUP FIRST (required before running on live DB):
--   docker exec tenderflow-db pg_dump -U tenderflow -d tenderflow > backups/tenderflow-pre-011-YYYYMMDD.sql
-- DEV-COPY FIRST (what Phase 1 did):
--   createdb tenderflow_011check, restored the pre-011 backup into it,
--   applied this file there, verified counts + added columns, then applied
--   to the live DB. See task report for exact commands.
-- Apply (live, after backup + dev-copy check):
--   Get-Content db\011-model.sql -Raw | docker exec -i tenderflow-db psql -U tenderflow -d tenderflow

-- ---------- requirements: v2 grouping / grounding fields (all nullable/additive) ----------
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS submission_class TEXT;
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS obligation TEXT;
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS is_fatal_flaw BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS fatal_flaw_quote TEXT;
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS applicability_condition TEXT;
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS source_text TEXT;
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS display_title TEXT;
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS stable_key TEXT;
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS context TEXT;
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS confidence REAL;
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS review_reason TEXT;

-- Value guards only (no backfill of opinions — classification stays NULL until v2 runs).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_requirements_submission_class') THEN
    ALTER TABLE requirements ADD CONSTRAINT chk_requirements_submission_class
      CHECK (submission_class IS NULL OR submission_class IN ('bid_submission','commercial','evaluation','post_award','informational'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_requirements_obligation') THEN
    ALTER TABLE requirements ADD CONSTRAINT chk_requirements_obligation
      CHECK (obligation IS NULL OR obligation IN ('mandatory','conditional','optional','informational'));
  END IF;
END $$;

-- stable_key: ref | section | start of normalised source text (NO class, NO full-text hash).
-- Survives AI reclassification + small wording edits by design.
CREATE INDEX IF NOT EXISTS idx_requirements_stable_key ON requirements(tender_id, stable_key);

-- ---------- deliverables: typed supporting details ----------
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS detail_type TEXT;
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS detail_value JSONB;
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS source_text TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_deliverables_detail_type') THEN
    ALTER TABLE deliverables ADD CONSTRAINT chk_deliverables_detail_type
      CHECK (detail_type IS NULL OR detail_type IN ('evidence','year','threshold','sensitivity','quantity','person','equipment','rate','document'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_deliverables_detail_type ON deliverables(detail_type);

-- ---------- extraction_runs: prompt + schema version for future chunk cache keys ----------
ALTER TABLE extraction_runs ADD COLUMN IF NOT EXISTS prompt_version TEXT;
ALTER TABLE extraction_runs ADD COLUMN IF NOT EXISTS schema_version TEXT;

-- ---------- backfill: display/grounding/match keys only, never touch human state ----------
-- display_title defaults to the current title; source_text to description-then-title.
UPDATE requirements SET display_title = COALESCE(NULLIF(display_title, ''), title) WHERE display_title IS NULL;
UPDATE requirements SET source_text = COALESCE(NULLIF(source_text, ''), description, title) WHERE source_text IS NULL;

-- stable_key backfill: ref | section | START of normalised source text (NO class, NO full-text hash).
-- NULL ref/section handled as empty strings so Damas-style RFQs still get a key.
-- Source is cut to its first 80 chars so small trailing edits keep the same key.
UPDATE requirements
SET stable_key = LEFT(
  REGEXP_REPLACE(REGEXP_REPLACE(LOWER(TRIM(COALESCE(ref, ''))), '[^a-z0-9]+', ' ', 'g'), ' +', ' ', 'g')
  || '|' ||
  REGEXP_REPLACE(REGEXP_REPLACE(LOWER(TRIM(COALESCE(section, ''))), '[^a-z0-9]+', ' ', 'g'), ' +', ' ', 'g')
  || '|' ||
  LEFT(REGEXP_REPLACE(REGEXP_REPLACE(LOWER(TRIM(COALESCE(source_text, title, ''))), '[^a-z0-9]+', ' ', 'g'), ' +', ' ', 'g'), 80)
, 120)
WHERE stable_key IS NULL;

-- NOTE: owner, due_date, status, edited, superseded are untouched by this migration.
-- deliverables titles/details/statuses/owners untouched (new columns stay NULL until v2).
