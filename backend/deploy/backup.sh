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

BACKUP_DIRECTORY=${BACKUP_DIRECTORY:-/srv/villaone/backups}
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
destination="$BACKUP_DIRECTORY/$timestamp"
mkdir -p "$destination"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump --format=custom --no-owner --username "$POSTGRES_USER" "$POSTGRES_DB" > "$destination/database.dump"
docker run --rm -v villaone_public_media:/source:ro -v "$destination:/backup" alpine:3.20 \
  tar -czf /backup/public-media.tar.gz -C /source .
docker run --rm -v villaone_private_media:/source:ro -v "$destination:/backup" alpine:3.20 \
  tar -czf /backup/private-media.tar.gz -C /source .

find "$BACKUP_DIRECTORY" -mindepth 1 -maxdepth 1 -type d -mtime +7 -exec rm -rf -- {} +

if [ -n "${OFFSITE_BACKUP_DIRECTORY:-}" ] && [ -n "${AGE_RECIPIENT:-}" ]; then
  weekly_day=$(date -u +%u)
  if [ "$weekly_day" = "7" ]; then
    mkdir -p "$OFFSITE_BACKUP_DIRECTORY"
    tar -czf - -C "$destination" . | age -r "$AGE_RECIPIENT" -o "$OFFSITE_BACKUP_DIRECTORY/villaone-$timestamp.tar.gz.age"
    find "$OFFSITE_BACKUP_DIRECTORY" -type f -name 'villaone-*.tar.gz.age' -mtime +56 -delete
  fi
fi

echo "Backup written to $destination"
