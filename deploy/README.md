# Deploying Ta' Spiru to app.taspiru.com

Single-host deployment: Caddy terminates TLS for **app.taspiru.com** and routes
`/api/*` and `/socket.io/*` to the NestJS API, everything else to the Next.js
app. One origin means no CORS and cookies "just work".

```
                    ┌──────── app.taspiru.com ────────┐
   Internet ──443──▶│ caddy (auto-TLS via Let's Encrypt)│
                    └──┬───────────────────────┬───────┘
                  /api/*, /socket.io/*      everything else
                       │                       │
                    api:3001 (NestJS)     web:3000 (Next.js)
                       │
              postgres:5432   redis:6379
```

## Quick start on a Hostinger VPS (demo)

Requires a **Hostinger VPS / KVM** plan (Ubuntu) — shared/web hosting cannot run
Docker. On the VPS:

```bash
# 1. Install Docker (Ubuntu)
curl -fsSL https://get.docker.com | sh
# 2. Open the web ports
ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
# 3. Get the code and the demo env
git clone <repo> && cd ta-spiru
cp deploy/demo.env.example .env
# 4. Fill the two secrets in .env:
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -base64 48)|" .env
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" .env
# 5. Deploy (add --demo-data to load a populated showcase)
./deploy/deploy.sh --demo-data
```

Point the DNS **A record** for `app.taspiru.com` at the VPS IP *before* step 5 so
Caddy can obtain the TLS certificate. In demo mode Trust Payments stays on
placeholders — the whole app works, but online bookings stay "pending" instead of
auto-confirming (no real card settlement). Swap in MyST values and re-run
`docker compose up -d --build` to go fully live.

## First deploy (full / production)

1. Point a DNS **A record** for `app.taspiru.com` at the server's public IP.
   Open ports **80** and **443**.
2. Install Docker Engine + the compose plugin.
3. Clone the repo and create the env file:
   ```bash
   git clone <repo> && cd ta-spiru
   cp deploy/env.production.example .env
   # edit .env: set POSTGRES_PASSWORD, JWT_SECRET, and the TRUST_PAYMENTS_* values
   ```
   Generate strong secrets:
   ```bash
   openssl rand -base64 48   # POSTGRES_PASSWORD
   openssl rand -hex 32      # JWT_SECRET
   ```
4. Build and start:
   ```bash
   docker compose up -d --build
   ```
   The API container runs `prisma migrate deploy` on start, so the schema is
   applied automatically.
5. Seed the branches, services, products and staff **once**:
   ```bash
   docker compose run --rm api pnpm --filter @ta-spiru/database db:seed
   ```
6. In the Trust Payments MyST portal, point the URL notification at
   `https://app.taspiru.com/api/v1/payments/webhook` and confirm the
   site-security field order matches `verifySiteSecurity`.

## Day-to-day

```bash
docker compose logs -f api          # tail API logs
docker compose up -d --build        # deploy new code (re-runs migrate deploy)
docker compose run --rm api pnpm --filter @ta-spiru/database db:migrate  # dev migrations
docker compose down                 # stop (volumes persist)
```

Postgres and Redis data live in named volumes (`pgdata`, `redisdata`); Caddy's
certificates in `caddydata`. Nothing is lost across `up`/`down`.

## Notes

- `PUBLIC_URL` is baked into the web image at build time (client bundles call
  the API at that origin), so rebuild `web` if the domain changes.
- To run locally without TLS, override `DOMAIN` to `localhost` — Caddy issues a
  local cert — or talk to `web:3000` / `api:3001` directly on a dev network.
- The in-store TV displays load `https://app.taspiru.com/display/<branch-slug>`.
