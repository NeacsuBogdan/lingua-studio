# Session handoff — 2026-09-24

## Current state

Phase 0 and Phase 1 are complete and on `main`. Phase 2 is in progress on `feat/phase-2-auth-profile`. The owner-only implementation is in this branch; no Phase 3 work has started. GitHub OAuth credentials and the owner's numeric GitHub ID have not been configured at the time of this handoff, so no real owner login has been validated. Never mark Phase 2 complete until that gate passes.

## Phase 2 implementation

- Better Auth uses the existing Drizzle/PostgreSQL client and the Next.js auth route. GitHub is the only provider; password auth is disabled.
- New-user validation accepts only a verified GitHub profile with the configured stable numeric owner ID. Each protected request additionally checks the linked GitHub account against that ID. App pages and the profile write action require the server session. Visitors go to `/sign-in`.
- The sign-in page describes missing setup instead of presenting a fake login. Client login/logout buttons show pending and error states. Session records and provider accounts are stored in PostgreSQL.
- The profile form saves native language, learning language, target CEFR, optional Cambridge exam for English, daily study duration and IANA timezone through a Zod-validated server action. The dashboard uses persisted profile values and the authenticated name. Non-English choices have an honest course empty state.
- `drizzle/0001_optimal_the_order.sql` creates the auth tables and user columns. It was reviewed and applied to the dedicated Neon development database. The earlier Phase 1 migration and language seed remain in place. No owner user was created or seeded.
- `.env.local` is ignored by Git and contains the existing Neon URL, a locally generated Better Auth secret and local auth origin. OAuth client credentials and owner ID must be supplied by the owner. No secret values were printed or committed.

## Validation completed locally

- Node 22.19.0, npm 10.9.3; PowerShell uses `npm.cmd`.
- ESLint, strict TypeScript, 20 Vitest/PGlite tests across 3 suites, 10 Playwright unauthenticated desktop/mobile E2E tests, Prettier check and production build passed after implementation.
- Production build classified `/`, `/course`, `/settings`, `/sign-in`, and the auth API as dynamic routes.
- The reviewed migration applied successfully to Neon development; the database now contains `accounts`, `sessions`, `verifications` and the Phase 1 tables. The external connection uses certificate/hostname verification.
- `db:generate` reported no further schema changes; repeating `db:migrate` succeeded. `npm audit` and `npm audit --omit=dev` each reported zero findings.
- Playwright completed normally when run outside the Windows process sandbox. Inside the sandbox all tests reported pass but server teardown hung; use the verified external-process run for the final gate.

## External gate

The owner must create a GitHub OAuth App for `http://127.0.0.1:3000` with callback `http://127.0.0.1:3000/api/auth/callback/github`, and add `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and numeric `GITHUB_OWNER_ID` to ignored `.env.local`. See README and `.env.example`. Do not request secret values in chat.

After restarting the app, verify with the real GitHub owner account: successful callback to the dashboard, session surviving a reload/restart, profile edit saving to Neon and surviving reload, sign-out invalidating the session, protected routes redirecting after sign-out, and a different account being rejected. Record observed results in this handoff and ROADMAP, then mark Phase 2 complete only if they pass.

## Development rules

Preserve existing code and Git history. Do not commit `.env.local`; do not work on `main` until this branch is reviewed and merged. Keep app access closed when auth setup is incomplete. No fake account, bypass or fabricated learning progress. Do not start Phase 3 while the live Phase 2 gate is open.
