# Brainstorm Report — Everfit Workout Logging API

Date: 2026-07-02 | Mode: markdown only (no --html/--wiki)
Source: `~/Desktop/Everfit_Test for Backend Engineer.pdf` + user clarification

## Problem Statement

Home test: build Workout Logging API for coaches tracking client metrics.
**Scope decision (user-confirmed): features #4 (progress chart) and #5 (insights) are SKIPPED.**
Remaining: F1 log workout, F2 history, F3 personal records + all edge cases, extensibility, production readiness, AI workflow evidence.

## Requirements (final)

- **F1 Log workout**: userId, date, exerciseName, sets[{reps, weight, unit}]. Units kg/lb, normalize to kg alongside original. Bulk: multiple exercises per request.
- **F2 History**: filter by exercise name (partial match), date range, muscle group; return in requested unit; cursor pagination.
- **F3 PRs**: per user+exercise → heaviest set, highest volume set (reps×weight), best est. 1RM (Epley: weight × (1 + reps/30)); include date achieved; compare across two time ranges.
- **Edge cases**: invalid units, malformed fields (null date, negative weight/reps, empty sets), empty date range → 200 + empty + message, timezone strategy documented, concurrent writes, 50k+ entries/user perf.
- **Extensibility**: new unit (stone) = minimal change; muscle-group mapping configurable not hardcoded. (Insights plugin requirement dropped with #5.)
- **Deliverables**: clean iterative git history, README (architecture diagram, setup via docker compose, API docs, schema decisions, scale trade-offs), AI_WORKFLOW.md, video (user handles), time estimate before starting.

## Decisions (user-approved)

| Decision | Choice | Rationale |
|---|---|---|
| Stack | NestJS + PostgreSQL | User choice; PG wins for heavy aggregations (MAX on computed cols), relational sets, indexing story |
| ORM | TypeORM | Generated columns declarable in entities/migrations; flexible query builder for keyset pagination + EXPLAIN; NestJS-default familiarity. Prisma rejected: generated cols need raw SQL escape hatch |
| Concurrent writes | Independent events + transaction only (REVISED 2026-07-02: user dropped idempotency key) | Append-only logging — no read-modify-write, no lost updates; 2 identical logs = legitimate gym data. Idempotency key rejected as over-engineering; noted as future extension. Rationale MUST appear in README + video |
| Seed data | 2 tiers | User A ~30 readable entries (multi-unit, 1-data-point exercise, 2-month spread for PR compare); User B 50k+ generated entries for perf proof |
| Pagination | Keyset (cursor) | Required for 50k+; offset degrades linearly |
| Timezone | `workout_date` DATE (client-decided) + `logged_at` TIMESTAMPTZ UTC | Separates business date from audit time; documented trade-off in README |

## Architecture

```
src/
  common/        # exception filter, response envelope, pagination helpers, logging
  units/         # UnitConverterRegistry (kg, lb; new unit = 1 registry entry)
  exercises/     # entity + muscle-group mapping seeded from config JSON
  workouts/      # POST /workouts (bulk), GET /workouts (history)
  records/       # GET /users/:userId/records (+ time-range compare)
  database/      # migrations, seeds
```

### Schema

```
exercises: id PK, name UNIQUE, muscle_group, created_at
  -- seeded from config file; mapping configurable

workout_entries:
  id uuid PK, user_id, exercise_id FK, workout_date DATE,
  logged_at TIMESTAMPTZ, idempotency_key (nullable, UNIQUE per user), created_at
  INDEX (user_id, exercise_id, workout_date DESC)   -- history+PR
  INDEX (user_id, workout_date DESC, id)            -- keyset pagination

sets:
  id PK, entry_id FK CASCADE, position,
  reps INT CHECK > 0, weight_original NUMERIC CHECK >= 0, unit_original,
  weight_kg NUMERIC,                        -- normalized on insert
  volume_kg GENERATED (reps * weight_kg),
  est_1rm_kg GENERATED (weight_kg * (1 + reps/30.0))
  INDEX (entry_id)
```

Key choice: precomputed/generated columns make PR queries plain indexed MAX() — fast at 50k+ without runtime math.

### API

| Method | Path | Notes |
|---|---|---|
| POST | `/workouts` | Bulk, transactional, optional idempotency key |
| GET | `/workouts` | `userId, exercise (ILIKE), from, to, muscleGroup, unit, cursor, limit` |
| GET | `/users/:userId/records` | `exercise` required, `from/to`, `compareFrom/compareTo` |

Error envelope via global exception filter: `{ error: { code, message, details } }`. Empty range → 200 + empty data + message. Comparison range without data → null PRs + explicit message (not error).

## Evaluated Alternatives

- **Prisma** — better DX/type-safety; rejected: generated columns unsupported in schema, needs raw migrations.
- **JSONB sets inside entries** — fewer joins; rejected: PR is a per-set aggregation problem, relational sets index/aggregate directly.
- **Unique constraint for concurrency** — rejected: blocks legitimate identical sets logged same second.
- **Offset pagination** — rejected at 50k+ scale requirement.

## Commit Plan (~17 small conventional commits)

1. chore: scaffold nestjs project with config and linting
2. chore: add docker compose with postgres and app service
3. feat: add database schema and initial migration
4. feat: add unit conversion registry (kg, lb)
5. feat: add exercise catalog with configurable muscle-group mapping + seed
6. feat: add workout logging endpoint with bulk support and validation
7. feat: add global exception filter and structured error responses
8. feat: add workout history with filters and cursor pagination
9. feat: add unit conversion on history responses
10. feat: add personal records endpoint (max weight, volume, 1rm)
11. feat: add PR comparison across time ranges
12. test: unit tests for conversion and PR calculations
13. test: integration tests for endpoints and edge cases
14. feat: add seed script (demo user + 50k perf user)
15. feat: structured logging and health check
16. docs: README with architecture, API docs, schema decisions
17. docs: AI_WORKFLOW.md

Tests interleaved, not dumped at end. Organic fix:/refactor: commits welcome — they evidence "reviewed and refined AI-generated code".

## Risks & Considerations

- **Extensibility scoring now concentrated** in unit registry + muscle-group config (insights plugin gone) — both must be clean.
- 50k seed insert must use batched inserts (not row-by-row) or seed takes minutes.
- `git init` must happen at commit 1 — evaluators review log.
- AI_WORKFLOW.md needs real captured examples (≥2 wrong AI outputs corrected, ≥1 rejected suggestion) — collect during implementation, not retrofitted.

## Success Criteria

- `docker compose up` → migrated, seeded, healthy API.
- All 3 endpoints handle listed edge cases with structured errors.
- History/PR queries on 50k user demonstrably indexed (EXPLAIN or timing).
- Unit tests: conversion round-trips, Epley, PR selection. Integration: endpoints + edge cases.
- Git log shows small iterative commits.

## Next Steps

- `/ck:plan` with this report as context.
- User to provide time estimate before starting (deliverable #5).

## Unresolved Questions

- None blocking. Video walkthrough + time estimate are user-side deliverables.
