# Lingua Studio — architecture

## Scope and decisions (2026-09-25)

Phases 0–3 are complete. The owner's real GitHub OAuth flow, PostgreSQL session and saved profile passed live validation on the development database. Phase 3 publishes a small English curriculum and persists traversal/completion of its lessons. The supplied master brief is retained in docs/MASTER-BRIEF.txt. Completion is not a proficiency score, and no exam claim is made.

- Next.js 16.3.6 App Router, React 19.3, strict TypeScript; stable npm tags checked at initialization. Server Components by default; client components for navigation, appearance and interactive auth/profile forms.
- Tailwind 4 plus shared CSS design tokens and small semantic primitives. No component suite is needed for the current links, cards, and buttons. Add accessible headless primitives when dialogs/forms warrant them.
- PostgreSQL + Drizzle: explicit relational schema, inspectable SQL migrations, small runtime. The connection is server-only; protected pages require the configured database. External PostgreSQL is never silently replaced with browser storage.
- Zod validates environment and versioned content. Checked-in TypeScript content data is the editorial source for the English course; a transactional, idempotent seed publishes it into normalized PostgreSQL catalog tables. The original JSON example remains a schema fixture. Phase 3 uses explanation/reflection blocks, with answer checking reserved for Phase 4.
- Vitest for boundaries/domain logic; PGlite (embedded PostgreSQL in WASM) for migration/constraint integration tests; Playwright for real production-shell navigation and theme persistence.
- Vercel remains the deployment target. The owner configured a Neon development database; no production deployment has been performed.
- No AI service in the core path. Future provider interfaces belong to their scheduled phases, avoiding premature abstractions.
- Phase 2 authentication choice: Better Auth with GitHub OAuth and PostgreSQL-backed sessions. It supports the installed Next.js App Router and Drizzle setup without adopting a beta Auth.js release. Email/password and other social providers are disabled. GitHub's stable numeric account ID must match the server allowlist and the provider email must be verified; the session helper checks the linked GitHub account on each protected request. The owner's live browser sign-in passed.

## Structure

src/app: routes, error/loading/not-found boundaries, metadata and shared layout.
src/components: shared UI, navigation, theme controls.
src/content: schemas, English course source, earlier example fixture and level descriptions.
src/server/db: relational schema and server-only connection.
src/lib: input/environment utilities.
drizzle: generated migrations + snapshots.
scripts: explicit database check/migrate/reference-data seed commands.
tests / e2e: integration and browser coverage.
docs: architecture, roadmap, session handoff and original brief.

## Data model

Implemented: users (UUID, case-insensitive unique email), GitHub accounts, persistent sessions, verification records, languages (code, display/native names, writing direction, active flag), learner_profiles (per-user native/learning language, optional internal estimate, target level/exam, time budget/timezone), courses, course_levels, units, lessons, lesson_activities, lesson_prerequisites and lesson_progress. The course points to a learning language; the learner profile supplies the native→learning direction. Content identity/order/version and learner progress are distinct.
Constraints: language FKs, cascading profile/progress removal, supported study budgets, positive ordering/version/duration, unique order within a parent, unique lesson/owner progress, valid progress state and completion timestamp. No real user is seeded and there is no unauthenticated data API.

Planned incrementally: immutable graded attempts in Phase 4; vocabulary tracking in Phase 5; review items/events in Phase 6; mistakes in Phase 7; study sessions thereafter. Progress rows contain user_id, lesson ID and content version. Authorization derives user identity server-side, never from a submitted user ID. Progress increments only at the expected position, so replayed/stale steps cannot skip a block; completion is idempotent. A changed lesson content version starts afresh when the learner next opens it. There is no XP or inferred mastery.

The checked-in course source is validated for language tags, CEFR ordering, consecutive per-parent order, unique IDs, activity payloads and levels, and backward-only prerequisite references (preventing cycles). The seed upserts catalog rows without touching authentication, profile or progress. Server queries derive locked/available/in-progress/completed from current-version progress and prerequisite completion. The lesson page and every mutation require the Phase 2 owner session; a direct action cannot start or finish locked content. Japanese can later add validated orthography/readings payloads without repurposing English-only columns.

## Design

Working name: Lingua Studio. Ink-blue learning surface, crisp cool-neutral cards, serif editorial emphasis only inside the journey and course cards. Blue is the action accent. Both palettes share semantic tokens. No fabricated charts, streaks, review counts, or mastery values. The dashboard reads the persisted target and leaves proficiency unassessed. Browser storage is only used by next-themes for device-local appearance.

## Quality and security

Validate at server boundaries; never log connection URLs. Keep credentials in ignored environment files; .env.example contains placeholders only. Migrations run explicitly, never during builds or page visits. Auth, ownership checks, CSRF/session protections and rate limits must precede personal-data endpoints. Persist timezone-aware event timestamps; compute streak dates using the learner timezone in the relevant phase.

The application pages require a server-validated owner session. The public sign-in page gives a setup state when OAuth is incomplete; there is no mock login. The profile server action derives the user ID from that session, validates input with Zod and writes only that user's row. Migrations `0001`–`0003` are applied on the Neon development database. The owner mismatch and logout boundaries passed live browser checks in Phase 2; an integration test covers expired signed sessions. Phase 3's authenticated E2E uses an ephemeral linked owner fixture under a process-only test owner ID, not an application bypass, and deletes its rows afterward. Auth library errors are logged generically to avoid exposing OAuth state or PKCE parameters. The example JSON lesson is a schema fixture, not an available course. Do not claim CEFR certification or official Cambridge endorsement. Verify Cambridge sources in Phase 16.

## Sources

Framework installation guidance: https://nextjs.org/docs/app/getting-started/installation (checked 2026-09-23), plus documentation bundled with installed Next.js. Package versions are reproducibly recorded in package-lock.json.
