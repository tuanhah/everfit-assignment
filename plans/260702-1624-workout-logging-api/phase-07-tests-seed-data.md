---
phase: 7
title: Tests & Seed Data
status: completed
effort: 4h
priority: P1
dependencies:
  - 6
---

# Phase 7: Tests & Seed Data

## Overview

Consolidate test coverage (unit tests already interleaved in phases 3-6 stay there; this phase adds integration/e2e + edge-case matrix) and 2-tier seed data (readable demo user + 50k perf user).

## Requirements

- Functional: integration tests hit real Postgres (compose/testcontainer); seed runnable via npm script and auto on compose up.
- Non-functional: 50k seed inserts complete < ~30s (batched); test design > coverage % (per grading rubric).

## Architecture

**Test layers:**
- Unit (already written per-phase, verify complete): conversion round-trips, Epley formula, cursor encode/decode, payload hash stability. Add: PR selection logic against in-memory fixtures if any pure logic extracted.
- Integration (supertest against app + real PG, per-test-suite truncate):
  - POST /workouts: bulk happy path; each malformed-field case (null date, negative weight/reps, empty sets, bad unit) → 400 shape; concurrent identical submits (Promise.all ×2) → both 201, both persisted, no error.
  - GET /workouts: filter combos; pagination walk (no dupes/skips across 3 pages with same-date entries); unit=lb conversion; empty range → 200+message; invalid cursor → 400.
  - GET records: known-PR verification; compare with/without data; 404 unknown exercise; 1-data-point exercise.
- Perf smoke (can live in integration suite, tagged): history page + PR query on 50k user < 200ms; optional EXPLAIN assert contains 'Index'.

**Seed data (`src/database/seeds/`):**
- User A `demo-user`: ~30 entries over 2 months (May + June 2026), 5-6 exercises across muscle groups, mixed kg/lb, one exercise with exactly 1 entry (single-data-point case), planned PR progression so "PR this month vs last month" shows meaningful deltas (hand-computed expected values reused by integration tests).
- User B `perf-user`: 50k+ entries generated (~10 exercises, 2-4 sets each, spread over 3 years), inserted via batched multi-row INSERTs (1k rows/statement).
- Idempotent: seeds check marker (e.g., existing demo-user rows) → skip. Compose runs `migration → seed → start`.

## Related Code Files

- Create: `test/workouts-logging.e2e-spec.ts`, `test/workouts-history.e2e-spec.ts`, `test/records.e2e-spec.ts`, `test/perf-smoke.e2e-spec.ts`, `src/database/seeds/seed-demo-user.ts`, `src/database/seeds/seed-perf-user.ts`, `src/database/seeds/run-seeds.ts`, `test/utils/db-reset.ts`
- Modify: `package.json` (test:e2e, seed scripts), `docker-compose.yml` (seed on start)

## Implementation Steps

1. e2e harness: app bootstrap + PG connection + truncate util (seed users preserved or tests use isolated user ids — prefer isolated ids, no truncate dependency on seeds).
2. Write integration suites per endpoint (edge-case matrix above).
3. Demo-user seed with hand-computed PR fixture doc (comment block: expected maxWeight/volume/1RM per month).
4. Perf-user generator with batched inserts.
5. Perf smoke test against seeded perf-user.
6. Wire seed into compose entrypoint (idempotent guard).

**Commits:**
- `test: add integration tests for logging, history and records endpoints`
- `feat: add seed data with demo user and 50k-entry perf user`
- `test: add performance smoke test against 50k dataset`

## Success Criteria

- [ ] All integration tests green against compose PG
- [ ] Edge-case matrix from PDF fully covered (each bullet → ≥1 test)
- [ ] `docker compose up` on fresh volume → seeded, demo-user PR values match fixtures
- [ ] 50k seed < ~30s; history/PR on perf-user < 200ms in smoke test

## Risk Assessment

- Tests sharing DB with seeds → integration tests use their own userIds (`test-user-*`), never assert on global counts.
- CI-less repo: tests run locally/compose only — document commands in README.
- 50k insert slowness → batched multi-row inserts, disable per-row hooks (raw query builder insert).
