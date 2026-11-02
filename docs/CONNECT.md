# Connection status and next actions

See README.md for the verified extract and db/001_pipeline.sql for the applied schema.

- Shotgun: existing organizer token retrieved from authorized Settings → Integrations → Shotgun APIs, saved privately. Tickets use a Bearer header. Official Events API requires `key` in the query; requests, URLs and provider auth objects are never logged or persisted. Both official endpoints tested successfully.
- Meta: account exists; developer registration is not completed. User must accept Meta Platform Terms and Developer Policies before an application and ads_read token can be created. No campaign/budget has been changed. Token creation or broader access must be approved at the actual access-grant step.
- Instagram: requires a developer application and authorized professional account. The implemented reader covers media metadata/counts, not Insights. Request only the scopes required for the chosen login route. No messaging or publishing scopes needed for analytics.
- ManyChat: Settings → API explicitly says Pro required. No trial or purchase initiated. Existing free-plan automations remain unchanged. The public API getInfo probe does not imply automation performance data is available.

Credentials must be injected into the backend independently of Chrome login. `.env.local` is chmod 0600, ignored by Git. No secrets are included in the data export or repository.

Do not publicly deploy without PostgreSQL, private HTTPS access, strong internal key, backups and appropriate secret injection. Production fails closed without DATABASE_URL/key.
