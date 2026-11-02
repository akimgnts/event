# Integration contract

All connectors must implement the same lifecycle:
- `status`: disconnected | connecting | connected | error | unsupported
- `capabilities`: explicit supported read/write operations
- `lastSyncedAt`, `lastError`, `dataFreshness`
- `sync`: idempotent incremental import with provenance, source ID, event ID and timestamps
- `permissions`: least-privilege scope and organizer ownership
- `health`: last successful sync, rate-limit state, reconciliation metrics

## Shotgun
Validate available official organizer API/export capabilities before implementation. Begin with authorized CSV export if needed. Do not claim a public API is available without verifying it.

## Meta Ads
Use official Meta Marketing API and appropriate permissions. Start with read-only campaign insights; require explicit approval before any spend or campaign changes.

## Instagram and ManyChat
Use authorized APIs/webhooks and consent-compliant data only. Avoid cloning restricted Instagram messaging behavior or bypassing platform policies. Support a simple external-link integration first.

## Attribution
UTM tags identify campaign context, not necessarily confirmed ticket sales. Report attribution coverage and unknown sources. Never equate visits with unique people.

## Architecture decisions
Shotgun Tickets and Events are live-validated. Meta/Instagram/ManyChat remain blocked or unvalidated; see CONNECT.md.
