CREATE TABLE IF NOT EXISTS silver.hub_access (
 id integer PRIMARY KEY CHECK(id=1), password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS silver.login_throttle (
 id integer PRIMARY KEY CHECK(id=1), attempts integer NOT NULL DEFAULT 0, window_start timestamptz NOT NULL DEFAULT now()
);
