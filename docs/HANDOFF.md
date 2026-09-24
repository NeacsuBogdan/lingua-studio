# Session handoff — 2026-09-25

## Current state

Phases 0–3 are complete on `feat/phase-3-content-course-engine`; Phase 4 has not started. The Phase 2 owner GitHub OAuth/session/profile implementation remains intact. The Neon development database contains the additive Phase 3 schema and English course; it still has one pre-existing learner profile. The owner had signed out at the end of Phase 2, so the next personal use begins with a normal GitHub sign-in.

## Phase 3 implementation

- The content model is language → course → CEFR level → unit → lesson → ordered activity blocks, with a prerequisite junction table and separate user/lesson progress. Languages now carry native names, writing direction and active status. The learner profile supplies the native→learning direction; English is the only active published course.
- The English catalog represents A1–C2. Three units and five lessons form a deliberate B1/B2 bridge; A1, A2, C1 and C2 are metadata only and are labelled as unpublished in the UI. The ten initial explanation/reflection blocks cover tense meaning, narrative sequence, collocations, polite requests and reading inference. These are study blocks, not graded Phase 4 exercises.
- `src/content/en/course.ts` is the versioned editorial source. `src/content/course-schema.ts` rejects invalid IDs, order, CEFR sequence, activity payloads/levels and bad or forward-pointing prerequisites. `seedEnglishCourse` publishes it transactionally with stable IDs and upserts, without modifying auth, profile or progress rows. Existing non-English language reference rows receive native-name metadata but remain inactive.
- `/course` reads persisted catalog/progress and shows level, unit, lesson, current position, recommended lesson and locked/unlocked/completed states. `/course/lesson/[lessonId]` renders persisted blocks, saves position and completion, and offers read-only review after completion. The dashboard now reports actual completed lessons instead of claiming zero sessions.
- Every lesson action calls `requireOwner`, validates route/position input and checks the selected active course. The repository checks prerequisites again on the server; a direct mutation cannot advance locked content. An expected-position comparison prevents skipped or replayed blocks. Progress is keyed by user and lesson, tagged with content version; starting a revised version resets that lesson's current progress rather than treating obsolete completion as current. There is no proficiency, score, streak or exam claim.

## Database and validation

- Migration `0003_daffy_giant_girl.sql` adds catalog/progress tables and additive language/course metadata columns. It passed PGlite before applying to Neon. `db:generate` reports no pending schema changes; repeat `db:migrate` succeeds. Repeating `db:seed` leaves the catalog counts unchanged, and `db:verify` reports 1 English course, 6 levels, 3 units, 5 lessons, 10 blocks, 4 prerequisite links and 1 existing profile. No real owner progress was created by tests.
- Local checks passed: lint, typecheck, Prettier, 26 Vitest tests across 5 suites (including migration, seed, ordering, unlock, persistence, user isolation and content-version restart), production build, Neon connection/migration/seed verification and npm audit (0 vulnerabilities).
- Playwright passed 11 tests against the production build. The authenticated course test creates a temporary verified test user, linked GitHub account and signed PostgreSQL session using a process-only test owner ID. It submits the start action from an anonymous browser and confirms denial, completes the first lesson with the signed session, checks refresh persistence and the next unlock, verifies locked routes, then deletes the fixture user (including its session/progress through FK cascades). The pre-existing owner account/profile is not used or changed. Phase 2 separately validated the real GitHub OAuth callback with the owner's account.
- Real browser captures of the course map and lesson were inspected at desktop, 390 px and 320 px in light/dark themes. Axe WCAG 2/2.1 A/AA checks, keyboard focus, no page errors and no horizontal overflow passed. A low-contrast locked-row style was found and corrected during this validation.

## Next session

Keep work on a new feature branch. Do not start Phase 4 as part of this handoff. For further content, increment `contentVersion` when lesson semantics change, validate the catalog, generate/review a migration only if the schema changes, and rerun the seed. Do not delete content/progress rows casually; the current seed intentionally does not prune removed IDs. The owner can sign in and start the B1 bridge at `/course`. `.env.local` stays ignored and must never be committed.
