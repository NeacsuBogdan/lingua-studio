# Session handoff — 2026-09-23

## Completed

Phase 0: architecture, stack, initial data/content models, design direction, roadmap.
Phase 1 implementation: Next.js App Router, strict TS, Tailwind, responsive shell, overview/course outline/preferences routes, theme provider, loading/error/404 pages, environment validation, server-only Drizzle adapter, initial SQL migration, reference seed, test tooling.

## Validated

- `npm run build`: passed (Next.js 16.3.6; overview/course/settings generated).
- `npm run lint`: passed, no warnings.
- `npm run typecheck`: passed.
- `npm test`: 11 passing tests across 2 suites, including real SQL migrations/constraints in PGlite.
- `npm run format:check`: passed.
- Cloud browser: overview rendered; navigation to course outline and preferences confirmed through DOM checks.

## Incomplete validation / honest boundaries

- No external PostgreSQL URL supplied. postgres.js TCP/TLS connection and cloud persistence remain unverified. PGlite integration tests are not equivalent to that gate.
- Playwright Chromium download returned an invalid/truncated archive, so the checked-in desktop/mobile E2E suite could not execute.
- Cloud browser screenshot capture timed out. No visual/mobile QA sign-off.
- Theme control is implemented using next-themes, but clicks in the cloud preview did not demonstrate a changed theme attribute. Treat theme interaction/persistence as UNVERIFIED and investigate hydration/browser runtime before signing off Phase 1. Do not claim it is confirmed working.
- Phase 1 therefore remains open. No Phase 2 work started.

## Current state

Can run the foundation locally using npm ci && npm run dev. Overview shows explicit empty state; course page is an outline, not a working lesson engine. No authentication, learner progress, review scheduling or exam exercises yet. No deployment or external Git remote exists. Source and a Git bundle are delivered together to preserve continuity.

## Next

1. Run the existing browser suite in an environment with Chromium; validate theme change/persistence, hydration, mobile overflow and visual layout. Fix any confirmed source issues.
2. Configure DATABASE_URL through .env.local or secret settings (do not paste secrets into chat). Run db:check, db:migrate, db:seed.
3. Mark remaining Phase 1 gates complete only after successful results.
4. Phase 2: secure personal authentication, persistent sessions, route protection and validated profile settings. Obtain OAuth provider configuration only when implementation is ready.

## Engineering notes

scripts/dev.mjs translates the supervised preview's --host/--strictPort flags to Next.js-compatible flags; ordinary npm run dev still works. The project remains Next.js, not Vinext. Use npm, preserve package-lock.json. .env files, build products, dependencies and test artifacts are ignored. next-env.d.ts is generated and excluded from formatting checks.
