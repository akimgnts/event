CREATE SCHEMA IF NOT EXISTS bronze;
CREATE SCHEMA IF NOT EXISTS silver;
CREATE SCHEMA IF NOT EXISTS gold;
CREATE TABLE IF NOT EXISTS bronze.runs (
 id text PRIMARY KEY, provider text NOT NULL, account_id text NOT NULL,
 started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 status text NOT NULL CHECK(status IN ('running','success','error')), row_count integer, error_code text
);
CREATE TABLE IF NOT EXISTS bronze.records (
 run_id text NOT NULL REFERENCES bronze.runs(id), kind text NOT NULL, external_id text NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT now(), payload jsonb NOT NULL, checksum text NOT NULL,
 PRIMARY KEY(run_id,kind,external_id)
);
CREATE TABLE IF NOT EXISTS silver.events (
 organizer_id text NOT NULL, event_id text NOT NULL, name text NOT NULL,
 starts_at timestamptz, ends_at timestamptz, timezone text, status text NOT NULL,
 capacity integer, source text NOT NULL, synced_at timestamptz NOT NULL, PRIMARY KEY(organizer_id,event_id)
);
CREATE TABLE IF NOT EXISTS silver.tickets (
 organizer_id text NOT NULL, ticket_id text NOT NULL, event_id text NOT NULL,
 status text NOT NULL, channel text NOT NULL, price_cents bigint NOT NULL,
 organizer_fee_cents bigint, user_fee_cents bigint, currency text NOT NULL,
 order_id text NOT NULL, ordered_at_raw text NOT NULL, sale_day date NOT NULL,
 scanned boolean NOT NULL, canceled boolean NOT NULL, utm_source text, utm_medium text,
 synced_at timestamptz NOT NULL, PRIMARY KEY(organizer_id,ticket_id)
);
CREATE TABLE IF NOT EXISTS silver.campaign_daily (
 account_id text NOT NULL, campaign_id text NOT NULL, day date NOT NULL,
 currency text NOT NULL, campaign_name text NOT NULL, spend numeric NOT NULL,
 impressions bigint NOT NULL, clicks bigint NOT NULL, synced_at timestamptz NOT NULL,
 PRIMARY KEY(account_id,campaign_id,day)
);
CREATE TABLE IF NOT EXISTS silver.event_links (
 organizer_id text NOT NULL, event_id text NOT NULL, provider text NOT NULL,
 account_id text NOT NULL, external_id text NOT NULL,
 PRIMARY KEY(provider,account_id,external_id),
 FOREIGN KEY(organizer_id,event_id) REFERENCES silver.events(organizer_id,event_id)
);
CREATE OR REPLACE VIEW gold.event_totals AS
SELECT e.organizer_id,e.event_id,e.name,e.starts_at,e.status,e.capacity,e.source,e.synced_at,
 t.currency, t.valid_tickets,t.paid_tickets,t.face_value,t.scanned,t.orders,t.last_sync_at
FROM silver.events e LEFT JOIN (
 SELECT organizer_id,event_id,currency,
 count(*) FILTER(WHERE status='valid' AND NOT canceled) AS valid_tickets,
 count(*) FILTER(WHERE status='valid' AND NOT canceled AND price_cents>0 AND channel NOT IN ('invitation','duplicata')) AS paid_tickets,
 sum(price_cents) FILTER(WHERE status='valid' AND NOT canceled AND channel NOT IN ('invitation','duplicata'))::numeric/100 AS face_value,
 count(*) FILTER(WHERE scanned AND status='valid' AND NOT canceled) AS scanned,
 count(DISTINCT order_id) FILTER(WHERE status='valid' AND NOT canceled) AS orders,
 max(synced_at) AS last_sync_at
 FROM silver.tickets GROUP BY organizer_id,event_id,currency
) t ON t.organizer_id=e.organizer_id AND t.event_id=e.event_id;
CREATE OR REPLACE VIEW gold.event_daily AS
SELECT organizer_id,event_id,sale_day,currency,
 count(*) FILTER(WHERE status='valid' AND NOT canceled) AS valid_tickets,
 sum(price_cents) FILTER(WHERE status='valid' AND NOT canceled AND channel NOT IN ('invitation','duplicata'))::numeric/100 AS face_value,
 max(synced_at) AS last_sync_at FROM silver.tickets GROUP BY organizer_id,event_id,sale_day,currency;
CREATE OR REPLACE VIEW gold.organizer_daily AS
SELECT organizer_id,sale_day,currency,sum(valid_tickets) AS valid_tickets,sum(face_value) AS face_value,
 max(last_sync_at) AS last_sync_at FROM gold.event_daily GROUP BY organizer_id,sale_day,currency;
CREATE OR REPLACE VIEW gold.event_ads_daily AS
SELECT l.organizer_id,l.event_id,c.day,c.currency,sum(c.spend) AS spend,sum(c.impressions) AS impressions,
 sum(c.clicks) AS clicks,max(c.synced_at) AS last_sync_at
FROM silver.campaign_daily c JOIN silver.event_links l
 ON l.provider='meta' AND l.account_id=c.account_id AND l.external_id=c.campaign_id
GROUP BY l.organizer_id,l.event_id,c.day,c.currency;
