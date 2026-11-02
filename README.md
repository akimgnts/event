# Event Signal

A minimal event acquisition cockpit, initially designed from lessons learned organizing YEVA events.

**Status:** demonstration prototype. Metrics are illustrative, not connected to real accounts.

## Why
Event organizers bounce between ticketing, Meta Ads, Instagram, and automation tools. Event Signal brings performance and next actions into one quiet interface.

## Stack
Next.js 15 · React 19 · TypeScript · Lucide · CSS. Black/white/gray UI.

## Local development
```bash
npm install
npm run dev
```

## Scope
- Overview: ticket sales, ticket-page visits, approximate conversion, remaining capacity
- Acquisition: funnel and source visibility
- Action plan: clickable checklist (not persisted)
- Sources: integration status; all marked as not connected

## Roadmap
1. Add PostgreSQL for event data and scoped access.
2. Build a manual CSV import with a provenance log and bronze/silver/gold transformations.
3. Add Meta Ads and other official integrations where authorized.
4. Introduce deterministic diagnostics, then an AI adviser with evidence and explicit uncertainty.
5. Add organizer accounts and tenant isolation before external beta testing.

**Safety:** Do not import private attendee information into a public demo. Payment, QR validation, and automatic ad actions are NOT implemented.

## About
Initial use case: YEVA association. Product concept and design direction: minimalist, Notion-inspired, accessible to nontechnical event organizers.
