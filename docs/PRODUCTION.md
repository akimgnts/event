# Production deployment

## State
The production stack is prepared, not deployed. No server, DNS hostname or hosting credentials are available in this workspace. Docker is not installed here, so container boot and a real PostgreSQL server are not verified here. Existing successful sync tests use embedded PostgreSQL.

## Architecture
Caddy HTTPS → private Next.js dashboard → PostgreSQL 17 on an internal Compose network. Only ports 80/443 are published. A separate worker runs configured Shotgun, Meta and Instagram reads every 15 minutes. It skips unconfigured sources and ManyChat; no remote write operations exist. A PostgreSQL advisory lock prevents overlapping worker cycles across replicas. Source failures retain last successful data and are recorded in bronze.runs. Runs remain sequential.

## Install on a server with Docker Compose and a hostname pointing to it
Check out this PR branch, install Node 22 for the preparation command, and transfer .env.local privately (never commit it). Then:

```sh
npm run production:prepare
export YEVA_DOMAIN=your-real-hostname
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=50 worker
```

`production:prepare` creates ignored .production/runtime.env and db_password with restrictive permissions. It refuses to overwrite existing secrets. Files are mounted as Compose secrets; they are not copied into the image. Keep the server filesystem private and encrypted. The database volume persists container recreation. Never run `docker compose down -v` on a live installation.

Access uses the existing internal key as the HTTP Basic password over HTTPS. No public access is enabled. Test an anonymous request returns 401 and an authenticated /api/health returns 200 before handoff. Health reports warehouse availability, not source freshness; inspect the dashboard's source timestamps and errors too.

For the verified UI-only draft event and ManyChat observations, privately transfer the sanitized export and restore it once with scripts/restore-data.ts inside the application container (use its CLI path argument). Otherwise automatic source reads populate the warehouse; UI observations are never invented.

## Token lifecycle
The actual Meta /debug_token endpoint is checked without logging token values. Only validity/expiry/status is saved in silver.credential_health and displayed privately. The worker checks every cycle. A warning starts seven days before token or data-access expiry. An expired/revoked credential requires reconnection; no unsupported automatic refresh is claimed. No Meta app secret is currently available. Do not apply the Instagram Login refresh flow to Facebook Login tokens.

On 2026-11-02, the existing META_ACCESS_TOKEN was verified with all 10 required scopes and expiry 2027-01-01T14:46:45Z. Instagram and Core were switched to this already-authorized credential; their previous token expired 2026-11-02T17:00:00Z. Future token replacement: update private runtime.env, recreate web and worker (`docker compose up -d --force-recreate web worker`), then inspect the next credential check and source sync. A password change or permission revocation can invalidate it earlier.

## Backups and restore
The backup container writes an atomic custom-format pg_dump daily under ignored .production/backups, keeping 14 days. Copy these dumps to an encrypted off-server destination; local-only backups do not protect against server loss. Restore must be rehearsed on a separate empty database before treating production as recovered:

```sh
docker compose exec -T postgres pg_restore -U yeva -d yeva_restore --no-owner < .production/backups/SELECTED.dump
```

Create the separate `yeva_restore` database first. Do not restore over a live database. No real-server restore has been tested in this workspace.
