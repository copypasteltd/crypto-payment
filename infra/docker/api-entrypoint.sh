#!/usr/bin/env sh
set -eu

if [ "${LINGBAN_API_SKIP_MIGRATIONS:-0}" != "1" ]; then
  echo "[lingban-api] applying database migrations"
  node /opt/lingban/app/api/dist/migrate.js up
fi

exec node /opt/lingban/app/api/dist/index.js
