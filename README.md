# Ta' Spiru Digital Ecosystem

Unified platform for 5 Maltese branches combining premium barbering with high-end car detailing.

## Structure

| Path | Package | Purpose |
| --- | --- | --- |
| `apps/api` | `@ta-spiru/api` | NestJS backend — RBAC auth, combo booking engine, Trust Payments, Redis queue fan-out |
| `apps/web` | `@ta-spiru/web` | Next.js (App Router) storefront/admin — Tailwind CSS + Framer Motion |
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
pnpm db:seed                    # 5 branches, chairs/bays, services, products, admin user
pnpm dev
```

## Domain rules encoded in Phase 1

- **Combo Wash & Cut** — `GET /api/v1/bookings/combo-availability` finds overlapping barber + wash-bay slots; the bay is locked for the barber appointment duration **plus a 30-minute buffer** (`COMBO_WASH_BUFFER_MIN`).
- **RBAC** — `ADMIN` (global), `MANAGER` / `RECEPTIONIST` (location), `BARBER` / `WASH_ATTENDANT` (personal); enforced via `JwtAuthGuard` + `RolesGuard` with cross-location denial.
- **Central inventory ledger** — `StockLevel` per branch + append-only `StockMovement` (e-commerce, POS, back-bar); paid orders deduct stock inside the payment-settlement transaction.
- **Trust Payments** — `POST /api/v1/payments/intent` opens a `PENDING` ledger transaction with revenue splits (`BARBER_SERVICES`, `CAR_DETAILING`, `RETAIL_BARBER`, `RETAIL_CAR_CARE`) and returns the signed JWT; `POST /api/v1/payments/webhook` verifies the site-security digest, settles idempotently, confirms appointments, and marks orders paid.
- **Master Admin Portal** — `/admin` in `apps/web`: cookie-session login (JWT stored httpOnly via `/api/session`), middleware-guarded routes, dashboard with settled revenue by ledger tag (`GET /api/v1/reports/revenue-splits`, ADMIN-only) and the branch network (`GET /api/v1/locations`); Calendar / Inventory / Transactions / Staff shells staged for later phases. Seed admin: `admin@taspiru.com` / `ChangeMe!2026`.
