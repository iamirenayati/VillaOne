# VillaOne V1.1

Release monorepo for the VillaOne concierge platform. This tree is the source
used by CI and the Docker Compose release workflow; the sibling `backend/` and
`website/` checkouts remain useful for local feature work.

## Structure

- `frontend/` — Vinext/React customer website and operations workspace.
- `backend/` — Django REST API, booking operations, content management, and admin.

## Local development

Follow the setup instructions in [`frontend/README.md`](frontend/README.md) and
[`backend/README.md`](backend/README.md). Configure the frontend API URL with:

```env
NEXT_PUBLIC_VILLAONE_API_URL=http://127.0.0.1:8000/api/v1
```

Local databases, environment files, uploaded media, payment proofs, dependencies,
and build output are deliberately excluded from this repository.

## Release Compose

For a new Ubuntu VPS, start with the complete [`VPS-SETUP.md`](VPS-SETUP.md)
guide. It covers DNS, Docker, TLS, firewall rules, first database setup,
business content, scheduled jobs, backups, verification, and normal releases.

From the repository root, copy `backend/deploy/.env.production.example` to a
protected `.env.production`, fill every required value, and validate the
release configuration before starting services:

```sh
docker compose --env-file backend/deploy/.env.production \
  -f backend/deploy/docker-compose.production.yml config
```

The production runbook in [`backend/deploy/README.md`](backend/deploy/README.md)
documents the migration, backup, verification, and restart sequence. Service
startup never runs migrations or fixture commands automatically.

## Netlify test

Select this repository and set the Netlify base directory to `frontend`. The
frontend still requires a publicly reachable Django API; a browser deployment
cannot access a backend running at `localhost` on a developer computer.
