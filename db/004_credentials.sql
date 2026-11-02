CREATE TABLE IF NOT EXISTS silver.credential_health (
 credential text PRIMARY KEY,
 status text NOT NULL,
 expires_at timestamptz,
 data_access_expires_at timestamptz,
 checked_at timestamptz NOT NULL,
 error_code text
);
