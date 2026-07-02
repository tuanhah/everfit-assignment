import { UnitConverterRegistry } from '../units/unit-converter.registry';
import { WorkoutEntry } from './workout-entry.entity';
import { WorkoutSet } from './set.entity';

export interface HistorySetResponse {
  position: number;
  reps: number;
  /** Weight converted into the requested unit. */
  weight: number;
  unit: string;
  /** Exactly what the user logged, always preserved. */
  originalWeight: number;
  originalUnit: string;
}

export interface HistoryEntryResponse {
  id: string;
  exerciseName: string;
  muscleGroup: string;
  date: string;
  loggedAt: string;
  sets: HistorySetResponse[];
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Serializes history rows, converting normalized kg weights into the
 * requested unit. Full precision lives in the DB; rounding to 2dp
 * happens only here at the response boundary.
 */
export function toHistoryEntryResponse(
  entry: WorkoutEntry,
  sets: WorkoutSet[],
  unit: string,
  converter: UnitConverterRegistry,
): HistoryEntryResponse {
  return {
    id: entry.id,
    exerciseName: entry.exercise.name,
    muscleGroup: entry.exercise.muscleGroup,
    date: entry.workoutDate,
    loggedAt: entry.loggedAt.toISOString(),
    sets: sets.map((set) => ({
      position: set.position,
      reps: set.reps,
      weight: round2(converter.fromKg(set.weightKg, unit)),
      unit,
      originalWeight: set.weightOriginal,
      originalUnit: set.unitOriginal,
    })),
  };
}
