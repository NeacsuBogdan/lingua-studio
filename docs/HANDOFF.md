# Session handoff — 2026-09-24

## Actual state

Phase 0 and Phase 1 are complete. Phase 2 implementation is starting. The application currently shows a public overview, English curriculum outline and appearance settings; it has no authentication or persisted learning data yet.

## Work completed in the Windows checkout

- Restored the supplied Git history bundle in the existing working directory without overwriting source files. No remote is configured.
- Installed Playwright Chromium and isolated E2E on a production server at `127.0.0.1:3100`, with no reuse of an unrelated port 3000 server.
- Extended E2E for both system themes, theme selection and reload persistence, keyboard focus, desktop/mobile and 320px reflow, console errors, screenshots and axe WCAG checks. Theme behavior works in the local browser; no source theme bug was reproduced.
- Reviewed the four moderate npm audit findings. All came through Drizzle Kit's development-only `@esbuild-kit/core-utils` → old esbuild chain. A targeted esbuild override resolved them; `npm audit` and `npm audit --omit=dev` each reported zero findings. `npm run db:generate` still works and generated no migration change.
- Added a read-only `db:inspect` command reporting the database name, PostgreSQL version, client TLS policy and table names. Added `docs/NEON-SETUP.md` for the selected development provider and updated README.
- Visual inspection of overview, course and preferences screenshots in light/dark, desktop/mobile and 320px found no clipped text or layout break. Automated checks found no horizontal overflow.

## Validation

- Node 22.19.0, npm 10.9.3, installed package versions consistent with lockfile. PowerShell requires `npm.cmd` / `npx.cmd` because `.ps1` scripts are blocked by execution policy.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: 11 tests, 2 suites passed, including PGlite migrations and constraints.
- `npm run format:check`: passed.
- `npm run test:e2e`: 8 tests passed across desktop and mobile after Chromium installation and accessibility extension.
- `npm run db:generate`: passed; no schema changes.
- `npm audit` and `npm audit --omit=dev`: zero findings after the override.
- `npm run build`: passed with the configured Neon development URL.
- `db:check` and `db:inspect`: passed on Neon PostgreSQL 17. The client used `verify-full` TLS. The initially empty database received the reviewed migration and reference seed; repeating both succeeded. No personal account rows were created.

## External gate and exact next actions

The user configured a valid Neon `DATABASE_URL` in `.env.local`. No credential value was printed. The initial database and browser gates passed. The next external inputs for Phase 2 are GitHub OAuth credentials and the owner's GitHub identity.

Phase 2 execution:

1. Implement secure owner-only login/session, route and operation authorization, persistent validated learner profile, migrations and tests.
2. Configure GitHub OAuth credentials in `.env.local` and validate a real login against Neon. Do not label Phase 2 complete without this live validation.

## Notes

The repository has local changes from this work pending commit; preserve them. `.env.local`, dependencies, build artifacts and screenshots are Git ignored. Do not commit the original master prompt accidentally if it remains untracked. The Phase 1 migration and language seed are applied to the Neon development database. No auth migration or cloud deployment has been applied yet.
