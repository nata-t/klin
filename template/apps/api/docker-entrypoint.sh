#!/bin/sh
set -e

# Apply pending database migrations, then start the API.
# Set SKIP_MIGRATIONS=1 if you run migrations as a separate release step.
if [ "${SKIP_MIGRATIONS:-0}" != "1" ]; then
  echo "→ Applying database migrations"
  (cd /app/packages/db && npx --no prisma migrate deploy)
fi

echo "→ Starting the API"
exec node --enable-source-maps /app/apps/api/dist/main.js
