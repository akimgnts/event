# Reverse engineering research plan

REA (Reverse Engineer Anything) is a **research tool**, not a data connector or a license to clone private code.

## Goals
Study publicly accessible organizer workflows and build original, simpler versions:
- Shotgun / Eventbrite: event creation, ticket tiers, promo links, reporting, check-in.
- ManyChat: visual triggers, conditions, message templates, opt-in flows.
- Meta Ads Manager: campaign hierarchy, creative variants, performance diagnostics.
- Notion: information hierarchy, typography, quiet navigation.

## REA setup (separate local research environment)
Prerequisite: supported Node.js version per REA's current README.

```bash
npx rea-agents setup
```

Use a coding agent configured with REA. Example research task:

> Observe the publicly accessible event discovery and ticket checkout experience. Document visible states, navigation, input validation, screenshots, and observed network calls. Do not bypass authentication, copy proprietary assets or code, collect personal data, or interact with payments. Produce a neutral specification and original UX suggestions for Event Signal.

## Deliverables per investigation
1. Workflow diagram and screenshots where permitted.
2. Observable facts vs hypotheses.
3. Proposed original interaction for Event Signal.
4. Data fields needed and **official** API/export availability.
5. Legal, security, privacy, and integration limitations.

## Integrations
Never use REA or scraping to bypass access controls, API restrictions, rate limits, or platform terms. Official APIs, approved webhooks, and authorized CSV exports are preferred. Some third-party platforms may not expose organizer-level data through a public API. An integration must show **not connected** until credentials, permissions and end-to-end tests exist.

## Data flow
Sources -> ingestion (API/webhook/CSV) -> bronze raw records -> silver validated and deduplicated records -> gold KPI views -> deterministic diagnostics -> optional AI adviser. Keep transactional ticket operations separate from analytical ETL.

## Security
No real access tokens, personal attendee records, passwords, or payment data in repository, screenshots, or public demo.
