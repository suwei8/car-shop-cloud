# AGENTS.md

## Project Overview

车店云管家 — SaaS multi-tenant auto service shop management system. Monorepo with pnpm workspaces.

## Monorepo Structure

```
apps/api/        → NestJS backend (Prisma + PostgreSQL)
apps/web/        → Vue 3 admin panel (Element Plus)
apps/mobile/     → uni-app mobile app (H5 + Android WebView)
packages/shared/ → Shared types and constants
```

## Commands

```bash
# Start dev (API + Web together)
pnpm dev

# Start individually
pnpm dev:api        # NestJS on :3000
pnpm dev:web        # Vite on :5173

# Build
pnpm build          # API then Web
pnpm build:api
pnpm build:web

# Lint (runs in each package)
pnpm lint
  # API: eslint
  # Web: vue-tsc --noEmit
  # Shared: tsc --noEmit

# Database
pnpm db:migrate     # prisma migrate dev
pnpm db:seed        # ts-node prisma/seed.ts
pnpm db:studio      # prisma studio
```

## Infrastructure

`docker-compose.yml` runs: PostgreSQL 16, Redis 7, MinIO (S3-compatible). Copy `.env.example` → `.env` and set passwords before first run.

## Key Architecture Rules (Hard Constraints)

- **Every business table must have `tenant_id`.** Shop-level data also needs `shop_id`.
- **Backend must enforce tenant isolation.** Never trust `tenant_id` from the client — always extract from JWT.
- **Money is `Decimal(12,2)` in Prisma.** Never use `float` for amounts.
- **Stock, settlements, stored-value cards, and package cards must write audit trails and transaction logs.**
- **Settled work orders cannot be directly modified.** Use reversal or adjustment flows.

## API Conventions

- All routes are prefixed with `/api` (set globally in `main.ts`).
- Swagger docs at `/api/docs`.
- Global guards: `TenantGuard → RolesGuard → PermissionsGuard`.
- `@Public()` decorator bypasses auth. `@TenantRequired()` forces tenant check on platform endpoints.
- Response format: `{ code, message, data }` via `TransformInterceptor`.
- Validation via `class-validator` + `class-transformer` pipes.

## Backend Module Organization

```
apps/api/src/
  common/         → guards, decorators, filters, interceptors, pipes
  auth/           → JWT auth, login, refresh
  platform/       → tenant mgmt, subscription plans, feature flags
  tenant/         → all business modules (shop, user, work-order, stock, etc.)
  prisma/         → PrismaService, module
  file/           → MinIO/S3 file upload
  audit/          → audit log module
```

Platform vs. tenant: modules under `platform/` are super-admin (no tenant scoping). Modules under `tenant/` are business operations scoped to a tenant.

## Frontend Conventions (apps/web)

- Vue 3 + Vite + Element Plus with auto-import (no manual component imports needed).
- `@` alias maps to `src/`.
- Dev proxy: `/api` → `https://car-api.555606.xyz`.

## Mobile App (apps/mobile)

- uni-app framework. `npm run dev:h5` for browser, `npm run build:app` for Android.
- Android build: `apps/mobile/android/` with Gradle wrapper.

## Testing

**No test framework is configured yet.** There are no `.spec.ts` or `.test.ts` files. If adding tests, confirm framework choice (Jest for API, Vitest for web) and add config.

## Seeding

Seed file at `apps/api/prisma/seed.ts`. Run with `pnpm db:seed`. Includes vehicle model seed data.

## Documentation

Key docs in `docs/`:
- `README-AGENT-HANDOFF.md` — product scope, architecture, sprint plan
- `docs/tasks/` — task breakdown with dependencies and status tracking
