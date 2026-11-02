ALTER TABLE silver.tickets ADD COLUMN IF NOT EXISTS deal_id text;
ALTER TABLE silver.tickets ADD COLUMN IF NOT EXISTS deal_title text;
ALTER TABLE silver.tickets ADD COLUMN IF NOT EXISTS vat_rate numeric;
ALTER TABLE silver.tickets ADD COLUMN IF NOT EXISTS producer_cost_cents bigint;
ALTER TABLE silver.tickets ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE silver.instagram_media ADD COLUMN IF NOT EXISTS caption text;
ALTER TABLE silver.instagram_media ADD COLUMN IF NOT EXISTS shares bigint;
ALTER TABLE silver.instagram_media ADD COLUMN IF NOT EXISTS saves bigint;
ALTER TABLE silver.instagram_media ADD COLUMN IF NOT EXISTS avg_watch_ms numeric;
ALTER TABLE silver.instagram_media ADD COLUMN IF NOT EXISTS total_watch_ms numeric;
ALTER TABLE silver.instagram_media ADD COLUMN IF NOT EXISTS skip_rate numeric;
ALTER TABLE silver.instagram_media ADD COLUMN IF NOT EXISTS metric_status jsonb;
CREATE TABLE IF NOT EXISTS silver.instagram_account_insights (
 account_id text PRIMARY KEY, since_day date NOT NULL, until_day date NOT NULL,
 metrics jsonb NOT NULL, synced_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS silver.ads (
 account_id text NOT NULL, ad_id text NOT NULL, campaign_id text NOT NULL,
 ad_name text NOT NULL, creative_id text, instagram_media_id text, permalink text,
 synced_at timestamptz NOT NULL, PRIMARY KEY(account_id,ad_id)
);
CREATE TABLE IF NOT EXISTS silver.ad_daily (
 account_id text NOT NULL, ad_id text NOT NULL, campaign_id text NOT NULL,
 day date NOT NULL, currency text NOT NULL, spend numeric NOT NULL,
 impressions bigint NOT NULL, clicks bigint NOT NULL, link_clicks bigint,
 outbound_clicks bigint, synced_at timestamptz NOT NULL,
 PRIMARY KEY(account_id,ad_id,day)
);
CREATE TABLE IF NOT EXISTS silver.ad_video_insights (
 account_id text NOT NULL, ad_id text NOT NULL, since_day date NOT NULL,
 until_day date NOT NULL, metrics jsonb NOT NULL, synced_at timestamptz NOT NULL,
 PRIMARY KEY(account_id,ad_id)
);
CREATE TABLE IF NOT EXISTS silver.content_links (
 account_id text NOT NULL, media_id text NOT NULL, organizer_id text NOT NULL,
 event_id text, classification text NOT NULL CHECK(classification IN ('event','general')),
 evidence text NOT NULL, confirmed_at timestamptz NOT NULL DEFAULT now(),
 CHECK((classification='event' AND event_id IS NOT NULL) OR (classification='general' AND event_id IS NULL)),
 PRIMARY KEY(account_id,media_id),
 FOREIGN KEY(account_id,media_id) REFERENCES silver.instagram_media(account_id,media_id),
 FOREIGN KEY(organizer_id,event_id) REFERENCES silver.events(organizer_id,event_id)
);
CREATE TABLE IF NOT EXISTS silver.association_audit (
 id text PRIMARY KEY, kind text NOT NULL, external_id text NOT NULL,
 previous_event_id text, new_event_id text, classification text NOT NULL,
 evidence text NOT NULL, changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE silver.event_links ADD COLUMN IF NOT EXISTS evidence text NOT NULL DEFAULT 'Organizer confirmed';
ALTER TABLE silver.event_links ADD COLUMN IF NOT EXISTS confirmed_at timestamptz NOT NULL DEFAULT now();
CREATE OR REPLACE VIEW gold.event_marketing AS
SELECT l.organizer_id,l.event_id,c.currency,sum(c.spend) AS spend,
 sum(c.impressions) AS impressions,sum(c.clicks) AS clicks,max(c.synced_at) AS synced_at
FROM silver.campaign_daily c JOIN silver.event_links l
 ON l.provider='meta' AND l.account_id=c.account_id AND l.external_id=c.campaign_id
GROUP BY l.organizer_id,l.event_id,c.currency;
