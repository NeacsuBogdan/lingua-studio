# Implementation roadmap

Current state: **Phases 0–3 merged into main; Phase 4 under validation** on `feat/phase-4-exercise-engine`. Phase 5 has not started.

| Phase | Scope                           | Status      |
| ----- | ------------------------------- | ----------- |
| 0     | DISCOVERY AND ARCHITECTURE      | Completed   |
| 1     | PROJECT FOUNDATION              | Completed   |
| 2     | AUTHENTICATION AND PROFILE      | Completed   |
| 3     | CONTENT AND COURSE ENGINE       | Completed   |
| 4     | EXERCISE ENGINE                 | In progress |
| 5     | VOCABULARY SYSTEM               | Planned     |
| 6     | SPACED REPETITION               | Planned     |
| 7     | MISTAKE ENGINE                  | Planned     |
| 8     | DAILY LEARNING                  | Planned     |
| 9     | PLACEMENT TEST                  | Planned     |
| 10    | DASHBOARD AND ANALYTICS         | Planned     |
| 11    | GAMIFICATION                    | Planned     |
| 12    | READING                         | Planned     |
| 13    | LISTENING                       | Planned     |
| 14    | PRONUNCIATION AND SPEAKING      | Planned     |
| 15    | WRITING                         | Planned     |
| 16    | CAMBRIDGE PREPARATION           | Planned     |
| 17    | MOCK EXAMS                      | Planned     |
| 18    | CURRICULUM EXPANSION            | Planned     |
| 19    | ADVANCED ADAPTIVE LEARNING      | Planned     |
| 20    | OPTIONAL AI ARCHITECTURE        | Planned     |
| 21    | MULTI-LANGUAGE FOUNDATION       | Planned     |
| 22    | JAPANESE-SPECIFIC ENGINE        | Planned     |
| 23    | POLISH AND PRODUCTION READINESS | Planned     |
| 24    | DEPLOYMENT                      | Planned     |

## Phase 1 acceptance

- [x] Next.js, strict TypeScript, Tailwind, shared UI and responsive shell
- [x] Light/dark appearance, loading/error/404 states
- [x] Environment validation and server-only database adapter
- [x] PostgreSQL schema, generated migration, reference-data seed
- [x] Tests and quality command setup
- [x] External PostgreSQL connection verified against Neon with certificate and hostname validation
- [x] Final validation results recorded in HANDOFF.md
- [x] Browser E2E, theme interaction/persistence and mobile visual QA confirmed locally (8 E2E tests and inspected screenshots)
- [x] Dependency audit reviewed and targeted fix applied (0 findings)
- [x] Production build rechecked after valid Neon configuration
- [x] Initial migration and reference seed applied and safely repeated on Neon development database

## Phase 2 acceptance

- [x] Better Auth and GitHub OAuth wired to a PostgreSQL-backed session store
- [x] Owner allowlist uses the stable numeric GitHub ID and a verified provider email
- [x] App routes and profile writes require a server-validated owner session
- [x] Login, logout and setup/error/loading states implemented without an auth bypass
- [x] Learner profile fields persist in PostgreSQL with Zod validation
- [x] Auth schema migrations `0001` and `0002` generated, reviewed and applied to Neon development
- [x] Local lint, typecheck, unit/integration tests, E2E and production build pass
- [x] Live owner GitHub OAuth callback, session reload/restart and logout verified in a browser
- [x] Expired signed sessions rejected by a Better Auth + PGlite integration test
- [x] Authenticated profile edit, immediate display and reload verified against Neon using the owner's account
- [x] Live owner-ID mismatch denied the existing session without deleting it; restoring the ID restored access
- [x] Post-logout protected routes redirected to sign-in and Neon had zero active owner sessions

## Phase 3 acceptance

- [x] Language/course/CEFR/unit/lesson/activity/prerequisite/progress model persists in PostgreSQL
- [x] English A1–C2 level metadata and a small B1/B2 course slice are validated and seeded
- [x] Content definition and owner-specific progress remain separate; seed is repeatable
- [x] Course map and lesson route render actual catalog and progress, including clear empty/locked states
- [x] Server-side owner authorization, prerequisite checks and expected-position updates protect progress mutations
- [x] Lesson position/completion persists across refresh; completing the first unlocks the next
- [x] PGlite migration/seed/domain tests and authenticated production-browser flow pass
- [x] Neon development migration/seed verified without losing the existing profile
- [x] Lint, typecheck, formatting, tests, E2E, build, migration check and dependency audit pass
- [x] Desktop/mobile/320 px, light/dark, keyboard, accessibility, console and overflow checks pass

Phase 3 acceptance was complete before merge. Its study/reflection blocks recorded traversal; Phase 4 adds graded practice separately from completion.

Historical Phase 3 runtime check (2026-09-25): a fresh direct HTTP development session used `ws://` HMR, hydrated the sign-in button and reached GitHub authorization through a successful Better Auth POST. Production E2E covers the click-to-GitHub handoff and confirms no HMR socket. The earlier `wss://` state could not be reproduced after restarting development. Current live login validation is tracked under Phase 4 below.

## Phase 4 acceptance

- [x] Schema-driven mixed study/exercise flow supports all seven initial exercise types
- [x] Strict concrete payloads and discriminated answer validation reject malformed definitions/submissions
- [x] Deterministic server evaluators and explicit NFC/whitespace/case/punctuation policy
- [x] Pre-submit presentation excludes hidden answers, explanations and option feedback
- [x] Immutable attempt schema, feedback snapshots, retry records and transport replay deduplication
- [x] Owner-derived identity, current activity/version, active course and prerequisite checks
- [x] Exercise traversal requires a saved attempt; correctness remains separate from completion
- [x] Intentional version-2 English lessons and idempotent ordering-safe seed
- [x] PGlite migration, preservation, evaluator and security-boundary tests
- [x] Migration/seed applied and safely repeated in Neon; existing owner data preserved
- [x] Authenticated production E2E exercise journey, Axe and responsive/keyboard checks on isolated PostgreSQL 17
- [x] Final lint, typecheck, format, 66 tests, clean migration generation, build and audit
- [ ] Real owner GitHub login and manual exercise/retry/completion/persistence UX validation
- [x] GitHub Actions CI passed on the implementation revision; require green CI on every later revision

Phase 4 is not complete. [Draft PR #3](https://github.com/NeacsuBogdan/lingua-studio/pull/3) targets main; the manual/live owner gate remains open. Phase 5 has not started.
