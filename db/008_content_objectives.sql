ALTER TABLE silver.content_links ADD COLUMN IF NOT EXISTS objective text;
ALTER TABLE silver.content_links ADD COLUMN IF NOT EXISTS cta text;
ALTER TABLE silver.content_links ADD COLUMN IF NOT EXISTS expected_kpi text;
