#!/bin/sh
set -eu

: "${HOST:?defina HOST no .env}"
: "${PORT:?defina PORT no .env}"

echo "Applying database schema..."
node scripts/init-db.mjs

node scripts/bootstrap-superadmin.mjs

if [ "${SEED_SUPERADMIN_ON_STARTUP:-false}" = "true" ] && [ -n "${SUPERADMIN_EMAIL:-}" ] && [ -n "${SUPERADMIN_PASSWORD:-}" ]; then
  echo "SEED_SUPERADMIN_ON_STARTUP=true: aplicando o seed completo do superadmin..."
  node scripts/seed-superadmin.mjs
fi

echo "Starting Next.js on ${HOST}:${PORT}"
export HOSTNAME="${HOST}"
export PORT
exec node server.js
