# VillaOne on an Ubuntu VPS

This guide deploys VillaOne as a small-team production system on one Ubuntu
24.04 LTS server. The release uses Docker Compose, PostgreSQL, Django/Gunicorn,
the Vinext frontend, and Nginx. Card-to-card receipt review is the active
payment workflow; ZarinPal and SMS remain deferred.

## 1. Server and DNS

A practical starting server is 2 vCPU, 4 GB RAM, and 40 GB of SSD storage.
Point the domain's `A` record (and `AAAA` record only when IPv6 is configured)
to the server before requesting a certificate.

Update Ubuntu, install `unzip`, `curl`, `ca-certificates`, `ufw`, and install
Docker Engine plus the Compose plugin from Docker's official Ubuntu repository.
Do not use an unofficial one-line installer for a production server.

Allow SSH before enabling the firewall:

```sh
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

Add the deployment user to Docker's group, then sign out and back in:

```sh
sudo usermod -aG docker "$USER"
```

## 2. Upload and extract the release

From your computer, upload the supplied ZIP:

```sh
scp VillaOne-Ubuntu-VPS-2026-09-01.zip your-user@your-server:/tmp/
```

On the server:

```sh
sudo mkdir -p /srv
sudo unzip /tmp/VillaOne-Ubuntu-VPS-2026-09-01.zip -d /srv
sudo chown -R "$USER":"$USER" /srv/villaone
cd /srv/villaone
```

The archive intentionally excludes `.env` files, the local SQLite database,
accounts, uploaded payment proofs, dependencies, and build output. Production
starts with a clean PostgreSQL database so development credentials and customer
data cannot leak onto the server.

## 3. Obtain the TLS certificate

The bundled Nginx configuration expects the certificate name `villaone`.
Request the certificate before starting the Nginx container, while ports 80 and
443 are free:

```sh
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/local/bin/certbot
sudo certbot certonly --standalone --cert-name villaone \
  -d example.com -d www.example.com
sudo certbot renew --dry-run
```

Replace both example domains. Certbot installs its renewal timer automatically.
After a successful renewal, reload the proxy with:

```sh
cd /srv/villaone/backend/deploy
docker compose --env-file .env.production \
  -f docker-compose.production.yml exec -T nginx nginx -s reload
```

## 4. Configure production secrets

```sh
cd /srv/villaone/backend/deploy
cp .env.production.example .env.production
chmod 600 .env.production
mkdir -p /srv/villaone/backups
openssl rand -hex 32
openssl rand -hex 48
```

Use the first generated value as `POSTGRES_PASSWORD` and the second as
`DJANGO_SECRET_KEY`. Edit `.env.production` and replace every placeholder:

```env
POSTGRES_DB=villaone
POSTGRES_USER=villaone
POSTGRES_PASSWORD=use-the-generated-database-password
DJANGO_SECRET_KEY=use-the-generated-django-secret
DJANGO_ALLOWED_HOSTS=example.com,www.example.com
CORS_ALLOWED_ORIGINS=https://example.com,https://www.example.com
CSRF_TRUSTED_ORIGINS=https://example.com,https://www.example.com
FRONTEND_URL=https://example.com
SITE_URL=https://example.com
SENTRY_DSN=
SENTRY_ENVIRONMENT=production
WEB_CONCURRENCY=2
BACKUP_DIRECTORY=/srv/villaone/backups
OFFSITE_BACKUP_DIRECTORY=
AGE_RECIPIENT=
```

Host names have no scheme; origin values use the exact HTTPS origin. Never
commit or share `.env.production`.

Validate the rendered Compose configuration before starting anything:

```sh
docker compose --env-file .env.production \
  -f docker-compose.production.yml config >/dev/null
```

## 5. First database bootstrap

Run migrations once as an explicit release action; service startup never runs
migrations or demo fixtures automatically:

```sh
docker compose --env-file .env.production \
  -f docker-compose.production.yml up -d postgres
docker compose --env-file .env.production \
  -f docker-compose.production.yml build --pull
docker compose --env-file .env.production \
  -f docker-compose.production.yml run --rm backend python manage.py migrate --noinput
docker compose --env-file .env.production \
  -f docker-compose.production.yml run --rm backend python manage.py collectstatic --noinput
docker compose --env-file .env.production \
  -f docker-compose.production.yml run --rm backend python manage.py createsuperuser
docker compose --env-file .env.production \
  -f docker-compose.production.yml up -d backend frontend nginx
```

Open `https://example.com/admin/` and complete the single Business Settings
record, including brand/contact details, policy text, and card-transfer bank
details. Publish at least one genuine villa, contractor, real-estate listing,
service, and article. Do not run the development fixture commands.

Then establish housekeeping state and run the release gate:

```sh
docker compose --env-file .env.production \
  -f docker-compose.production.yml exec -T backend \
  python manage.py process_operational_tasks --batch-size 100
docker compose --env-file .env.production \
  -f docker-compose.production.yml exec -T backend \
  python manage.py check_operational_integrity
docker compose --env-file .env.production \
  -f docker-compose.production.yml exec -T backend \
  python manage.py verify_release --production
```

Verification is expected to fail until all required real business settings and
published content exist. Fix every reported item instead of bypassing the gate.

## 6. Install scheduled operations and backups

The booking-expiry processor must run every minute. Integrity checks run
nightly, and backups run daily:

```sh
sudo cp systemd/villaone-*.service systemd/villaone-*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now villaone-operational.timer
sudo systemctl enable --now villaone-integrity.timer
sudo systemctl enable --now villaone-backup.timer
systemctl list-timers 'villaone-*'
```

Check failed units with `systemctl --failed` and inspect one job with
`journalctl -u villaone-operational.service`. Configure encrypted off-server
weekly backups with `OFFSITE_BACKUP_DIRECTORY` and `AGE_RECIPIENT`; server-only
backups do not protect against total VPS loss.

Before launch, rehearse a restore on a separate server or database using the
instructions in `backend/deploy/README.md`. The intended targets are a 24-hour
recovery point and a four-hour recovery time.

## 7. Verify the live product

```sh
curl -fsS https://example.com/health/live/
curl -fsS https://example.com/health/ready/
docker compose --env-file .env.production \
  -f docker-compose.production.yml ps
```

Complete this real acceptance flow on desktop and phone:

1. Open a published villa and choose valid Shamsi dates.
2. Add an optional service and create the booking hold.
3. Upload a card-to-card receipt as the customer.
4. Review and approve the protected proof in the operations workspace.
5. Confirm the booking receipt, customer notification, and occupied calendar.
6. Submit and process one support or cancellation request.

For failures, inspect sanitized logs:

```sh
docker compose --env-file .env.production \
  -f docker-compose.production.yml logs --tail=200 backend frontend nginx
```

## 8. Normal updates and rollback

For later releases, replace the source with a reviewed release and run:

```sh
cd /srv/villaone/backend/deploy
./release.sh
```

The release script backs up data first, builds images, checks and applies
migrations once, collects static assets, verifies readiness, restarts services,
and performs smoke checks. Keep the previous release archive until the new
version passes acceptance. Roll back code by restoring the previous source and
rebuilding. Restore the database only when an incompatible migration or data
change requires it; database restore is destructive and is intentionally gated
by `restore.sh --confirm-destructive-restore`.

## Launch checklist

- DNS and HTTPS work for the canonical domain.
- SSH is key-based; root/password login is disabled after confirming access.
- Only SSH, HTTP, and HTTPS are exposed by the firewall.
- `.env.production` is mode `600` and contains no placeholders.
- Release verification, health checks, and the booking acceptance flow pass.
- Timers are current and operational failures are visible to staff.
- Daily local and encrypted weekly off-server backups are configured.
- A restore rehearsal has succeeded.
- Real legal, support, bank, villa, marketplace, and editorial content is live.
