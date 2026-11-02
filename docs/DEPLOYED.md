# Verified Coolify deployment

Deployed on 2026-11-02 from commit 1f5b93efd8b5510ec8d3e74fa81a317242bcf974.

- Project: Event Signal YEVA / production.
- Application: 0zhmt4tamtncyzz5lx70enbq.
- URL: https://durqxfudezu7rgweass5s1fp.37.59.112.53.sslip.io
- Compose: compose.coolify.yaml. PostgreSQL 17 with persistent volume; no published database port. Runtime configuration is in Coolify, excluded from source control.
- Private Basic/header authentication: anonymous API requests return 401; authenticated health/events/integrations/dashboard return 200 over verified HTTPS.
- Live Shotgun, Meta and Instagram synchronization succeeded on the server at 19:22 UTC. Reconciliation: 16 tickets, 13 orders, 13 scans, EUR54 face value; Meta EUR17, 5887 impressions, 545 all-clicks; Instagram 4 media. Worker runs sequential cycles every 900 seconds, with advisory locking.
- Imported the previously verified Smartboard draft event and two dated ManyChat UI observations separately, preserving their source and original observation timestamps. No DM text is stored.
- Meta token metadata checked successfully, expiry 2027-01-01T14:46:45Z. Expiry/revocation still requires reconnection.
- Remaining operations: configure and rehearse off-server backups. The local Compose backup service is not included in this initial Coolify stack. Do not claim disaster recovery tested.

Earlier PRODUCTION.md notes about no available host describe the state before this deployment. Localhost on the user's Mac is a separate process and may still show an older checkout.
