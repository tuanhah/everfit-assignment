---
phase: 4
title: Workout Logging Endpoint
status: completed
effort: 3h
priority: P1
dependencies:
  - 3
---

# Phase 4: Workout Logging Endpoint

## Overview

`POST /workouts` — bulk log (multiple exercises/entry per request), transactional, normalized kg storage. Plus global exception filter + error envelope (cross-cutting, born here because this is the first real endpoint).

Concurrency stance (user decision): NO idempotency key. Logging is append-only — each request is an independent valid event (2 identical sets same day = legitimate data); atomicity via transaction. Rationale goes in README + video.

## Requirements

- Functional: request = `{ userId, date, entries: [{ exerciseName, sets: [{ reps, weight, unit }] }] }`; all-or-nothing insert; response 201 with created entries incl. normalized values.
- Non-functional: bulk insert is a single transaction — partial failure rolls back everything; concurrent requests never corrupt or block each other (plain inserts, no locks needed).

## Architecture

**DTO validation (class-validator, whitelist+forbidNonWhitelisted):**
- `userId` non-empty string; `date` ISO date (reject null/malformed/future beyond today+1); `entries` non-empty array; per-entry `sets` non-empty array; `reps` int > 0; `weight` ≥ 0; `unit` via registry validator.
- Violations → 400 with per-field details in envelope.

**Error envelope (global exception filter in `common/`):**
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [{ "field": "entries.0.sets.1.weight", "message": "must be >= 0" }] } }
```
Codes: `VALIDATION_ERROR` 400, `UNSUPPORTED_UNIT` 400, `NOT_FOUND` 404, `INTERNAL` 500. Non-HTTP exceptions → 500 with generic message (no stack leak).

**Service flow (single transaction):**
1. Resolve/auto-create exercises via `ExercisesService` (Phase 3).
2. Generate entry ids app-side (`uuidv7()` from `uuid` package) → insert `workout_entries` + `sets` (weight_kg computed via registry) batched in one round-trip; bulk insert sets in one statement.
3. Any failure mid-bulk → full rollback (all-or-nothing).

## Related Code Files

- Create: `src/workouts/workouts.module.ts`, `src/workouts/workouts.controller.ts`, `src/workouts/workouts.service.ts`, `src/workouts/dto/log-workout.dto.ts`, `src/common/filters/global-exception.filter.ts`, `src/common/errors/app-errors.ts`
- Modify: `src/app.module.ts`, `src/main.ts` (ValidationPipe global config)

## Implementation Steps

1. Global exception filter + error codes + ValidationPipe (transform, whitelist).
2. DTOs with nested validation.
3. Service transaction flow above.
4. Controller returns 201 with created entries.
5. Manual smoke: bulk 2 exercises × 3 sets; malformed payloads; concurrent duplicate submits (both succeed as independent events — expected behavior).

**Commits:**
- `feat: add global exception filter and structured error responses`
- `feat: add workout logging endpoint with bulk support and validation`

## Success Criteria

- [ ] Bulk log 2+ exercises in 1 request → all rows in 1 transaction
- [ ] Empty sets array / negative weight / null date / bad unit → 400 with field-level details
- [ ] Mid-bulk failure rolls back everything (no partial writes)
- [ ] Concurrent identical requests both succeed independently, no corruption/deadlock

## Risk Assessment

- "Concurrent writes" PDF edge case answered by design, not mechanism: append-only inserts can't conflict — no read-modify-write, no lost updates. MUST document in README + video, else looks like an overlooked edge case. Note idempotency key as the future extension if client-retry dedup is ever required.
