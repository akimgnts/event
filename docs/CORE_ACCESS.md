# Event Signal Core access foundation

Prepared in Meta application 1106943715542061, configuration 2364807190941086, named Event Signal Core.

Granted scopes verified via GET /me/permissions on 2026-11-02:
- ads_read: advertising report reads.
- ads_management: future advertising create/update capability.
- business_management: business asset administration needed for future integrations.
- instagram_basic: professional profile and media reads.
- instagram_manage_insights: account/media analytics.
- instagram_content_publish: future compatible content publication.
- instagram_manage_comments: future comment read/reply/moderation.
- instagram_manage_messages: future direct-message read/reply.
- pages_read_engagement and pages_show_list: linked Page discovery/access dependencies.

No write actions are implemented or enabled. No messages are imported by this preparation, and no automation is started or stopped. ManyChat remains active. A separate expanded token is stored privately as META_CORE_ACCESS_TOKEN and INSTAGRAM_ACCESS_TOKEN; the existing Ads read token is preserved. GET /me/permissions confirms all ten configured scopes plus public_profile. Instagram profile identity matches yeva.club (17841429562986531), 72 followers and 4 media objects. Profile/media and reach/views/total_interactions Insights return HTTP 200. Conversation listing and comment listing were tested with fields=id, limit=1, HTTP 200; no message text, conversation IDs or comment text are imported. Advertising account identity read also returns HTTP 200. Write scopes are granted but write operations remain untested and disabled.

A scope is not proof of operational support: validate provider grants, account ownership, app role/review, endpoint eligibility, rate limits and applicable messaging/publication rules. Preserve per-source credentials; never overwrite the working Meta read token when onboarding Instagram.

Shotgun: only the documented Events and Tickets read APIs are integrated. UI reverse engineering can inform original workflows but never creates additional API rights. No undocumented write endpoints are assumed. ManyChat free-plan API remains unavailable; UI observations stay separately labelled.

Future implementation boundaries: provider connection, granted scopes, verified account identity, tested capabilities, and explicitly enabled actions must remain separate states. Store secrets server-side. Distinguish preparation from execution; no campaign spend, content publishing, message sending, cancellation or refund is authorized by token possession alone.
