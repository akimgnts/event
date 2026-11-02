-- Proposed schema only. Apply after verifying real provider payloads.
CREATE TABLE IF NOT EXISTS organizers (
  organizer_id TEXT PRIMARY KEY, name TEXT NOT NULL, timezone TEXT NOT NULL DEFAULT 'Europe/Paris'
);
CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY, organizer_id TEXT NOT NULL REFERENCES organizers(organizer_id),
  title TEXT NOT NULL, starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ,
  capacity INTEGER CHECK (capacity IS NULL OR capacity >= 0), status TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS event_source_links (
  event_id TEXT NOT NULL REFERENCES events(event_id), provider TEXT NOT NULL,
  external_object_id TEXT NOT NULL, object_type TEXT NOT NULL,
  PRIMARY KEY(event_id,provider,external_object_id,object_type)
);
CREATE TABLE IF NOT EXISTS ingestion_runs (
  run_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organizer_id TEXT NOT NULL REFERENCES organizers(organizer_id),
  provider TEXT NOT NULL, started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ, status TEXT NOT NULL, row_count INTEGER,
  error_code TEXT, cursor TEXT
);
CREATE TABLE IF NOT EXISTS bronze_records (
  provider TEXT NOT NULL, external_id TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL, payload_sha256 TEXT NOT NULL,
  run_id BIGINT REFERENCES ingestion_runs(run_id),
  PRIMARY KEY(provider,external_id,payload_sha256)
);
CREATE INDEX IF NOT EXISTS idx_bronze_provider_observed ON bronze_records(provider,observed_at);
-- Silver and Gold are intentionally deferred until field definitions are validated.
