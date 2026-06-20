#!/bin/sh
set -e

echo "[beeroniza] Applying database migrations…"
npx prisma migrate deploy

echo "[beeroniza] Seeding bundled fonts…"
npx prisma db seed || echo "[beeroniza] seed skipped/failed (non-fatal)"

echo "[beeroniza] Starting server on port ${PORT:-3000}…"
exec npm run start -- -p "${PORT:-3000}" -H 0.0.0.0
