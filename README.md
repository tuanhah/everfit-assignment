# Everfit Workout Logging API

A workout logging API for coaches to track client metrics over time: log
exercises (bulk, multi-unit), browse filtered history, and track personal
records — built with NestJS + PostgreSQL + TypeORM.

📹 **Walkthrough video:** [Google Drive](https://drive.google.com/file/d/1KjWUigjOY-klGTj4oO16tQCMDzezQCQ0/view?usp=sharing)

## Quick Start

```bash
docker compose up
```

That single command starts Postgres, runs migrations, seeds the database
(exercise catalog + two demo users) and boots the API on
[http://localhost:3000](http://localhost:3000). Interactive API docs:
[http://localhost:3000/docs](http://localhost:3000/docs).

Try it immediately with the seeded data:

```bash
# History for the readable demo user (returns lb on request)
curl "localhost:3000/workouts?userId=demo-user&exercise=bench&unit=lb"

# PRs: June vs May comparison with deltas
curl "localhost:3000/records?userId=demo-user&exercise=Bench%20Press&from=2026-06-01&to=2026-06-30&compareFrom=2026-05-01&compareTo=2026-05-31"

# Performance check against the 50k-entry user
curl "localhost:3000/workouts?userId=perf-user&limit=50"
```

### Local development

```bash
cp .env.example .env       # defaults match docker compose
docker compose up postgres # database only
npm install
npm run migration:run
npm run seed
npm run start:dev
```

### Tests

```bash
npm test          # unit: conversions, Epley, cursor codec, uuidv7
npm run test:e2e  # integration + perf smoke (needs the compose Postgres)
```

## Architecture

```mermaid
flowchart TB
    Client[Coach app / curl]

    subgraph NestJS
        subgraph common[common - cross-cutting]
            EF[Exception filter<br/>single error envelope]
            VP[ValidationPipe<br/>field-level details]
            CU[Cursor util<br/>keyset pagination]
        end
        WC[WorkoutsController<br/>POST /workouts - GET /workouts]
        RC[RecordsController<br/>GET /records]
        HC[HealthController]
        WS[WorkoutsService] --> UR[UnitConverterRegistry]
        RS[RecordsService] --> UR
        WS --> ES[ExercisesService]
    end

    subgraph PostgreSQL
        T1[(exercises)]
        T2[(workout_entries)]
        T3[(sets)]
    end

    CFG[exercise-catalog.json] -. seed .-> T1
    Client --> WC & RC
    WC --> WS
    RC --> RS
    WS --> T2 & T3
    RS --> T3
    ES --> T1
    T2 -. soft ref .-> T1
    T3 -. soft ref .-> T2
```

Module boundaries: `units/` (conversion registry), `exercises/` (catalog +
muscle-group mapping), `workouts/` (log + history), `records/` (PRs),
`health/`, `common/` (error envelope, validation, pagination), `database/`
(migrations, seeds). Dependencies flow one way: workouts → units + exercises,
records → units + exercises. No cycles.

## API

Full request/response schemas live in Swagger at `/docs`. Summary:

### POST /workouts — log a workout (bulk)

```json
{
  "userId": "demo-user",
  "date": "2026-07-01",
  "entries": [
    {
      "exerciseName": "Bench Press",
      "sets": [
        { "reps": 10, "weight": 100, "unit": "kg" },
        { "reps": 8, "weight": 225, "unit": "lb" }
      ]
    }
  ]
}
```

- Multiple exercises per request; the whole request is one transaction
  (all-or-nothing).
- Weights are normalized to kg at insert (`weightKg`) alongside the original
  value and unit.
- Unknown exercise names are auto-created with muscle group `unknown` —
  logging never blocks on catalog gaps.
- `201` with the created entries; `400` with per-field details on validation
  errors.

### GET /workouts — filtered history

Query params: `userId` (required), `exercise` (partial match), `from`, `to`,
`muscleGroup`, `unit` (kg|lb, response conversion), `cursor`, `limit`
(default 20, max 100).

- Cursor-based (keyset) pagination ordered by `workout_date DESC, id DESC`;
  `pagination.nextCursor` is `null` on the last page.
- Weights are returned in the requested unit; `originalWeight`/`originalUnit`
  always preserved.
- An empty result is `200` with `data: []` and a human message — not an error.

### GET /records — personal records

Query params: `userId` (required), `exercise` (required, exact
case-insensitive), `from`, `to`, `compareFrom` + `compareTo` (pair), `unit`.

- Returns max weight, max volume (reps × weight) and best estimated 1RM
  (Epley: `weight × (1 + reps/30)`), each with the date it was **first**
  achieved (earliest-date tie-break).
- With a comparison range: second set of records plus `delta` per PR type.
- A range with no data returns `records: null` + message (`200`), never an
  error. Unknown exercise → `404`.

### Error envelope

Every failure has one shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [
  { "field": "entries.0.sets.1.weight", "message": "must not be less than 0" }
] } }
```

| Code | Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Malformed input; `details` lists field paths |
| `UNSUPPORTED_UNIT` | 400 | Unit not in the registry; message lists supported units |
| `INVALID_CURSOR` | 400 | Pagination cursor malformed |
| `NOT_FOUND` | 404 | Unknown exercise/route |
| `INTERNAL` | 500 | Unexpected error; stack goes to logs, never to clients |

## Database Schema & Design Decisions

```
exercises        id SERIAL PK · name TEXT · muscle_group TEXT
                 UNIQUE INDEX ux_exercises_name_lower (LOWER(name))

workout_entries  id UUID PK (UUIDv7, app-generated) · user_id TEXT
                 exercise_id (soft ref) · workout_date DATE · logged_at TIMESTAMPTZ
                 INDEX ix_entries_user_exercise_date (user_id, exercise_id, workout_date DESC)
                 INDEX ix_entries_user_date_id      (user_id, workout_date DESC, id DESC)

sets             id BIGSERIAL PK · entry_id (soft ref) · position · reps
                 weight_original NUMERIC(8,3) · unit_original TEXT
                 weight_kg NUMERIC(8,3)
                 volume_kg  GENERATED ALWAYS AS (reps * weight_kg) STORED
                 est_1rm_kg GENERATED ALWAYS AS (weight_kg * (1 + reps/30.0)) STORED
                 CHECKs: reps > 0, weights >= 0, position > 0
                 INDEX ix_sets_entry (entry_id)
```

## Known Issues

- `npm audit` reports transitive advisories via the current `@nestjs/core`
  (multer chain); no non-breaking fix is published at the time of writing.
