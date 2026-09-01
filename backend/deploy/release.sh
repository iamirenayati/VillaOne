#!/usr/bin/env sh
set -eu

DEPLOY_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.production.yml"
ENV_FILE="${VILLAONE_ENV_FILE:-$DEPLOY_DIR/.env.production}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing production environment file: $ENV_FILE" >&2
  exit 1
fi

set -a
. "$ENV_FILE"
set +a

"$DEPLOY_DIR/backup.sh"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build --pull
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm backend python manage.py check --database default
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm backend python manage.py makemigrations --check --dry-run
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm backend python manage.py migrate --noinput
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm backend python manage.py collectstatic --noinput
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm backend python manage.py process_operational_tasks --batch-size 100
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm backend python manage.py verify_release --production
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --remove-orphans

attempt=0
until curl --fail --silent --show-error --max-time 5 "${SITE_URL%/}/health/ready/" >/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 12 ]; then
    echo "Release failed readiness verification." >&2
    exit 1
  fi
  sleep 5
done

"$DEPLOY_DIR/smoke.sh"
echo "VillaOne release completed and readiness passed."
