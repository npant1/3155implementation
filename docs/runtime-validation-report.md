# Runtime Validation Report

**Generated**: 2026-11-17
**Target**: `3155implementation`

## Summary

| Check | Status | Exit Code | Details |
|---|---|---:|---|
| Prisma client generation | PASS | 0 | Generated Prisma Client 7.10.1 without a database connection. |
| Prisma schema validation | PASS | 0 | `prisma validate` accepted the PostgreSQL data model. |
| TypeScript and production build | PASS | 0 | `npm run build` type-checked the React app and persistence layer, then built the Vite client. |
| Automated unit tests | PASS | 0 | `npm test`: 5 passed. |
| PostgreSQL integration test | UNVERIFIED | 0 | One suite skipped because `TEST_DATABASE_URL` was not set. Docker is installed, but its daemon was unavailable. |
| API/browser E2E | DEFERRED | n/a | No application API or student UI was exposed without an approved authentication boundary. |
| Lint | NOT CONFIGURED | n/a | The project has no lint script or configured linter. |

**Overall**: PARTIAL — schema, persistence boundary, unit tests, and client build pass; live PostgreSQL behavior and the student-facing application flow remain unverified/deferred.

## Environment

- Node.js: 24.22.1
- Docker CLI: 28.3.2 installed
- Docker daemon: unavailable (`docker info` could not connect to the Docker Desktop Linux engine pipe)
- Database: no local PostgreSQL server detected
- Production database: not configured, contacted, or modified

## Test evidence and remaining gaps

- Unit tests cover successful application creation through the service boundary, invalid UUID input, missing student profile, closed opportunity, and propagation of repository/database errors.
- The PostgreSQL integration test is opt-in via `TEST_DATABASE_URL`. It writes an application, reads it back, checks duplicate rejection, and cleans up UUID-isolated records.
- No migration was applied to a live database. Start the local Compose database and apply migrations before running the PostgreSQL integration test.
- Authentication was not selected after clarification was requested. Do not expose the application service to browser requests until the caller derives the student ID from a trusted server-side identity.
- The project has no lint command. No UI/E2E test was added because the persistent application UI/API remains deferred.

## Dependency audit note

`npm audit --omit=dev` reports 0 vulnerabilities. The full audit reports 5 high findings in the Vite/Vitest development-tool dependency graph, including CVE-2026-112366 in `picomatch@4.0.7`. The available npm force-fix would downgrade Vite to 6.2.7, a breaking major-version change from the repository's Vite 7 line; that downgrade was not applied. Revisit when an in-range patched dependency is available or approve the tooling migration.
