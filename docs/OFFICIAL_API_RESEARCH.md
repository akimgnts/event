# Official API verification · 2026-11-02

Primary documentation read directly in the authorized Chrome session:

- Shotgun credentials: https://support-pro.shotgun.live/hc/fr/articles/33561354477970-Trouvez-votre-ID-organisateur-et-votre-jeton-API
- Events: https://shotguntheapp.notion.site/organisers-events-API-e2bb2f2c63fa4caf827a9d4949ae62ae
- Tickets: https://shotguntheapp.notion.site/tickets-API-2a2655f4cc2a80bfa811f3b93a889666
- Meta Ads Insights: https://developers.facebook.com/documentation/ads-commerce/marketing-api/insights (page updated 2026-04-27)
- Instagram Insights: https://developers.facebook.com/documentation/instagram-platform/insights (page updated 2026-10-20)
- ManyChat API: https://help.manychat.com/en/articles/17742089-how-to-generate-a-token-for-the-manychat-api-and-where-to-get-parameters
- ManyChat interactive API: https://api.manychat.com/swagger

Shotgun Tickets: 100 requests/minute/IP, <=100 rows/page, ascending update timestamp + ID, next-page cursor may include timestamp + underscore + ticket ID. Fetch full inventory including cohosted tickets. Allowlist strips personal/contact fields and scan credentials before Bronze. `deal_price` and fee fields are cents; Events deal prices use currency units and must not be mixed. `valid` without cancellation counts as valid. Paid excludes invitation/duplicata channels and zero face price. Refund/cancellation/resale/pending/rejected statuses do not count. Scans indicate recorded scans, not guaranteed total attendance. Revenue is face value, never net payout. Monetary KPI verified against UI 54 EUR.

Events: public official endpoint is smartboard-api.shotgun.live/api/shotgun/organizers/{id}/events with key query parameter. Past events require past_events=true and zero-based page/limit. Fetch both future and past. Empty future response despite known UI draft establishes incomplete draft coverage. Do not infer room capacity from tier quantities or remaining stock.

Meta: developer app and ads_read required. v26.0 appears in the official docs. Campaign/day extraction with explicit dates and cursor pagination. Spend is in account currency units. Clicks are all clicks, not just link clicks. No purchase/ROAS/attributed ticket KPI is computed. Graph errors are redacted to codes. No API connection can be claimed until permission/token granted and HTTP request validated.

Instagram: supports Facebook Login (graph.facebook.com; instagram_basic, instagram_manage_insights, pages_read_engagement) and Instagram Login (graph.instagram.com; instagram_business_basic, instagram_business_manage_insights). Current implementation uses Facebook Graph media reader, not Instagram Login or Insights. Account and media metrics have different scopes/periods; unavailable values are empty rather than zero. Some account metrics unavailable under 100 followers; account insights retained up to two years according to current official guide. Organic media metrics differ from promoted total metrics. No mixing is performed.

ManyChat: API eligible paid plans only; account key in Settings → API. getInfo account probe supported; getFlows metadata is not evidence of runs, sends or clicks. Rate documentation varies by operation (getInfo 100 RPS, getFlows 10 RPS). No subscriber bulk import, sends, or flow edits. Free-plan UI shows active story/comment automations but their run/CTR observations are not API-backed dashboard metrics.
