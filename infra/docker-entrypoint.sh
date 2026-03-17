#!/bin/sh
# Run Prisma migrations on startup (safe — idempotent)
if [ "$DATABASE_URL" != "file:./dev.db" ]; then
  echo "Running database migrations..."
  npx prisma migrate deploy 2>&1 || echo "Migration warning (may be first deploy)"
fi

# Start the app
exec node server.js
