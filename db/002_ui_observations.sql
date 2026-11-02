CREATE TABLE IF NOT EXISTS silver.automation_observations (
 account_id text NOT NULL, flow_id text NOT NULL, flow_name text NOT NULL,
 event_id text, sends integer NOT NULL CHECK(sends>=0), clicks integer NOT NULL CHECK(clicks>=0),
 ctr numeric NOT NULL CHECK(ctr>=0 AND ctr<=100), replies integer CHECK(replies>=0),
 source_url text NOT NULL, observed_at timestamptz NOT NULL,
 source text NOT NULL DEFAULT 'manychat_ui' CHECK(source='manychat_ui'),
 PRIMARY KEY(account_id,flow_id,observed_at)
);
