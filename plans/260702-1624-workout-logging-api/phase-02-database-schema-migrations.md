---
phase: 2
title: Database Schema & Migrations
status: completed
effort: 2h
priority: P1
dependencies:
  - 1
---

# Phase 2: Database Schema & Migrations

## Overview

TypeORM setup + initial migration for 3 tables (`exercises`, `workout_entries`, `sets`) with generated columns and composite indexes. This schema is the core grading artifact ("schema design, indexing strategy").

## Requirements

- Functional: versioned migrations run automatically on app start (or compose entrypoint).
- Non-functional: PR/history queries indexable at 50k+ entries/user; CHECK constraints enforce data sanity at DB layer.

## Architecture

```sql
exercises
  id          SERIAL PK
  name        TEXT UNIQUE NOT NULL          -- canonical name, case-insensitive lookup via LOWER index
  muscle_group TEXT NOT NULL
  created_at  TIMESTAMPTZ DEFAULT now()
  INDEX: UNIQUE LOWER(name)

workout_entries
  id              UUID PK                    -- UUIDv7, app-generated (uuid npm pkg); no DB default
  user_id         TEXT NOT NULL              -- no auth; opaque param per PDF
  exercise_id     INT NOT NULL FK → exercises
  workout_date    DATE NOT NULL              -- business date, client-decided
  logged_at       TIMESTAMPTZ NOT NULL DEFAULT now()  -- audit, UTC
  created_at      TIMESTAMPTZ DEFAULT now()
  INDEX (user_id, exercise_id, workout_date DESC)   -- PR + per-exercise history
  INDEX (user_id, workout_date DESC, id DESC)       -- keyset pagination

sets
  id              BIGSERIAL PK
  entry_id        UUID NOT NULL FK → workout_entries ON DELETE CASCADE
  position        INT NOT NULL               -- set order within entry
  reps            INT NOT NULL CHECK (reps > 0)
  weight_original NUMERIC(8,3) NOT NULL CHECK (weight_original >= 0)
  unit_original   TEXT NOT NULL              -- 'kg' | 'lb'; validated at app layer (registry), not DB enum → new unit = no migration
  weight_kg       NUMERIC(8,3) NOT NULL      -- computed at insert by app (conversion factor lives in registry, not DB)
  volume_kg       NUMERIC(12,3) GENERATED ALWAYS AS (reps * weight_kg) STORED
  est_1rm_kg      NUMERIC(12,3) GENERATED ALWAYS AS (weight_kg * (1 + reps / 30.0)) STORED
  INDEX (entry_id)
```

**Key rationale (document in README later):**
- `workout_entries.id` = **UUIDv7** (user decision 2026-07-02, index optimization): time-ordered → sequential B-tree inserts (no random page splits, better cache locality vs v4), still unguessable (74 random bits). App-generated via `uuid` package `uuidv7()` — id known before insert → entries + sets batch in 1 round-trip; no PG18 dependency. Trade-off: id embeds creation timestamp — acceptable, workout time is public API data anyway. Side benefit: cursor tiebreak `(workout_date, id)` becomes chronological within same day.
- `unit_original` TEXT not enum → adding `stone` requires zero migration (extensibility criterion).
- `weight_kg` app-computed (registry owns factors); `volume_kg`/`est_1rm_kg` DB-generated (pure math on stored cols) → PR = indexed MAX, no runtime compute.
- Concurrency (user decision, no idempotency key): logging is append-only — no read-modify-write, so no lost updates possible; each request is an independent valid event (2 identical sets same day = legitimate gym data). Atomicity via transaction only. Document this rationale in README + video; note idempotency key as future extension for client-retry dedup.

## Related Code Files

- Create: `src/database/data-source.ts`, `src/database/migrations/<ts>-initial-schema.ts`, entity files `src/exercises/exercise.entity.ts`, `src/workouts/workout-entry.entity.ts`, `src/workouts/set.entity.ts`
- Modify: `src/app.module.ts` (TypeOrmModule.forRootAsync), `docker-compose.yml`/`Dockerfile` entrypoint (run migrations before start), `package.json` (migration scripts)

## Implementation Steps

1. Install `typeorm`, `@nestjs/typeorm`, `pg`. Configure `TypeOrmModule.forRootAsync` from config (never `synchronize: true`).
2. Write entities matching schema above; generated columns via `@Column({ generatedType: 'STORED', asExpression: '...' })`.
3. Write single initial migration (hand-tuned SQL for indexes/CHECKs).
4. Add `migration:run`/`migration:generate` npm scripts; wire migration run into container entrypoint.
5. Verify: fresh `docker compose up` creates schema; `\d sets` shows generated columns + indexes.

**Commit:** `feat: add database schema and initial migration`

## Success Criteria

- [ ] Fresh compose boot runs migration automatically
- [ ] Generated columns compute correctly (manual INSERT spot-check)
- [ ] Both composite indexes present and used (EXPLAIN spot-check)
- [ ] CHECK constraints reject reps<=0, weight<0 at DB level

## Risk Assessment

- TypeORM generated-column support quirks (esp. in entity sync vs migration) → migration SQL is source of truth; entities annotated read-only for those cols (`insert: false, update: false`).
- NUMERIC precision: 8,3 caps at 99999.999 kg — plenty for real weights.
