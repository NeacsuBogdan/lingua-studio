# Lingua Studio

Personal language-learning application. Phases 0–2 are complete: the owner's GitHub account signs in through OAuth, sessions persist in PostgreSQL, and learner preferences are saved in Neon. Lessons and learning progress are future phases.

## Local setup

Requires Node.js 22+ and npm. On Windows PowerShell use `npm.cmd` and `npx.cmd` if `.ps1` wrappers are blocked.

```sh
npm ci
npm run db:check
npm run db:inspect
npm run db:migrate
npm run db:seed
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

Playwright starts an isolated production server on `127.0.0.1:3100` and refuses to reuse an existing server. The browser suite checks the unauthenticated boundary, public sign-in accessibility, theme and mobile reflow. The unit/integration suite uses disposable PGlite databases; it does not touch Neon. A live owner browser run on the production build verified the GitHub callback, persistence across refresh, navigation and server restarts, profile updates in Neon, owner-ID enforcement and logout. See [the handoff](docs/HANDOFF.md) for the exact observations. The GitHub OAuth interaction itself remains a manual browser check because it requires the owner's authorization.

The learning profile stores native/learning language, target CEFR level, optional English Cambridge exam, daily study duration, and IANA timezone. Non-English languages can be selected, but their course content is not yet available. The current English route is an outline, not a working lesson system. Appearance remains a browser-local preference.

Read [handoff](docs/HANDOFF.md), [roadmap](docs/ROADMAP.md), and [architecture](docs/ARCHITECTURE.md) before continuing development. The full original brief is in `docs/MASTER-BRIEF.txt`.
