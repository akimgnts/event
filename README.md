# Event Signal · YEVA

Private multi-event analytics. Remote connectors are read-only; the application never creates tickets, edits events, messages contacts or changes advertising spend.

## Run

```bash
npm ci
cp .env.example .env.local
# Configure an existing Shotgun organizer token and a strong EVENT_SIGNAL_INTERNAL_API_KEY.
# Configure DATABASE_URL for an actual PostgreSQL server in production.
npm run migrate
npm run sync -- shotgun
npm run dev -- --hostname 127.0.0.1
```

Dashboard authentication: browser Basic authentication, arbitrary username, internal key as password. All routes fail closed if the key is missing. Internal sync additionally requires `x-event-signal-key`. Keep keys in a deployment secret store or `.env.local` (0600), never source control. HTTPS is required outside localhost. Browser sessions do not grant backend API access.

In development only, when DATABASE_URL is absent, PGlite runs an embedded PostgreSQL engine with persistent local files. This is **not a deployed PostgreSQL server**. Use one process at a time with the embedded store: stop Next before running sync scripts. Production requires DATABASE_URL and uses dedicated pg connections for sync transactions.

## Synchronization

`npm run sync` attempts all four sources and records failures independently. `npm run sync -- shotgun` imports all pages of ticket changes through a full rescan, plus all past and upcoming Events API pages. Writes Bronze/Silver atomically; failed fetches never publish partial batches. Silver upserts prevent duplicate tickets. Bronze retains sanitized versions per run with hashes. No attendee PII, scan codes, auth payloads, or secret-bearing URLs are persisted.

`POST /api/sync?source=shotgun` triggers the same pipeline with the internal header. Meta accepts `since` and `until`. For scheduled sync, run the CLI in a private worker against PostgreSQL with injected secrets; no recurring worker has been deployed by this change. Full Shotgun rescan includes historical corrections. Meta re-fetches its configured window; choose a sufficiently wide window for attribution revisions.

## Current verified state

2026-11-02: Shotgun Tickets and Events returned HTTP 200 for organizer 259009. First event 606083: 16 valid paid tickets, 13 distinct orders, 13 scanned tickets, EUR 54 face value excluding fees. Source labels `ig` (4), `instagram.com` (2), `shotgun` (9), `direct` (1) are not paid attribution.

The Events API returned the past event; upcoming inventory was empty. Draft 615336 was observed in Smartboard separately and imported as `smartboard_ui`, with no sales metrics inferred. API inventory is not claimed to include all drafts. Physical capacity and visits are unknown. Tier quantities and leftTicketsCount are not interpreted as room capacity.

Meta account identified, but developer registration/terms block token creation. Instagram media reader is implemented but not live-validated; Insights are not implemented. ManyChat API requires an eligible paid plan; no subscription was changed. Its connector only probes account metadata, not automation performance. Current account/automation UI observations are not presented as API results.

## Schema and verification

`db/001_pipeline.sql` defines Bronze runs/records, Silver events/tickets/campaign daily metrics/explicit event mappings, Gold event totals/daily totals/organizer daily/assigned ad spend.

```bash
npm test
npm run typecheck
npm run build
npm run verify
node --env-file=.env.local scripts/smoke.mjs
```

`verify` checks the actual first-event extract against the observed totals; it is a dated reconciliation, not an assertion that future data can never change. No synthetic business data is seeded. Raw provider timestamps without offsets are preserved; daily sales use the provider date substring until its timezone semantics are confirmed. Monetary groups stay separated by currency. Unique reach is not summed. Shared campaigns remain unassigned; the single-assignment mapping enforces no double allocation. Multi-event campaign allocation is deliberately unsupported until a reviewed rule exists.

Local private data and credentials are excluded from Git. No public hosting or modification of the user's separate Mac localhost project is performed by cloning into this execution workspace.

Portable private snapshots: `scripts/export-data.ts` exports sanitized warehouse tables as JSON, `scripts/restore-data.ts` restores them after applying the migration. Neither contains API tokens. Close the embedded database cleanly before copying data files. The CLI scripts close it explicitly. For a durable live service, use a managed PostgreSQL server.
