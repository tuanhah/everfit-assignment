---
phase: 5
title: Workout History Endpoint
status: completed
effort: 3h
priority: P1
dependencies:
  - 4
---

# Phase 5: Workout History Endpoint

## Overview

`GET /workouts` — filtered history with keyset pagination and response-side unit conversion. Must stay fast at 50k+ entries/user.

## Requirements

- Functional: filters `userId` (required), `exercise` (partial match, ILIKE), `from`/`to` (workout_date range), `muscleGroup`, `unit` (kg|lb response conversion, default kg), `cursor`, `limit` (default 20, max 100).
- Non-functional: query plan uses `(user_id, workout_date DESC, id DESC)` index; no OFFSET.

## Architecture

**Keyset pagination:**
- Order: `workout_date DESC, id DESC` (id tiebreak — DATE granularity has many same-day entries).
- Cursor = base64url of `{ d: workout_date, id }`; opaque to client. Invalid cursor → 400 `INVALID_CURSOR`.
- Response: `{ data: [...], pagination: { nextCursor: string|null, limit } }`.
- Fetch limit+1 rows to detect next page.

**Query (query builder, joins exercises + sets):**
```sql
WHERE user_id = :userId
  AND (:exercise IS NULL OR e.name ILIKE '%' || :exercise || '%')
  AND (:muscleGroup IS NULL OR e.muscle_group = :muscleGroup)
  AND (:from IS NULL OR workout_date >= :from)
  AND (:to IS NULL OR workout_date <= :to)
  AND ((workout_date, we.id) < (:cursorDate, :cursorId))  -- when cursor present
ORDER BY workout_date DESC, we.id DESC
LIMIT :limit + 1
```
Load sets per page of entries (2nd query IN(entry_ids)) — avoids row multiplication breaking LIMIT semantics.

**Unit conversion at serialization:** each set returns `{ reps, weight, unit, originalWeight, originalUnit }` where `weight` = converted `weight_kg → requested unit` (2dp), plus original as logged. Uses `UnitConverterRegistry.fromKg`.

**Empty results:** 200 `{ data: [], pagination: { nextCursor: null }, message: "No workout entries found for the given filters" }` — per PDF, not an error.

## Related Code Files

- Create: `src/workouts/dto/history-query.dto.ts`, `src/common/pagination/cursor.util.ts`, `src/workouts/workout-response.mapper.ts`
- Modify: `src/workouts/workouts.controller.ts`, `src/workouts/workouts.service.ts`

## Implementation Steps

1. Query DTO with validation (date order: from ≤ to else 400).
2. Cursor encode/decode util + `INVALID_CURSOR` error.
3. History query via query builder (two-step: page of entries, then sets IN).
4. Response mapper with unit conversion + original values.
5. EXPLAIN spot-check on dev data: index scan, no seq scan on filtered path.

**Commits:**
- `feat: add workout history with filters and cursor pagination`
- `feat: return history in requested unit with original values`

## Success Criteria

- [ ] All filters compose correctly (exercise partial + date range + muscleGroup)
- [ ] Pagination stable across same-date entries (id tiebreak), no skips/dupes walking pages
- [ ] `unit=lb` converts values, `original*` fields preserved
- [ ] Empty range → 200 + message, not error
- [ ] EXPLAIN shows index usage on user_id + workout_date path

## Risk Assessment

- ILIKE '%x%' can't use btree index → acceptable: filter applies after user_id index narrows to one user's rows; document trigram index as scale option in README.
- Row-tuple comparison `(a,b) < (x,y)` syntax → supported natively in PG; keep raw fragment in query builder.
