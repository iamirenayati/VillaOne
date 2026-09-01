#!/usr/bin/env sh
set -eu

if [ "$#" -ne 2 ] || [ "$1" != "--confirm-destructive-restore" ]; then
  echo "Usage: $0 --confirm-destructive-restore /absolute/path/to/backup" >&2
  exit 2
fi

backup_dir=$2
for required in database.dump public-media.tar.gz private-media.tar.gz; do
  if [ ! -f "$backup_dir/$required" ]; then
    echo "Backup is incomplete: missing $required" >&2
    exit 1
  fi
done

DEPLOY_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.production.yml"
ENV_FILE="${VILLAONE_ENV_FILE:-$DEPLOY_DIR/.env.production}"
set -a
. "$ENV_FILE"
set +a

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" stop backend frontend nginx
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  dropdb --if-exists --force --username "$POSTGRES_USER" "$POSTGRES_DB"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  createdb --username "$POSTGRES_USER" "$POSTGRES_DB"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  pg_restore --no-owner --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < "$backup_dir/database.dump"
docker run --rm -v villaone_public_media:/target -v "$backup_dir:/backup:ro" alpine:3.20 \
  sh -c 'find /target -mindepth 1 -delete && tar -xzf /backup/public-media.tar.gz -C /target'
docker run --rm -v villaone_private_media:/target -v "$backup_dir:/backup:ro" alpine:3.20 \
  sh -c 'find /target -mindepth 1 -delete && tar -xzf /backup/private-media.tar.gz -C /target'
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d
echo "Restore completed. Run health checks and the documented acceptance flow now."
