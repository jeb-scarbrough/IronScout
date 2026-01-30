-- Per scraper-framework-01 spec v0.5 Decision #10:
-- Enforce that scrape_targets.adapterId matches the source's adapterId
-- This prevents configuration drift where targets use different adapters than their sources

-- Add composite FK from scrape_targets(sourceId, adapterId) → sources(id, adapterId)
-- The unique constraint on sources(id, adapterId) already exists: sources_id_adapter_id_unique

ALTER TABLE scrape_targets
ADD CONSTRAINT scrape_targets_source_adapter_fk
FOREIGN KEY ("sourceId", "adapterId")
REFERENCES sources (id, "adapterId")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- Add composite FK from scrape_runs(sourceId, adapterId) → sources(id, adapterId)
-- Ensures runs also respect the source's adapter configuration

ALTER TABLE scrape_runs
ADD CONSTRAINT scrape_runs_source_adapter_fk
FOREIGN KEY ("sourceId", "adapterId")
REFERENCES sources (id, "adapterId")
ON DELETE CASCADE
ON UPDATE CASCADE;
