CREATE TABLE IF NOT EXISTS silver.hub_users (
 id text PRIMARY KEY,
 email text NOT NULL UNIQUE,
 display_name text NOT NULL,
 password_hash text NOT NULL,
 role text NOT NULL CHECK(role IN ('owner','editor')),
 created_at timestamptz NOT NULL DEFAULT now(),
 last_seen_at timestamptz,
 disabled_at timestamptz
);
CREATE TABLE IF NOT EXISTS silver.user_login_throttle (
 email text PRIMARY KEY,
 attempts integer NOT NULL DEFAULT 0,
 window_start timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE silver.association_audit ADD COLUMN IF NOT EXISTS actor_id text;
CREATE TABLE IF NOT EXISTS silver.site_publications (
 organizer_id text NOT NULL,
 event_id text NOT NULL,
 published_at timestamptz NOT NULL DEFAULT now(),
 actor_id text NOT NULL,
 withdrawn_at timestamptz,
 PRIMARY KEY(organizer_id,event_id),
 FOREIGN KEY(organizer_id,event_id) REFERENCES silver.events(organizer_id,event_id)
);
CREATE TABLE IF NOT EXISTS silver.publication_audit (
 id text PRIMARY KEY,
 organizer_id text NOT NULL,
 event_id text NOT NULL,
 action text NOT NULL CHECK(action IN ('publish','withdraw')),
 actor_id text NOT NULL,
 changed_at timestamptz NOT NULL DEFAULT now()
);
