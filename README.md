# Lingua Studio

Personal English-learning platform. This repository contains **Phase 0 + Phase 1**, not the completed language-learning product.

## Run locally

Requires Node.js 22+ (Node 24 used for validation) and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. The overview, curriculum outline, preferences, and light/dark appearance work without credentials. Appearance is device-local. There is no login or saved learning progress yet.

## Verify

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run format:check
```

E2E starts the production server automatically after a build. On Linux you may need `npx playwright install --with-deps chromium`. Integration tests run migrations and queries in disposable PGlite databases and require no external database.

## PostgreSQL

Copy `.env.example` to `.env.local` and set DATABASE_URL to your PostgreSQL connection string (Neon/Supabase or local PostgreSQL). Use the provider's required TLS settings. Never commit this file. For Vercel use a suitable pooled connection string; the postgres.js client disables prepared statements and limits connections.

```sh
npm run db:check
npm run db:migrate
npm run db:seed
```

Seed is repeatable and inserts only language reference data. Migration files are committed. After schema changes, run `npm run db:generate`, review the generated SQL, and then migrate. Do not replace migrations with schema push in production. No destructive reset command is supplied.

**Verification boundary:** PGlite confirms PostgreSQL SQL/constraints and Drizzle behavior. It does not verify the external postgres.js TCP/TLS connection, provider pooling, or cloud credentials. Run db:check against your actual database before considering that Phase 1 gate complete.

## Deployment preparation

This is a normal Next.js project targeting Vercel; no custom vercel.json is required. Push to your own Git repository, import into Vercel with the Next.js preset, and configure DATABASE_URL securely. Run migrations from a trusted local/CI environment before enabling dependent features. Build command: `npm run build`; install command: `npm ci`. Domain configuration and production authentication are later phases. No production deployment has been performed.

## Continue the project

Read `docs/HANDOFF.md`, `docs/ROADMAP.md`, then `docs/ARCHITECTURE.md`. The original instructions are retained in `docs/MASTER-BRIEF.txt`. Keep the same repository history. Finish the external database gate, then implement Phase 2 authentication and learner profiles. Do not skip ahead into fake learning functionality.
