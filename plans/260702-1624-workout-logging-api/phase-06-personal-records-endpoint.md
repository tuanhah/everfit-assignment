---
phase: 6
title: Personal Records Endpoint
status: completed
effort: 3h
priority: P1
dependencies:
  - 5
---

# Phase 6: Personal Records Endpoint

## Overview

`GET /users/:userId/records` — three PR types (max weight, max volume, best est. 1RM) with date achieved, optional time-range compare ("this month vs last month"). Core aggregation showcase.

## Requirements

- Functional: `exercise` (required, exact match case-insensitive — 404 `NOT_FOUND` if unknown), `from`/`to` optional range, `compareFrom`/`compareTo` optional second range (must come as a pair), `unit` response conversion.
- Non-functional: single indexed query per range; correct at 50k+ sets.

## Architecture

**One query per range returns all 3 PRs (DISTINCT ON pattern):**
```sql
SELECT * FROM (
  SELECT s.reps, s.weight_original, s.unit_original, s.weight_kg, s.volume_kg, s.est_1rm_kg,
         we.workout_date,
         ROW_NUMBER() OVER (ORDER BY s.weight_kg DESC, we.workout_date ASC) AS rn_weight,
         ROW_NUMBER() OVER (ORDER BY s.volume_kg DESC, we.workout_date ASC) AS rn_volume,
         ROW_NUMBER() OVER (ORDER BY s.est_1rm_kg DESC, we.workout_date ASC) AS rn_1rm
  FROM sets s JOIN workout_entries we ON we.id = s.entry_id
  WHERE we.user_id = :userId AND we.exercise_id = :exerciseId
    AND (:from IS NULL OR we.workout_date >= :from)
    AND (:to IS NULL OR we.workout_date <= :to)
) t WHERE rn_weight = 1 OR rn_volume = 1 OR rn_1rm = 1;
```
Tie-break: earliest date wins (first time PR achieved). Index `(user_id, exercise_id, workout_date DESC)` narrows scan.

**Response:**
```json
{
  "exercise": "Bench Press",
  "unit": "kg",
  "records": {
    "maxWeight": { "value": 120, "reps": 1, "date": "2026-05-14", "set": {...} },
    "maxVolume": { "value": 1080, "reps": 12, "date": "2026-06-01", "set": {...} },
    "best1RM":  { "value": 128.0, "date": "2026-05-14", "formula": "epley" }
  },
  "comparison": {                       // only when compareFrom/To present
    "range": { "from": "...", "to": "..." },
    "records": { ... } | null,
    "message": "No data in comparison range"  // when null — graceful, not error
  },
  "delta": { "maxWeightKg": +5.0, "maxVolumeKg": -20.0, "best1RMKg": +3.2 }  // when both ranges have data
}
```

**Edge cases:** no data in primary range → 200, `records: null`, message. Exercise with 1 set → PRs valid (all 3 same set), no special casing needed; comparison with missing side → delta null + message.

**Epley note:** DB generated col is authoritative for querying; a pure TS `epley1RM(weightKg, reps)` util exists for unit tests + response recompute verification. reps=1 → 1RM = weight × (1+1/30); document that formula applies to all rep counts (standard behavior).

## Related Code Files

- Create: `src/records/records.module.ts`, `src/records/records.controller.ts`, `src/records/records.service.ts`, `src/records/dto/records-query.dto.ts`, `src/records/formulas.ts` (epley util)
- Modify: `src/app.module.ts`

## Implementation Steps

1. DTO: exercise required; compareFrom/compareTo pair validation; range order checks.
2. Raw query (above) via dataSource.query with params; map to response.
3. Compare mode: run same query twice (primary + comparison), compute deltas in kg.
4. Unit conversion at serialization via registry.
5. Manual verify against seed data with known PRs.

**Commits:**
- `feat: add personal records endpoint with max weight, volume and 1rm`
- `feat: support PR comparison across time ranges`

## Success Criteria

- [ ] 3 PR types correct with date achieved (verified against hand-computed seed values)
- [ ] Earliest-date tie-break verified
- [ ] Compare mode returns deltas; empty comparison side → message not error
- [ ] Unknown exercise → 404; no data in range → 200 + null + message
- [ ] Query uses (user_id, exercise_id) index at 50k scale

## Risk Assessment

- 3 window functions = 3 sorts over user-exercise subset → fine after index narrows (~hundreds-thousands rows/exercise); note MAX-only alternative in README scale section.
- NUMERIC → JS number mapping (pg returns strings) → explicit parseFloat in mapper; test it.
