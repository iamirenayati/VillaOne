#!/bin/sh
set -eu

exec gunicorn config.wsgi:application --bind "0.0.0.0:${PORT:-8000}" --workers "${WEB_CONCURRENCY:-2}" --timeout 60 --graceful-timeout 30 --max-requests 1000 --max-requests-jitter 100 --access-logfile - --error-logfile -
