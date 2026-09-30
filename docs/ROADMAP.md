# Implementation roadmap

Current state: **Phases 0-6 complete on main** at `a5438be55e04c49af47701d6b5474aa51de03853`. PR #5 passed CI and real-owner validation, was marked ready and squash-merged. Phase 7 implementation is authorized on `feat/phase-7-mistake-engine`; local validation precedes the explicit Neon gate.

| Phase | Scope                           | Status      |
| ----- | ------------------------------- | ----------- |
| 0     | DISCOVERY AND ARCHITECTURE      | Completed   |
| 1     | PROJECT FOUNDATION              | Completed   |
| 2     | AUTHENTICATION AND PROFILE      | Completed   |
| 3     | CONTENT AND COURSE ENGINE       | Completed   |
| 4     | EXERCISE ENGINE                 | Completed   |
| 5     | VOCABULARY SYSTEM               | Completed   |
| 6     | SPACED REPETITION               | Completed   |
| 7     | MISTAKE ENGINE                  | In progress |
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
- [x] Real owner GitHub login and manual exercise/retry/completion/persistence UX validation
- [x] GitHub Actions CI passed on the implementation revision; require green CI on every later revision

Phase 4 passed CI and owner manual validation; [PR #3](https://github.com/NeacsuBogdan/lingua-studio/pull/3) was squash-merged. Sentence-reorder visual polish is deferred and does not block Phase 5. Intermittent development HMR can leave React unhydrated; use a production build for final interaction checks when needed.

## Phase 5 acceptance

- [x] Relational sense catalog, curated definitions/examples/tags/CEFR, families and collocations implemented
- [x] Explicit lesson/activity vocabulary roles without changing lesson version 2
- [x] Transactional introductions and trusted per-attempt practice evidence implemented
- [x] Per-user saved vocabulary and deterministic evidence-derived practice status implemented
- [x] Protected vocabulary browser, detail and lesson introduction UI implemented
- [x] Focused migration/domain/security tests and authenticated E2E pass
- [x] Local PostgreSQL migration/seed repeatability and fixture cleanup pass
- [x] Neon development migration/seed and existing-data preservation verified
- [x] Lint, typecheck, format, 72 tests, 13 E2E, build, migration check and online audit pass
- [x] Real owner manual vocabulary navigation, save/unsave and persistence validation pass
- [x] GitHub CI passed on the implementation revision; require green CI on every later revision

Phase 5 passed CI and real-owner manual validation. [PR #4](https://github.com/NeacsuBogdan/lingua-studio/pull/4) was marked ready and squash-merged into main at `6ecb30b9d7d60fd555531ad7794da995caf74006`.

## Phase 6 acceptance

- [x] Stable `ts-fsrs` version and explicit deterministic scheduler configuration selected
- [x] Additive card/session/item/history migration generated and tested in PGlite/local PostgreSQL
- [x] Introduced and trusted-practised senses become cards; saved-only senses do not
- [x] Explicit idempotent backfill creates New cards without fake reviews
- [x] Bounded due sessions, refresh/resume, reveal/rate, explicit finish and summary implemented
- [x] Server-side Again/Hard/Good/Easy scheduling, immutable history and replay protection implemented
- [x] Review statistics, vocabulary detail status and Overview due count read persisted state
- [x] Owner/language isolation and strict browser input boundaries covered by integration/E2E tests
- [x] Final local lint, typecheck, format, 79 tests, migration generation, PostgreSQL checks, 15 authenticated E2E, build and audit pass
- [x] Neon development pre-inspection, authorized `0006` migration/backfill, repeatability and Phase 0–5 preservation verification
- [x] Push, draft PR and green GitHub CI ([run #10](https://github.com/NeacsuBogdan/lingua-studio/actions/runs/36563220546))
- [x] Real-owner manual Review/session, ratings, refresh/resume and persistence validation

Phase 6 completed and merged in PR #5. Phase 7 is in progress; do not mark it complete before real-owner validation. Phase 8 remains out of scope.

## Phase 7 acceptance

- [x] Explicit validated taxonomy and version-scoped activity mappings; lesson version 2 preserved
- [x] Immutable assessed mistake occurrences and separate corrective attempts
- [x] Idempotent historical backfill with source timestamps and replay protection
- [x] Evidence-derived recurrence, recent ordering, recovery and reactivation
- [x] Authenticated Mistake Center, weakness detail, corrective practice and Review count/link
- [x] Domain and migration preservation tests in PGlite and local PostgreSQL 17
- [x] Local build/lint/typecheck/format, clean migration generation and authenticated production E2E
- [x] Explicitly authorized npm audit: 0 vulnerabilities; no dependency changes
- [x] Authorized Neon development migration, weakness seed, first/repeat backfill and Phase 0–6 preservation checks
- [ ] Authorized push/PR and green CI
- [ ] Real-owner manual validation

No Phase 8 daily queue or cross-system orchestration is included. Repeated means at least two recorded errors; recovered requires a successful corrective attempt strictly after the latest error. Lifetime recurrence remains visible. See ARCHITECTURE.md for the complete evidence semantics.
