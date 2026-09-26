# Lingua Studio

Personal language-learning application. Phases 0–3 are merged into main. Phase 4 adds a schema-driven exercise engine with deterministic server grading, saved feedback and immutable attempts; final Phase 4 validation is tracked in the roadmap. GitHub owner-only authentication, PostgreSQL sessions and learner preferences remain in place.

## Local setup

Requires Node.js 22+ and npm. On Windows PowerShell use `npm.cmd` and `npx.cmd` if `.ps1` wrappers are blocked.

```sh
npm ci
npm run db:check
npm run db:inspect
npm run db:migrate
npm run db:seed
npm run db:verify
npm run dev
```

Use a dedicated development PostgreSQL database. Copy `.env.example` to ignored `.env.local` and replace its placeholders. [Neon setup](docs/NEON-SETUP.md) explains the selected database provider. Review the target with `db:inspect` before migrating. Migration files are committed; `db:generate` produces new SQL after schema changes. Do not use schema push or a production database for development checks.

## Owner sign-in

Create a GitHub OAuth App under **GitHub Settings → Developer settings → OAuth Apps**. For local development, set **Homepage URL** to `http://127.0.0.1:3000` and **Authorization callback URL** to `http://127.0.0.1:3000/api/auth/callback/github`. In `.env.local` set:

- `BETTER_AUTH_URL` to that same origin;
- `BETTER_AUTH_SECRET` to a random secret of at least 32 characters (the example file contains a generation command);
- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` from the OAuth App;
- `GITHUB_OWNER_ID` to your account's **numeric** GitHub ID, obtainable from the `id` field at `https://api.github.com/users/YOUR_USERNAME`.

Keep secrets in `.env.local`; never commit or send them in chat. Restart `npm run dev` after editing environment values. Open `http://127.0.0.1:3000/sign-in` and sign in with that exact GitHub account. If GitHub requires you to verify your email, complete that in GitHub first. Other accounts are rejected server-side. Auth sessions live in PostgreSQL, and sign-out ends the session. When configuration is incomplete, sign-in shows an honest setup state; the application does not bypass authentication.

If local sign-in appears unresponsive, check whether the button changes to `Connecting…` and whether the browser sends `POST /api/auth/sign-in/social`. A failed POST can indicate an unavailable development database; run `npm run db:check` and inspect the server error without sharing credentials or OAuth query parameters. With direct `http://127.0.0.1:3000` development, Next's HMR should connect over `ws://`. If the browser instead shows a repeated `wss://` HMR failure, stop and restart the dev server, open a fresh tab at the direct local URL, and check for a proxy or stale browser runtime. HMR is development-only; the production build has no HMR connection.

Use an HTTPS URL and a matching GitHub OAuth callback for any deployed origin. Keep secrets and the owner ID in the deployment environment, not the source tree. Apply migrations before serving the application. Deployment itself is a later phase.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run format:check
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright starts an isolated production server on `127.0.0.1:3100` and refuses to reuse an existing server. The default browser suite checks unauthenticated boundaries, sign-in accessibility, theme and mobile reflow. It also checks that the sign-in click invokes Better Auth and reaches the GitHub authorization navigation, intercepting that navigation before account authorization. The server uses a process-only `BETTER_AUTH_URL` matching the test origin. The unit/integration suite uses disposable PGlite databases; it does not touch Neon. To run the authenticated course browser test against the Neon **development** database, set `E2E_OWNER_COURSE=1` before `npm run test:e2e`. It creates a temporary, signed owner-session fixture under a process-only test owner ID, completes a lesson, checks unlocking, accessibility and responsive views, then removes the fixture user and its progress. It does not replace the real GitHub OAuth flow; the owner's live OAuth callback and profile/session behavior were verified in Phase 2. See [the handoff](docs/HANDOFF.md) for exact observations.

The learning profile stores native/learning language, target CEFR level, optional English Cambridge exam, daily study duration, and IANA timezone. English is the only published course. Its A1–C2 metadata contains five B1/B2 lessons across three units; other levels are unpublished. Lessons mix study/reflection with multiple choice, fill gap, typed answer, reorder, matching, curated translation and error correction. A checked answer creates a saved attempt; retry creates another, and feedback survives refresh. You may continue after an incorrect attempt. Completion records practice, not mastery or certification. The initial translation exercise is Romanian→English with explicit accepted forms. Other curricula remain unpublished; appearance stays browser-local.

Exercise answers are graded against persisted content on the server. Hidden correct-answer fields and explanations are omitted before submission. Text normalization preserves accents and internal punctuation; whitespace, case and final punctuation follow authored rules. Migration `0004` adds append-only attempt history and has been applied and safely repeated with the seed on Neon development. Whole-row fingerprints confirmed existing authentication, profile and progress data survived unchanged. Lesson versions rise to 2: seeding preserves existing profiles/progress, and a revised lesson starts afresh when reopened. Real owner login and manual exercise validation remain required before Phase 4 is complete. No vocabulary mastery, spaced repetition, mistake system or AI grading is included.

The versioned curriculum lives in `src/content/en/course.ts` and `src/content/en/exercises.ts`, validated by `src/content/course-schema.ts` and `src/content/activity-schema.ts`, and published by the idempotent `db:seed` command. Run the committed migrations before seeding. `db:verify` checks the catalog (18 blocks and 7 exercise types) and detects leftover test fixtures without printing learner data. It reports profile and attempt counts. Content, progress and attempts use separate tables. See [architecture](docs/ARCHITECTURE.md) for grading, normalization, versioning and unlock rules.

Read [handoff](docs/HANDOFF.md), [roadmap](docs/ROADMAP.md), and [architecture](docs/ARCHITECTURE.md) before continuing development. The full original brief is in `docs/MASTER-BRIEF.txt`.
