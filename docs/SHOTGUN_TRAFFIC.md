# Shotgun Smartboard traffic

Server-only source `shotgun_traffic`, using native fetch. Configure
`SHOTGUN_SMARTBOARD_TOKEN` in `.env.local` or the production runtime secrets.
Never use a `NEXT_PUBLIC_` variable or commit the token.

Local verification from the repository root:

```sh
npm ci
node --import tsx --test tests/shotgun-traffic.test.ts
npm test
npm run build
npm run migrate
npm run sync -- shotgun_traffic
npm run dev
```

The last three commands require local configuration; live sync additionally needs
the Smartboard token and events already synchronized by the public Shotgun source.
Select an event and inspect Ventes, Publicités and Sources & fiabilité.

The existing worker collects traffic in its existing cycle. Each event has a
database-backed 900-second cache of attempts, including failures. A PostgreSQL
transaction advisory lock prevents simultaneous worker/manual requests for the
same event. UI refreshes read PostgreSQL and do not call Smartboard. An expired
snapshot is unavailable until the next successful collection. Errors retain the
previous payload privately but do not expose it as current metrics.

`trafficLastUpdate` is the provider timestamp; `collected_at` is the collection
timestamp. Daily timestamps are converted to the event's stored timezone.
Missing timezone is an explicit failure, not a guessed timezone.

The supplied control observation is 107 visits, 4 commands and 6 paid tickets:
3.7% visits-to-orders and 5.6% visits-to-paid-tickets. The test reconstructs only
those supplied counts, not a full live GraphQL response. Date/UTM test fixtures
are isolated from production data. No live API success has been asserted by tests.

The Smartboard endpoint is internal, undocumented publicly and may change.
Visits count passages, not unique people. UTM sources do not establish individual
purchase attribution. All four request headers are retained, including both
`x-shotgun-*` headers.
