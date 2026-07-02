---
phase: 3
title: Units & Exercise Catalog
status: completed
effort: 2h
priority: P1
dependencies:
  - 2
---

# Phase 3: Units & Exercise Catalog

## Overview

Two extensibility showcases (grading-critical since insights plugin dropped): UnitConverterRegistry (new unit = 1 registry entry) and config-driven exercise → muscle-group mapping (seeded from JSON, not hardcoded).

## Requirements

- Functional: kg↔lb conversion both directions; exercises seeded from config file; unknown exercise names on log → auto-create with `muscle_group = 'unknown'` (log warning) so logging never blocks on catalog gaps.
- Non-functional: adding `stone` = 1 line in registry + 0 migration; changing mapping = edit JSON + re-seed.

## Architecture

```typescript
// src/units/unit-converter.registry.ts
const UNIT_DEFINITIONS: Record<string, { toKgFactor: number }> = {
  kg: { toKgFactor: 1 },
  lb: { toKgFactor: 0.45359237 },
  // stone: { toKgFactor: 6.35029318 },  ← extensibility demo: 1 line
};

@Injectable()
export class UnitConverterRegistry {
  toKg(value: number, unit: string): number      // throws UnsupportedUnitError → 400
  fromKg(valueKg: number, unit: string): number
  isSupported(unit: string): boolean             // powers DTO validation
  supportedUnits(): string[]                     // powers error messages
}
```

- DTO validation for `unit` delegates to registry (custom class-validator constraint) — NOT a hardcoded `@IsIn(['kg','lb'])`, so new unit auto-validates.
- Rounding policy: store full precision (NUMERIC 8,3), round to 2dp only at response serialization. Document.
- `src/exercises/exercise-catalog.json`: `[{ name: "Bench Press", muscleGroup: "chest" }, ...]` ~20 exercises covering major groups.
- `ExercisesService`: `findOrCreateByName(name)` (case-insensitive via LOWER unique index), `findByMuscleGroup(group)`.
- Seed runner (idempotent upsert) callable from CLI script + compose startup.

## Related Code Files

- Create: `src/units/units.module.ts`, `src/units/unit-converter.registry.ts`, `src/units/is-supported-unit.validator.ts`, `src/exercises/exercises.module.ts`, `src/exercises/exercises.service.ts`, `src/exercises/exercise-catalog.json`, `src/database/seeds/seed-exercises.ts`
- Modify: `src/app.module.ts`

## Implementation Steps

1. Implement `UnitConverterRegistry` + custom validator + `UnsupportedUnitError`.
2. Unit tests alongside: round-trip kg↔lb (100lb → kg → lb ≈ 100), unknown unit throws, factor correctness.
3. Create `exercise-catalog.json` (~20 exercises, all major muscle groups; include names usable in seed scenarios).
4. `ExercisesService.findOrCreateByName` with case-insensitive lookup; auto-create unknown as `muscle_group='unknown'` + warn log.
5. Idempotent exercise seed script (`INSERT ... ON CONFLICT (LOWER(name)) DO UPDATE muscle_group`).

**Commits:**
- `feat: add unit conversion registry with kg and lb support`
- `feat: add exercise catalog with configurable muscle group mapping`

## Success Criteria

- [ ] Adding a fake `stone` entry locally makes it pass validation + convert with zero other changes (then remove)
- [ ] Round-trip conversion unit tests pass
- [ ] Re-running seed is idempotent (no duplicates)
- [ ] "bench press" vs "Bench Press" resolve to same exercise row

## Risk Assessment

- Float precision in conversions → keep math in JS number but round only at serialization; tests assert with tolerance.
- Auto-create unknown exercises can pollute catalog → acceptable trade-off (logging must not block); documented in README; 'unknown' group excluded from muscleGroup filter results naturally.
