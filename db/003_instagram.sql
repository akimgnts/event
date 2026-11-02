CREATE TABLE IF NOT EXISTS silver.instagram_accounts (
 account_id text PRIMARY KEY, username text NOT NULL, followers_count bigint,
 media_count bigint, synced_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS silver.instagram_media (
 account_id text NOT NULL, media_id text NOT NULL, media_type text NOT NULL,
 published_at timestamptz NOT NULL, permalink text, likes bigint, comments bigint,
 reach bigint, views bigint, interactions bigint, synced_at timestamptz NOT NULL,
 PRIMARY KEY(account_id,media_id)
);
