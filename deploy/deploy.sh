#!/usr/bin/env bash
# One-shot deploy for Ta' Spiru. Run from the repo root on the server:
#   ./deploy/deploy.sh              # deploy + seed base data
#   ./deploy/deploy.sh --demo-data  # also load showcase data (today's
#                                     appointments, live queue, ledger)
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "✗ Missing .env — run:  cp deploy/demo.env.example .env  then fill in the secrets."
  exit 1
fi

for key in POSTGRES_PASSWORD JWT_SECRET; do
  val="$(grep -E "^${key}=" .env | cut -d= -f2-)"
  if [ -z "$val" ] || [ "$val" = "<generate>" ]; then
    echo "✗ ${key} is not set in .env. Generate one:"
    [ "$key" = "JWT_SECRET" ] && echo "    openssl rand -hex 32" || echo "    openssl rand -base64 48"
    exit 1
  fi
done

echo "→ Building and starting containers (this pulls images + builds on first run)…"
docker compose up -d --build

echo "→ Waiting for the API to become healthy…"
ok=""
for _ in $(seq 1 60); do
  if docker compose exec -T api node -e "require('http').get('http://localhost:3001/api/v1/locations',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))" 2>/dev/null; then
    ok="yes"; break
  fi
  sleep 3
done
if [ -z "$ok" ]; then
  echo "✗ API did not come up. Check logs:  docker compose logs api"
  exit 1
fi
echo "  API is up (migrations applied automatically on start)."

echo "→ Seeding base data (branches, services, products, staff, 21 barbers)…"
docker compose run --rm api pnpm --filter @ta-spiru/database db:seed

if [ "${1:-}" = "--demo-data" ]; then
  echo "→ Loading showcase demo data (today's appointments, live queue, ledger)…"
  docker compose run --rm api pnpm --filter @ta-spiru/database exec tsx prisma/demo-preview.ts
fi

domain="$(grep -E '^DOMAIN=' .env | cut -d= -f2-)"
echo ""
echo "✓ Live at https://${domain}"
echo "  · Storefront + booking:  https://${domain}/"
echo "  · Staff portal:          https://${domain}/admin/login"
echo "  · In-store TV (Naxxar):  https://${domain}/display/naxxar"
echo "  Admin login: norbert@taspiru.com / Staff!2026  (change this immediately)"
