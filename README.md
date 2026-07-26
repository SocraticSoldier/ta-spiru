# Ta' Spiru Digital Ecosystem

Unified platform for 5 Maltese branches combining premium barbering with high-end car detailing.

## Structure

| Path | Package | Purpose |
| --- | --- | --- |
| `apps/api` | `@ta-spiru/api` | NestJS backend — RBAC, bookings, virtual queue, inventory, timeclock, loyalty, Trust Payments |
| `apps/web` | `@ta-spiru/web` | Next.js storefront, `/admin` Master Portal, `/display/[branch]` TV queue boards |
| `apps/mobile` | `@ta-spiru/mobile` | Expo / React Native customer app |
| `apps/jarvis` | `@ta-spiru/jarvis` | Jarvis — Jake's installable voice-assistant PWA (unrelated to the Ta' Spiru product; see `apps/jarvis/README.md`) |
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

## Accounts (seeded)

| Who | Email | Role / scope |
| --- | --- | --- |
| Norbert (owner) | `norbert@taspiru.com` | ADMIN — barber & car wash, all branches |
| Joane | `joane@taspiru.com` | ADMIN — barber division |
| Chris | `chris@taspiru.com` | MANAGER — car wash, cross-branch |
| Andrea / Romina | `andrea@` / `romina@taspiru.com` | RECEPTIONIST — Naxxar |
| Clarice | `clarice@taspiru.com` | RECEPTIONIST — Fgura |
| Martin (supervisor) | `martin@taspiru.com` | WASH_ATTENDANT — Naxxar |
| Jerry / Kelvin | `jerry@` / `kelvin@taspiru.com` | WASH_ATTENDANT — Naxxar / Pama |
| Barbers (21) | `<firstname>@taspiru.com` | Real roster across the 5 branches (Naxxar 5, Pama 4, San Ġwann 4, Fgura 6, San Ġiljan 2) — see `BARBERS_BY_BRANCH` in `prisma/seed.ts` |

Passwords: staff `Staff!2026` (kiosk PIN `1234`) · system fallback `admin@taspiru.com` / `ChangeMe!2026` · `customer@taspiru.com` / `Customer!2026`.

## Customer experience

- **Booking wizard** (`/book`): Cut, Wash, or Combo Wash & Cut — branch → services → live colour-coded slots (blocked windows and taken slots never appear) → inline sign-in/sign-up gate → booked as `PENDING_PAYMENT` with a Trust Payments intent opened (splits per stream). Deep-linkable via `/book?stream=CUT|WASH|COMBO`.
- **Accounts**: `POST /auth/register` self-service customer signup; `/signin` with httpOnly cookie sessions; middleware-guarded `/account`.
- **Customer dashboard** (`/account`): loyalty wallet card with tier + gold QR (scannable at reception via `POST /loyalty/scan`), upcoming bookings with one-click cancel (a combo cancels both segments), history, and retail orders.

## UI & scheduling controls

- **Brewheat** is the brand display face (self-hosted in `apps/web/public/fonts`, loaded via `expo-font` on mobile).
- Landing plays the *"It's not just a haircut, it's a lifestyle"* intro once per session, then splits into **The Barber** (bronze) / **The Car Wash** (teal) storefronts.
- **Unified calendar** (`/admin/calendar`): all branches at once, chips colour-coded by stream (bronze barber / teal wash) with per-branch hue dots, combo badges and status dots.
- **Block-out times** from the calendar (ADMIN/MANAGER): a barber's break or a whole-branch closure — blocked windows are excluded from client availability and rejected at booking time (`TimeBlock` model).
- **Reception desk** (`/admin/queue`): live queue with Call / Start / Done actions and walk-in creation; the sidebar is role-aware (receptionists see their working set, Transactions stays owner-only).

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
