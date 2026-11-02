# Connect Event Signal (read-only)

This project does not inherit browser login cookies. Server-side API credentials must be authorized independently.

## Meta Ads
1. Use a Meta developer application with Marketing API access and `ads_read` permission.
2. Obtain an authorized token for the relevant ad account. Store it in `.env.local` as `META_ACCESS_TOKEN`; never commit it.
3. Set `META_AD_ACCOUNT_ID` to the ad account ID.
4. Run `npm run dev` and request `/api/integrations/meta/insights?since=2026-10-01&until=2026-10-31`.
5. This endpoint is read-only. It returns campaign-level results; paging must be implemented before full historical sync. Restrict this endpoint behind organizer authentication **before deploying publicly**, since campaign data is private.

## ManyChat
1. Check whether your ManyChat plan includes API access. The browser account currently shows FREE; API access may require an upgrade.
2. If authorized, generate a token in ManyChat settings and store it only in `.env.local` as `MANYCHAT_API_TOKEN`.
3. Request `/api/integrations/manychat` to validate connection.
4. Do not expose the endpoint publicly before authentication and access controls are implemented.

## Shotgun
An authenticated organizer Smartboard was observed at `https://smartboard.shotgun.live/fr/events/615336` for Trap Session #2. No Shotgun API credential or supported export endpoint has been verified. Use an authorized organizer export as first ingestion path; do not scrape authenticated private endpoints.

## Instagram and YEVA website
Instagram requires supported Meta permissions and eligible professional account access. For yeva.club, add consent-aware first-party event tracking after confirming the site code and deployment setup.

## Security
These are integration scaffolds, **not completed live connections**. Never paste tokens into chat, commit secrets, or use production API endpoints without access controls. All remote actions remain read-only.
