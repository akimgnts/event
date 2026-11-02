# Cockpit analytics

The Next.js cockpit replaces the static prototype with event-scoped views: overview, tickets, communication, advertising, budget, a constrained question assistant, and source health. The HTML mockup remains a separate artifact.

## Source extensions
- Instagram media: shares, saves, average/total Reel watch time (milliseconds), skip rate, caption. Optional metrics store explicit availability; an unsupported metric stays NULL. Mandatory identity/media reads still fail the batch. Account totals use a separate explicit 28-day window and are not assigned to an event.
- Meta: ads, creative IDs, effective Instagram media IDs/permalinks, ad/day spend and click counts, and video snapshots/curves over a dated window. An ad's effective Instagram media ID is joined to an organic post only on exact identity; distinct creatives stay separate. Campaign totals remain the canonical event-spend aggregate; ad rows are never added to campaign totals.
- Shotgun: deal ID/title, fees, VAT rate, producer cost and payment method. Contact/scan credentials remain excluded. Available sold tiers do not establish current unsold inventory or physical venue capacity.

## Explicit links
Migration 005 and applyConfirmedLinks install only the exact historical confirmations given by Akim on 2026-11-02: campaign 120250002434600674 and the four specified organic media belong to event 606083. New media are not auto-linked. Existing classifications are never overwritten by sync. The authenticated same-origin association endpoint validates ownership/existence and writes an audit record transactionally. A general-content classification is distinct from unclassified content. Campaign unlinking returns spend to unassigned account totals; it does not delete source analytics.

## KPI definitions
- Advertising per paid ticket = linked campaign spend / valid paid tickets. Not an attributed CAC.
- Average face value = ticket face value / valid paid tickets.
- Ad share = linked spend / face value.
- Partial balance = face value - linked spend, same currency only. Not profit, settlement or cash received.
- Scan ratio = scanned valid tickets / all valid tickets. No-show status is not inferred.
- Outbound CPC = reported outbound spend/count for that ad/window when count is positive. Missing action metrics stay NULL, so this is not evidence of zero clicks.
- Media reach is never summed as unique audience. Lifetime media metrics and time-window ad metrics have distinct timestamps.

## Assistant foundation
/api/assistant uses a bounded set of event-filtered analysis functions, no unrestricted SQL and no external language model. It answers known question families and says when a question is unsupported. Sources and timestamps accompany the answer. This is intentionally labelled an analytical assistant with predefined analyses, not a general AI chatbot. LLM-powered intent routing/tool calling can be added later using a configured server-side provider, with the same metric definitions and read-only tools.

## Operational boundary
Source APIs remain read-only. The only new write capability is organizer-controlled metadata in this warehouse. No campaign, budget, event, Instagram post, message or ManyChat flow is modified. Existing Coolify runtime authentication remains in force. Off-server backup/restore rehearsal remains separate work documented in DEPLOYED.md.
