# Lingua Studio — architecture

## Scope and decisions (2026-09-23)

Phases 0–2 are complete. The owner's real GitHub OAuth flow, PostgreSQL session and saved profile passed live validation on the development database. The supplied master brief is retained in docs/MASTER-BRIEF.txt. No lesson execution, progress, scores, or exam claims are fabricated.

- Next.js 16.3.6 App Router, React 19.3, strict TypeScript; stable npm tags checked at initialization. Server Components by default; client components for navigation, appearance and interactive auth/profile forms.
- Tailwind 4 plus shared CSS design tokens and small semantic primitives. No component suite is needed for the current links, cards, and buttons. Add accessible headless primitives when dialogs/forms warrant them.
- PostgreSQL + Drizzle: explicit relational schema, inspectable SQL migrations, small runtime. The connection is server-only; protected pages require the configured database. External PostgreSQL is never silently replaced with browser storage.
- Zod validates environment and versioned lesson content. Checked-in JSON is the initial source of learning content. Unit/lesson catalogs and publication validation will arrive in Phase 3. Initial union supports two activity types; extend per Phase 4.
- Vitest for boundaries/domain logic; PGlite (embedded PostgreSQL in WASM) for migration/constraint integration tests; Playwright for real production-shell navigation and theme persistence.
- Vercel remains the deployment target. The owner configured a Neon development database; no production deployment has been performed.
- No AI service in the core path. Future provider interfaces belong to their scheduled phases, avoiding premature abstractions.
- Phase 2 authentication choice: Better Auth with GitHub OAuth and PostgreSQL-backed sessions. It supports the installed Next.js App Router and Drizzle setup without adopting a beta Auth.js release. Email/password and other social providers are disabled. GitHub's stable numeric account ID must match the server allowlist and the provider email must be verified; the session helper checks the linked GitHub account on each protected request. The owner's live browser sign-in passed.

## Structure

src/app: routes, error/loading/not-found boundaries, metadata and shared layout.
src/components: shared UI, navigation, theme controls.
src/content: schemas, English example fixture, curriculum outline.
src/server/db: relational schema and server-only connection.
src/lib: input/environment utilities.
drizzle: generated migrations + snapshots.
scripts: explicit database check/migrate/reference-data seed commands.
tests / e2e: integration and browser coverage.
docs: architecture, roadmap, session handoff and original brief.

## Data model

Implemented: users (UUID, case-insensitive unique email), GitHub accounts, persistent sessions, verification records, languages (language tag), learner_profiles (per-user native/learning language, optional internal estimate, target level/exam, time budget/timezone), courses (stable content identity and version).
Constraints: language FKs, cascading profile removal, supported study budgets, positive content version. No real user is seeded and there is no unauthenticated data API.

Planned incrementally: course→unit→lesson→activity publication catalog and user/lesson progress in Phase 3; immutable attempts in Phase 4; vocabulary/progress in Phase 5; review items/events in Phase 6; mistakes in Phase 7; study sessions thereafter. All progress rows must include user_id and content version/ID. Authorization derives user identity server-side, never from a submitted user ID. Enforce idempotent completion and unique identities before XP exists.

Keep source content distinct from learner state. Record attempts against a content version. Validate unique IDs, prerequisite references/cycles, activity correctness, and language metadata at publication. Japanese will add optional orthography/readings objects rather than repurposing English-only fields.

## Design

Working name: Lingua Studio. Ink-blue learning surface, crisp cool-neutral cards, serif editorial emphasis only inside the journey and course cards. Blue is the action accent. Both palettes share semantic tokens. No fabricated charts, streaks, review counts, or mastery values. The dashboard reads the persisted target and leaves proficiency unassessed. Browser storage is only used by next-themes for device-local appearance.

## Quality and security

Validate at server boundaries; never log connection URLs. Keep credentials in ignored environment files; .env.example contains placeholders only. Migrations run explicitly, never during builds or page visits. Auth, ownership checks, CSRF/session protections and rate limits must precede personal-data endpoints. Persist timezone-aware event timestamps; compute streak dates using the learner timezone in the relevant phase.

The application pages require a server-validated owner session. The public sign-in page gives a setup state when OAuth is incomplete; there is no mock login. The profile server action derives the user ID from that session, validates input with Zod and writes only that user's row. Migrations `0001` and `0002` are applied on the Neon development database. The owner mismatch and logout boundaries passed live browser checks; an integration test covers expired signed sessions. Auth library errors are logged generically to avoid exposing OAuth state or PKCE parameters. The example lesson is a schema fixture, not an available course. Do not claim CEFR certification or official Cambridge endorsement. Verify Cambridge sources in Phase 16.

## Sources

Framework installation guidance: https://nextjs.org/docs/app/getting-started/installation (checked 2026-09-23), plus documentation bundled with installed Next.js. Package versions are reproducibly recorded in package-lock.json.
