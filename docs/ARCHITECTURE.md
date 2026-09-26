# Lingua Studio — architecture

## Scope and decisions (2026-09-25)

Phases 0–3 are merged into main. Phase 4 adds deterministic graded practice to the small English curriculum and remains under validation on `feat/phase-4-exercise-engine`. The supplied master brief is retained in docs/MASTER-BRIEF.txt. Completion is not a proficiency score, and no exam claim is made.

- Next.js 16.3.6 App Router, React 19.3, strict TypeScript; stable npm tags checked at initialization. Server Components by default; client components for navigation, appearance and interactive auth/profile forms.
- Tailwind 4 plus shared CSS design tokens and small semantic primitives. No component suite is needed for the current links, cards, and buttons. Add accessible headless primitives when dialogs/forms warrant them.
- PostgreSQL + Drizzle: explicit relational schema, inspectable SQL migrations, small runtime. The connection is server-only; protected pages require the configured database. External PostgreSQL is never silently replaced with browser storage.
- Zod validates environment and versioned content. Checked-in TypeScript content data is the editorial source for the English course; a transactional, idempotent seed publishes it into normalized PostgreSQL catalog tables. Catalog schema version 2 adds a discriminated activity union for seven graded exercise types alongside explanation/reflection blocks. The original JSON example remains a separate schema fixture.
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

Phase 4 adds `exercise_attempts`: a server-generated UUID, authenticated user, lesson/activity/content version, transport submission UUID, validated submitted answer, correctness, score (0–1), timestamp and a feedback/model-answer/explanation snapshot. A database trigger prohibits updates. User deletion may cascade for fixture cleanup or an explicit future privacy operation; ordinary app code never updates or deletes attempts. Vocabulary tracking belongs to Phase 5, review scheduling to Phase 6 and mistakes to Phase 7; none is implemented here.

Progress rows contain user_id, lesson ID and content version. Authorization derives user identity server-side, never from a submitted user ID. Progress increments only at the expected position and version, so replayed/stale steps cannot skip a block; completion is idempotent. A graded block requires at least one saved attempt before traversal, but an incorrect answer may still continue. Correctness and completion remain separate. A changed lesson content version starts afresh when the learner next opens it. There is no XP or inferred mastery.

## Exercise boundary and evaluation

`activity-schema.ts` defines strict, concrete payloads. Multiple choice has stable option IDs and exactly one correct ID; reorder uses token IDs (including repeated display words); matching defines a complete ID bijection. Four text types use explicit curated accepted forms and normalization metadata. Definitions reject missing/duplicate/unknown answer IDs. `en/exercises.ts` supplies eight exercises across the existing five lessons, proving all seven types. The initial translation is curated Romanian→English; it is not an arbitrary translation evaluator.

Trusted payloads remain on the server. `presentExercise` constructs an explicit public allowlist for the current exercise only: prompt, instructions, metadata, options/tokens/matching collections or source/context text. It omits correct IDs, accepted forms, option feedback, explanation and normalization metadata before submission. No editorial catalog or evaluator is imported into the client bundle. A prior submitted answer and its own feedback may be loaded after refresh. Completed review is available only after traversal.

`POST /api/exercises/attempt` checks the owner session and same-origin request, rejects oversized/malformed/extra fields, derives the profile's language, then calls the repository. The transaction locks the lesson version and user progress, checks active-course membership, prerequisites and the current activity, validates the answer type/IDs, grades trusted persisted content and inserts an immutable attempt. The client never supplies correctness, score or user ID. A unique user/submission key and serialized progress lock deduplicate transport replays; reusing a key with changed content is rejected. An intentional retry generates a new key. No answers are inferred from an old content version.

Text evaluation normalizes Unicode to NFC, trims surrounding whitespace and collapses repeated whitespace. Case sensitivity and tolerance of final ASCII `.`, `!` or `?` are explicit metadata. Accents, apostrophes and internal punctuation are preserved. Submitted text is stored as entered; normalization is only for evaluation. Multiple choice, reorder and text score 0 or 1; matching also returns the fraction of correctly paired items, with overall correctness requiring every pair. Translation accepts only authored alternatives. There is no AI grading or semantic-equivalence claim.

All five lessons and the course move intentionally from version 1 to 2 because graded practice changes completion semantics. Seed leaves owner profiles/progress and attempt history unchanged; opening a revised lesson resets its existing progress through the Phase 3 version rule. Existing activity IDs remain stable, reflection moves after practice, and transactional order shifting permits new blocks without unique-order conflicts. Removing a published activity ID fails the seed and requires an explicit reviewed migration.

The checked-in course source is validated for language tags, CEFR ordering, consecutive per-parent order, unique IDs, activity payloads and levels, and backward-only prerequisite references (preventing cycles). The seed upserts catalog rows without touching authentication, profile or progress. Server queries derive locked/available/in-progress/completed from current-version progress and prerequisite completion. The lesson page and every mutation require the Phase 2 owner session; a direct action cannot start or finish locked content. Japanese can later add validated orthography/readings payloads without repurposing English-only columns.

## Design

Working name: Lingua Studio. Ink-blue learning surface, crisp cool-neutral cards, serif editorial emphasis only inside the journey and course cards. Blue is the action accent. Both palettes share semantic tokens. No fabricated charts, streaks, review counts, or mastery values. The dashboard reads the persisted target and leaves proficiency unassessed. Browser storage is only used by next-themes for device-local appearance.

## Quality and security

Validate at server boundaries; never log connection URLs. Keep credentials in ignored environment files; .env.example contains placeholders only. Migrations run explicitly, never during builds or page visits. Auth, ownership checks, CSRF/session protections and rate limits must precede personal-data endpoints. Persist timezone-aware event timestamps; compute streak dates using the learner timezone in the relevant phase.

The application pages require a server-validated owner session. The public sign-in page gives a setup state when OAuth is incomplete; there is no mock login. The profile server action derives the user ID from that session, validates input with Zod and writes only that user's row. Migrations `0001`–`0003` are applied on the Neon development database. The owner mismatch and logout boundaries passed live browser checks in Phase 2; an integration test covers expired signed sessions. Phase 3's authenticated E2E uses an ephemeral linked owner fixture under a process-only test owner ID, not an application bypass, and deletes its rows afterward. Auth library errors are logged generically to avoid exposing OAuth state or PKCE parameters. The example JSON lesson is a schema fixture, not an available course. Do not claim CEFR certification or official Cambridge endorsement. Verify Cambridge sources in Phase 16.

## Sources

Framework installation guidance: https://nextjs.org/docs/app/getting-started/installation (checked 2026-09-23), plus documentation bundled with installed Next.js. Package versions are reproducibly recorded in package-lock.json.
