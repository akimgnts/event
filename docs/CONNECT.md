# Connection status and next actions

See README.md for the verified extract and db/001_pipeline.sql for the applied schema.

- Shotgun: existing organizer token retrieved from authorized Settings → Integrations → Shotgun APIs, saved privately. Tickets use a Bearer header. Official Events API requires `key` in the query; requests, URLs and provider auth objects are never logged or persisted. Both official endpoints tested successfully.
- Meta: account exists; developer registration is not completed. User must accept Meta Platform Terms and Developer Policies before an application and ads_read token can be created. No campaign/budget has been changed. Token creation or broader access must be approved at the actual access-grant step.
- Instagram: requires a developer application and authorized professional account. The implemented reader covers media metadata/counts, not Insights. Request only the scopes required for the chosen login route. No messaging or publishing scopes needed for analytics.
- ManyChat: Settings → API explicitly says Pro required. No trial or purchase initiated. Existing free-plan automations remain unchanged. The public API getInfo probe does not imply automation performance data is available.

Credentials must be injected into the backend independently of Chrome login. `.env.local` is chmod 0600, ignored by Git. No secrets are included in the data export or repository.

Do not publicly deploy without PostgreSQL, private HTTPS access, strong internal key, backups and appropriate secret injection. Production fails closed without DATABASE_URL/key.

## Update: developer registration completed

Developer account registration is now completed. A new application creation form is prepared with name Event Signal YEVA, business akimgnts, advertising-performance and Instagram use cases. The final Create Application button explicitly accepts platform/developer terms again; it has not been submitted. No app ID or Meta token exists yet.

ManyChat official automation Insights can be checked without paid API: comment automation shows 6 sends, 3 clicks, 50% CTR; story automation 1 send, 1 click, 100% CTR. UI observations are stored separately with timestamps and links, never advertised as automatic API synchronization. Replies after a DM remain unknown. The inbox shows 19 chats, a workspace total that is not an event conversion metric; no chat names/content are imported.

## Update: Meta Ads operational

App 1106943715542061 created. Existing token captured privately from authorized Meta interface and saved only in chmod-0600 ignored backend configuration. GET me/permissions confirms ads_read and public_profile only; no ads_management. Ad account read returns HTTP 200, currency EUR, timezone Europe/Paris. Campaign/day sync succeeds for 2026-10-01 through extraction date: 9 delivery rows, one campaign, EUR 17.00 spend, 5,887 impressions, 545 all-clicks. Dates with delivered rows span October 14–23. Other/draft campaigns may have no Insights rows; this extract is not a campaign inventory. Instagram is still disconnected because this token has no Instagram/Page scopes. No advertising settings changed.
