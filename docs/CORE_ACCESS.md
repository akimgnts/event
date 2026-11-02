# Event Signal Core access foundation

Prepared in Meta application 1106943715542061, configuration 2364807190941086, named Event Signal Core.

Configured scope requests (not evidence of a granted token):
- ads_read: advertising report reads.
- ads_management: future advertising create/update capability.
- business_management: business asset administration needed for future integrations.
- instagram_basic: professional profile and media reads.
- instagram_manage_insights: account/media analytics.
- instagram_content_publish: future compatible content publication.
- instagram_manage_comments: future comment read/reply/moderation.
- instagram_manage_messages: future direct-message read/reply.
- pages_read_engagement and pages_show_list: linked Page discovery/access dependencies.

No write actions are implemented or enabled. No messages are imported by this preparation, and no automation is started or stopped. ManyChat remains active. Current verified backend token still has ads_read/public_profile only. Expanded token authorization and ownership checks are prerequisites before capability activation.

A scope is not proof of operational support: validate provider grants, account ownership, app role/review, endpoint eligibility, rate limits and applicable messaging/publication rules. Preserve per-source credentials; never overwrite the working Meta read token when onboarding Instagram.

Shotgun: only the documented Events and Tickets read APIs are integrated. UI reverse engineering can inform original workflows but never creates additional API rights. No undocumented write endpoints are assumed. ManyChat free-plan API remains unavailable; UI observations stay separately labelled.

Future implementation boundaries: provider connection, granted scopes, verified account identity, tested capabilities, and explicitly enabled actions must remain separate states. Store secrets server-side. Distinguish preparation from execution; no campaign spend, content publishing, message sending, cancellation or refund is authorized by token possession alone.
