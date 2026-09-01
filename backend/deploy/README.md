# VillaOne production runbook

This runbook targets one Linux VPS with Docker Compose, PostgreSQL 16, Nginx, and systemd. It deliberately has no automatic database migration or demo-data load during service startup.

## First installation

1. Clone this release repository to `/srv/villaone` (the compose file expects `/srv/villaone/backend` and `/srv/villaone/frontend`). If you deploy from the standalone source repositories instead, keep `backend` and `website` as sibling directories and use that checkout's compose file.
2. Copy `.env.production.example` to `.env.production`, restrict it to the deployment user (`chmod 600`), and replace every placeholder.
3. Install a TLS certificate at `/etc/letsencrypt/live/villaone/` (or set `TLS_DIRECTORY`).
4. Create persistent backup and optional encrypted off-server destinations. Install `age` if weekly off-server copies are configured.
5. From `/srv/villaone/backend/deploy`, start only PostgreSQL: `docker compose --env-file .env.production -f docker-compose.production.yml up -d postgres`.
6. Build the backend and run `python manage.py migrate` once through Compose.
7. Create the first superuser explicitly: `docker compose ... run --rm backend python manage.py createsuperuser`.
8. Enter complete business settings, card-transfer details, and at least one genuine published item in each required section. Never run development fixture commands.
9. Run `./release.sh`. Release verification intentionally refuses incomplete settings, content, storage, migrations, or housekeeping.
10. Install and enable the three timers from `systemd/`, then inspect them with `systemctl list-timers 'villaone-*'`.

The frontend and backend share one HTTPS origin. Nginx sends `/api/`, `/admin/`, and health routes to Django, serves only public media, and proxies the remaining routes to the frontend. Payment proofs remain private Django-streamed files.

## Normal release

Run `./release.sh` from `/srv/villaone/backend/deploy`. It performs a pre-release application check and backup, builds images, confirms migrations are committed, applies them once, collects static assets, refreshes housekeeping state, verifies production readiness, restarts services, and checks `/health/ready/`.

If a release fails before restart, the running version remains available. If readiness fails after restart, inspect `docker compose logs`, restore the previous image/tag, and use the pre-release backup only if a migration changed data incompatibly.

## Backup and recovery

`backup.sh` creates a PostgreSQL custom-format dump plus separate archives for public and private media. Seven daily server copies are retained. When `OFFSITE_BACKUP_DIRECTORY` and `AGE_RECIPIENT` are configured, Sunday backups are encrypted and retained for eight weeks.

Restore is intentionally destructive and requires an explicit flag:

```sh
./restore.sh --confirm-destructive-restore /srv/villaone/backups/20260813T031500Z
```

Perform the first rehearsal on a separate VPS/database before launch and monthly thereafter. Record start/end time, backup identity, restored row counts, media sample checks, `/health/ready/`, and the complete booking acceptance flow. The target is RPO 24 hours and RTO 4 hours. Never delete payment proofs until the business adopts a documented retention policy.

## Operational checks

- `process_operational_tasks` runs each minute; stale status appears in the custom admin system-status endpoint.
- `check_operational_integrity` runs nightly and records a sanitized report.
- `/health/live/` does not touch the database; `/health/ready/` verifies database and migration readiness; `/health/` is the compatibility alias.
- After any recovery, verify: published villa → available dates → booking → receipt upload → staff approval → calendar occupancy → notification → support/cancellation workflow.
