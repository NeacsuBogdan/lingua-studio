# Lingua Studio — architecture

## Scope and decisions (2026-09-23)

This iteration implements Phase 0 and the Phase 1 foundation only. The supplied master brief is retained in docs/MASTER-BRIEF.txt. No accounts, lesson execution, progress, scores, or exam claims are fabricated.

- Next.js 16.3.6 App Router, React 19.3, strict TypeScript; stable npm tags checked at initialization. Server Components by default; client components only for navigation state and appearance.
- Tailwind 4 plus shared CSS design tokens and small semantic primitives. No component suite is needed for the current links, cards, and buttons. Add accessible headless primitives when dialogs/forms warrant them.
- PostgreSQL + Drizzle: explicit relational schema, inspectable SQL migrations, small runtime. PostgreSQL connection is lazy and server-only; no database needed to render the foundation. External PostgreSQL is never silently replaced with browser storage.
- Zod validates environment and versioned lesson content. Checked-in JSON is the initial source of learning content. Unit/lesson catalogs and publication validation will arrive in Phase 3. Initial union supports two activity types; extend per Phase 4.
- Vitest for boundaries/domain logic; PGlite (embedded PostgreSQL in WASM) for migration/constraint integration tests; Playwright for real production-shell navigation and theme persistence.
- Vercel is the deployment target, not Sites hosting. This session prepares source only, as required by the first-execution scope. No remote repository or cloud database was supplied.
- No AI service in the core path. Future provider interfaces belong to their scheduled phases, avoiding premature abstractions.
- Phase 2 authentication choice: Auth.js with GitHub OAuth and database-backed sessions, subject to provider configuration. No password recovery or mail delivery costs; enforce an allowlisted owner at first. Requires user-supplied OAuth credentials and live PostgreSQL. Re-evaluate version compatibility at implementation time.

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

Implemented: users (UUID, case-insensitive unique email), languages (language tag), learner_profiles (per-user native/learning language, optional internal estimate, target level/exam, time budget/timezone), courses (stable content identity and version).
Constraints: language FKs, cascading profile removal, supported study budgets, positive content version. No real user is seeded and there is no unauthenticated data API.

Planned incrementally: authentication accounts/sessions in Phase 2; course→unit→lesson→activity publication catalog and user/lesson progress in Phase 3; immutable attempts in Phase 4; vocabulary/progress in Phase 5; review items/events in Phase 6; mistakes in Phase 7; study sessions thereafter. All progress rows must include user_id and content version/ID. Authorization derives user identity server-side, never from a submitted user ID. Enforce idempotent completion and unique identities before XP exists.

Keep source content distinct from learner state. Record attempts against a content version. Validate unique IDs, prerequisite references/cycles, activity correctness, and language metadata at publication. Japanese will add optional orthography/readings objects rather than repurposing English-only fields.

## Design

Working name: Lingua Studio. Ink-blue learning surface, crisp cool-neutral cards, serif editorial emphasis only inside the journey and course cards. Blue is the action accent. Both palettes share semantic tokens. No fabricated charts, streaks, review counts, or mastery values. B2 is explicitly self-reported and C1 a suggested goal. Browser storage is only used by next-themes for device-local appearance.

## Quality and security

Validate at server boundaries; never log connection URLs. Keep credentials in ignored environment files; .env.example contains placeholders only. Migrations run explicitly, never during builds or page visits. Auth, ownership checks, CSRF/session protections and rate limits must precede personal-data endpoints. Persist timezone-aware event timestamps; compute streak dates using the learner timezone in the relevant phase.

Current UI is public and contains no persisted personal data. Root layout validates any supplied database URL. The example lesson is a schema fixture, not an available course. Do not claim CEFR certification or official Cambridge endorsement. Verify Cambridge sources in Phase 16.

## Sources

Framework installation guidance: https://nextjs.org/docs/app/getting-started/installation (checked 2026-09-23), plus documentation bundled with installed Next.js. Package versions are reproducibly recorded in package-lock.json.
