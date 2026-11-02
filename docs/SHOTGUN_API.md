# Shotgun organizer integration

Official organizer instructions: https://support-pro.shotgun.live/hc/fr/articles/33561354477970-Trouvez-votre-ID-organisateur-et-votre-jeton-API

## Credentials
In Shotgun Smartboard: Settings → Integrations → Shotgun APIs. Generate organizer API token. Store it only in `.env.local`, never in Git or chat.

```dotenv
SHOTGUN_ORGANIZER_ID=
SHOTGUN_API_TOKEN=
EVENT_SIGNAL_INTERNAL_API_KEY=
```

## Test locally
```bash
npm run dev
curl 'http://localhost:3000/api/integrations/shotgun/tickets?event_id=615336'
```

The API route uses `GET https://api.shotgun.live/tickets`, organizer ID and Bearer authorization. The route removes contact names, emails, phone numbers, birthdates and ticket QR codes before returning a response. It exposes `nextCursor` for incremental pagination; persistence and scheduling are future steps.

**Security:** The route is meant for local development only until proper organizer login is implemented. Production requests require the `x-event-signal-key` header matching `EVENT_SIGNAL_INTERNAL_API_KEY`. Set a strong key before deployment. Do not publish raw data or credentials.

## Metrics to compute later
- Count valid tickets by event and sales channel.
- Exclude canceled/refunded/resold tickets according to an explicitly documented business rule.
- Revenue from ticket prices (in cents), with fees separated.
- Sales by date and UTM source; unknown attribution stays unknown.
- Sync all pages until nextCursor is null; use cursor to fetch changed tickets later.

Provider documentation also linked in the official article (Events API and Tickets API).
