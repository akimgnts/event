CREATE TABLE IF NOT EXISTS silver.shotgun_traffic (
 organizer_id text NOT NULL,
 event_id text NOT NULL,
 payload jsonb,
 traffic_last_update timestamptz,
 collected_at timestamptz,
 attempted_at timestamptz NOT NULL,
 status text NOT NULL CHECK(status IN ('available','unavailable')),
 error_code text,
 PRIMARY KEY(organizer_id,event_id),
 FOREIGN KEY(organizer_id,event_id) REFERENCES silver.events(organizer_id,event_id)
);
