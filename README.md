# Ta' Spiru Digital Ecosystem

Unified platform for 5 Maltese branches combining premium barbering with high-end car detailing.

## Structure

| Path | Package | Purpose |
| --- | --- | --- |
| `apps/api` | `@ta-spiru/api` | NestJS backend — RBAC, bookings, virtual queue, inventory, timeclock, loyalty, Trust Payments |
| `apps/web` | `@ta-spiru/web` | Next.js storefront, `/admin` Master Portal, `/display/[branch]` TV queue boards |
| `apps/mobile` | `@ta-spiru/mobile` | Expo / React Native customer app |
| `packages/database` | `@ta-spiru/database` | Prisma schema, client, migrations, seed |
| `packages/shared` | `@ta-spiru/shared` | Cross-app constants and transport types |

## Getting started

```bash
corepack enable
pnpm install
cp .env.example .env            # fill in real credentials
pnpm db:generate
pnpm db:migrate                 # requires a running PostgreSQL
pnpm db:seed                    # branches, chairs/bays, services, products, staff, shifts
pnpm dev
```

Seed logins: `admin@taspiru.com` / `ChangeMe!2026` · staff `*@taspiru.com` / `Staff!2026` (PIN `1234`) · `customer@taspiru.com` / `Customer!2026`.

## Blueprint phase map (all implemented)

**Phase 1 — Core architecture, DB & Trust Payments.** Multi-location Prisma schema; JWT auth with location-scoped RBAC (`ADMIN` global, `MANAGER`/`RECEPTIONIST` per branch, `BARBER`/`WASH_ATTENDANT` personal); payment intents with revenue splits (`BARBER_SERVICES`, `CAR_DETAILING`, `RETAIL_BARBER`, `RETAIL_CAR_CARE`); digest-verified idempotent settlement webhook; Master Admin Portal (cookie session, dashboard, revenue-split report).

**Phase 2 — Inventory, camera scanning & timeclock.** Central movement ledger (intake / transfer / adjust / back-bar use) with per-branch levels and low-stock flags; `GET /inventory/barcode/:barcode` for camera scans; PIN kiosk clock-in/out with manager corrections; POS checkout that opens a `POS_TERMINAL` payment intent (stock deducts on settlement).

**Phase 3 — Booking engine & virtual queue.** Combo Wash & Cut availability (bay locked for the cut duration **+ 30 min buffer**) and independent barber/wash booking, both with serializable double-booking guards; live queue with state machine, positions and staff-scaled wait estimates; contextual wash upsell when a bay is free; socket.io gateway fanned out through Redis pub/sub.

**Phase 4 — E-commerce, loyalty wallet & mobile.** Online checkout with retail ledger splits; cross-business loyalty (1 pt/€ settled, BRONZE→SILVER→GOLD, earn inside the settlement transaction); wallet-pass QR payloads and receptionist scanning; admin transactions browser; mobile app pulling live branches/services.

**Phase 5 — Motion polish & TV displays.** `/display/[branch-slug]` full-screen animated queue wallboard (5 s refresh, called-customer highlight); fluid page transitions via a global motion template.

## Launch checklist

- [ ] Provision PostgreSQL + Redis; run `pnpm --filter @ta-spiru/database db:deploy && pnpm db:seed`
- [ ] Set real `TRUST_PAYMENTS_*` credentials; mirror the webhook field order configured in the MyST portal in `verifySiteSecurity`
- [ ] Point the MyST URL notification at `POST /api/v1/payments/webhook`
- [ ] Rotate `JWT_SECRET`, seed passwords and staff PINs
- [ ] Deploy API behind TLS; set `API_URL`, `NEXT_PUBLIC_API_URL`, `EXPO_PUBLIC_API_URL`
- [ ] Mount branch TVs on `/display/naxxar`, `/display/pama`, … (kiosk-mode browser)
- [ ] Wallet pass generation (Apple/Google certificates) — plug into `GET /api/v1/loyalty/pass`
- [ ] End-to-end hardware pass: POS terminals, barcode cameras, kiosk PIN pads
