#!/usr/bin/env sh
set -eu

BASE_URL=${SITE_URL:?SITE_URL must be set}
BASE_URL=${BASE_URL%/}

curl --fail --silent --show-error --max-time 10 "$BASE_URL/health/live/" >/dev/null
curl --fail --silent --show-error --max-time 10 "$BASE_URL/health/ready/" >/dev/null
curl --fail --silent --show-error --max-time 10 "$BASE_URL/api/v1/villas/" >/dev/null
curl --fail --silent --show-error --max-time 10 "$BASE_URL/api/v1/marketplace/articles/" >/dev/null

echo "VillaOne public routing smoke checks passed."
