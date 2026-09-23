# Implementation roadmap

Current phase: **2 — authentication and learner profile**. Phase 1 passed local and Neon development validation.

| Phase | Scope                           | Status                                                  |
| ----- | ------------------------------- | ------------------------------------------------------- |
| 0     | DISCOVERY AND ARCHITECTURE      | Completed                                               |
| 1     | PROJECT FOUNDATION              | Completed                                               |
| 2     | AUTHENTICATION AND PROFILE      | In progress                                             |
| 3     | CONTENT AND COURSE ENGINE       | Planned                                                 |
| 4     | EXERCISE ENGINE                 | Planned                                                 |
| 5     | VOCABULARY SYSTEM               | Planned                                                 |
| 6     | SPACED REPETITION               | Planned                                                 |
| 7     | MISTAKE ENGINE                  | Planned                                                 |
| 8     | DAILY LEARNING                  | Planned                                                 |
| 9     | PLACEMENT TEST                  | Planned                                                 |
| 10    | DASHBOARD AND ANALYTICS         | Planned                                                 |
| 11    | GAMIFICATION                    | Planned                                                 |
| 12    | READING                         | Planned                                                 |
| 13    | LISTENING                       | Planned                                                 |
| 14    | PRONUNCIATION AND SPEAKING      | Planned                                                 |
| 15    | WRITING                         | Planned                                                 |
| 16    | CAMBRIDGE PREPARATION           | Planned                                                 |
| 17    | MOCK EXAMS                      | Planned                                                 |
| 18    | CURRICULUM EXPANSION            | Planned                                                 |
| 19    | ADVANCED ADAPTIVE LEARNING      | Planned                                                 |
| 20    | OPTIONAL AI ARCHITECTURE        | Planned                                                 |
| 21    | MULTI-LANGUAGE FOUNDATION       | Planned                                                 |
| 22    | JAPANESE-SPECIFIC ENGINE        | Planned                                                 |
| 23    | POLISH AND PRODUCTION READINESS | Planned                                                 |
| 24    | DEPLOYMENT                      | Planned                                                 |

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
