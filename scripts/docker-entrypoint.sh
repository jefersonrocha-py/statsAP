#!/bin/sh
set -eu

: "${HOST:?defina HOST no .env}"
: "${PORT:?defina PORT no .env}"

echo "Applying database schema..."
node scripts/init-db.mjs

if [ "${SEED_SUPERADMIN_ON_STARTUP:-false}" = "true" ] && [ -n "${SUPERADMIN_EMAIL:-}" ] && [ -n "${SUPERADMIN_PASSWORD:-}" ]; then
  echo "Ensuring superadmin user exists..."
  node scripts/seed-superadmin.mjs
else
  echo "Skipping automatic superadmin seed."
fi

echo "Starting Next.js on ${HOST}:${PORT}"
export HOSTNAME="${HOST}"
export PORT
exec node server.js
