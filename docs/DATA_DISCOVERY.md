# Event Signal — Data discovery before dashboard design

## Architecture decision

One YEVA organizer has many events. Events may overlap. Every event has its own sales timeline, capacity, campaigns, social posts and ManyChat automations. Global metrics must be explicitly scoped to an organizer and time window; event comparisons must normalize for event date, campaign period and capacity.

Do **not** hard-code the currently observed Shotgun event 615336 as the only event. It is an example of a second event, not an organizer identifier. Discover organizer ID and event inventory through an authorized API.

## Current evidence (2026-11-02)

| Provider | Observed | API implementation | Real data retrieved by Event Signal |
| --- | --- | --- | --- |
| Shotgun | Organizer Smartboard shows event 615336, TRAP SESSION #2 – Back to Back, 2026-11-21 | Read-only tickets route committed | **No**; organizer token not configured/tested |
| Meta Ads | Browser has Meta for Business landing page, not campaign account data | Campaign insights route committed | **No**; token/account not configured/tested |
| ManyChat | YEVA workspace dashboard visible, FREE plan, one connected channel | Page info probe committed | **No**; API access not verified |
| Instagram | Account connected to tools according to organizer | Not implemented | **No** |
| YEVA website | yeva.club known | Not implemented | **No** |

Existing prototype values (10 tickets, 850 visits, 1.18% conversion) are illustrative historical estimates, **not API results**. They must never be represented as live KPIs.

## Inventory to collect — no assumptions about availability

### Shotgun
- Organizer: organizer ID, events inventory, event status, event start/end, timezone, capacity, ticket tiers.
- Tickets/orders: ticket ID, event ID, tier, sale timestamp, price, currency, channel, status, cancellation/refund, scan, UTM where supported.
- Aggregates: tickets sold and valid, gross/net revenue (define fees and refunds), sales velocity, capacity fill, ticket tier mix, channel/UTM mix.
- **Unknown until API verified**: page visits, unique visitors, checkout abandonment, attribution fidelity.

### Meta Ads
- Campaign/ad set/ad IDs and names, campaign objective, status, date, spend, impressions, reach, clicks, link clicks, CPC, CPM, CTR, actions and conversion attribution settings.
- **Important**: Meta's attributed conversions are not automatically equivalent to Shotgun confirmed orders. Compare only after defining attribution windows and source provenance.
- Event mapping needs explicit campaign-to-event assignments; one campaign may promote multiple events.

### Instagram
- Media ID, publication timestamp, media type, reach/views, engagement, profile visits, link interactions, subject to API permissions and metric availability.
- Organic and paid performance should remain separate.

### ManyChat
- Automation/flow ID, trigger type, executions, successful sends, link clicks where accessible; verify API vs UI exports.
- Never ingest subscriber contact lists without a justified business need and compliant privacy controls.
- One automation can be linked to multiple events; mapping must be explicit.

### Website
- Event page views, outbound Shotgun clicks, UTM source/medium/campaign, timestamp, consent status, anonymized session ID where lawful.
- Do not infer ticket purchase from outbound clicks.

## Candidate KPIs (definitions pending actual schemas)

1. Confirmed ticket sales: count of valid tickets excluding refunded/canceled according to a documented status mapping.
2. Gross ticket revenue: sum of ticket prices in a specified currency and unit, with fee handling documented.
3. Fill rate: valid tickets / sellable capacity, if capacity is verified.
4. Daily sales pace: valid tickets by sale date and event.
5. Campaign spend: Meta spend by campaign and date, with explicit campaign-event allocation.
6. Cost per confirmed ticket: attributed spend / attributable confirmed sales, **only if attribution is validated**.
7. Landing-to-ticket conversion: confirmed sales / ticket-page sessions, **only if session counts and event mapping are verified**.
8. ManyChat engagement: triggered flows, sends and link clicks where actually accessible.
9. Source coverage and freshness: latest successful sync, rows, gaps, API errors, data completeness.

## Data model draft

- `organizers`: organizer_id, name, timezone
- `events`: event_id, organizer_id, name, start_at, end_at, status, capacity
- `provider_connections`: organizer_id, provider, auth_status, last_sync_at
- `event_source_links`: event_id, provider, external_object_id, object_type, allocation_rule
- `bronze_shotgun_tickets`: immutable API response metadata + permitted ticket payload
- `bronze_meta_insights`: immutable campaign/ad insights + date range
- `bronze_manychat_events`: only permitted automation metrics
- `silver_tickets`: normalized statuses, prices, timestamps and event keys
- `silver_campaign_metrics`: normalized spend, clicks and campaign keys
- `gold_event_daily`: event-level metrics by day
- `gold_organizer_daily`: organizer-level rollups without double counting

Store ingestion provenance: provider, account, extraction time, API version, source ID, query period, raw payload checksum and pagination cursor. Avoid personal data unless strictly needed.

## Execution gates

1. Obtain authorized provider credentials via the provider interface (never chat or Git).
2. Probe API access and record HTTP status, endpoint and schema (redacted).
3. Enumerate **all** YEVA events, not only event 615336.
4. Sample a small permitted dataset from each source and save a redacted schema inventory.
5. Verify statuses, money units, timezone, pagination, event/campaign mapping and API limits.
6. Build Bronze ingestion and deduplication; then Silver normalization; only then Gold metrics.
7. Replace prototype's invented metrics with computed KPIs plus source and freshness labels.

**Current state:** gates 1–7 are incomplete. This document is a discovery plan, not proof of a live connection.
