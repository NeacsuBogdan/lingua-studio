# Implementation roadmap

Current phase: **1 — foundation**. Finish the real PostgreSQL connection check before Phase 2.

| Phase | Scope                           | Status                                        |
| ----- | ------------------------------- | --------------------------------------------- |
| 0     | DISCOVERY AND ARCHITECTURE      | Completed                                     |
| 1     | PROJECT FOUNDATION              | Implemented; external DB verification pending |
| 2     | AUTHENTICATION AND PROFILE      | Planned                                       |
| 3     | CONTENT AND COURSE ENGINE       | Planned                                       |
| 4     | EXERCISE ENGINE                 | Planned                                       |
| 5     | VOCABULARY SYSTEM               | Planned                                       |
| 6     | SPACED REPETITION               | Planned                                       |
| 7     | MISTAKE ENGINE                  | Planned                                       |
| 8     | DAILY LEARNING                  | Planned                                       |
| 9     | PLACEMENT TEST                  | Planned                                       |
| 10    | DASHBOARD AND ANALYTICS         | Planned                                       |
| 11    | GAMIFICATION                    | Planned                                       |
| 12    | READING                         | Planned                                       |
| 13    | LISTENING                       | Planned                                       |
| 14    | PRONUNCIATION AND SPEAKING      | Planned                                       |
| 15    | WRITING                         | Planned                                       |
| 16    | CAMBRIDGE PREPARATION           | Planned                                       |
| 17    | MOCK EXAMS                      | Planned                                       |
| 18    | CURRICULUM EXPANSION            | Planned                                       |
| 19    | ADVANCED ADAPTIVE LEARNING      | Planned                                       |
| 20    | OPTIONAL AI ARCHITECTURE        | Planned                                       |
| 21    | MULTI-LANGUAGE FOUNDATION       | Planned                                       |
| 22    | JAPANESE-SPECIFIC ENGINE        | Planned                                       |
| 23    | POLISH AND PRODUCTION READINESS | Planned                                       |
| 24    | DEPLOYMENT                      | Planned                                       |

## Phase 1 acceptance

- [x] Next.js, strict TypeScript, Tailwind, shared UI and responsive shell
- [x] Light/dark appearance, loading/error/404 states
- [x] Environment validation and server-only database adapter
- [x] PostgreSQL schema, generated migration, reference-data seed
- [x] Tests and quality command setup
- [ ] External PostgreSQL TCP/TLS connection verified (needs DATABASE_URL)
- [x] Final validation results recorded in HANDOFF.md
- [ ] Browser E2E, theme interaction/persistence and mobile visual QA confirmed
