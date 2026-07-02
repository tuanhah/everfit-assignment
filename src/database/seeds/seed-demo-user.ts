import { DataSource } from 'typeorm';
import { uuidv7 } from '../../common/uuidv7';
import { UnitConverterRegistry } from '../../units/unit-converter.registry';

export const DEMO_USER_ID = 'demo-user';

/**
 * Readable demo dataset: ~30 entries over May + June 2026 with a
 * deliberate progression so "PR this month vs last month" shows real
 * deltas, plus edge-case material (mixed units, an exercise logged
 * exactly once).
 *
 * Hand-computed Bench Press expectations (verified by integration tests):
 *   May sets:  05-07 10x80 (vol 800, 1rm 106.67) | 05-14 8x85 (680, 107.67)
 *              05-21 10x85 (850, 113.33), 6x90 (540, 108) | 05-28 5x100 (500, 116.67)
 *     -> May:  maxWeight 100 (05-28), maxVolume 850 (05-21), best1RM 116.67 (05-28)
 *   June sets: 06-04 10x90 (900, 120) | 06-11 3x105 (315, 115.5)
 *              06-18 12x85 (1020, 119) | 06-25 2x110 (220, 117.33)
 *     -> June: maxWeight 110 (06-25), maxVolume 1020 (06-18), best1RM 120 (06-04)
 *   Deltas June vs May: maxWeight +10, maxVolume +170, best1RM +3.33
 */
interface DemoEntry {
  date: string;
  exercise: string;
  sets: [reps: number, weight: number, unit: string][];
}

const DEMO_ENTRIES: DemoEntry[] = [
  // Bench Press progression (kg) — PR fixture documented above
  {
    date: '2026-05-07',
    exercise: 'Bench Press',
    sets: [
      [10, 80, 'kg'],
      [8, 80, 'kg'],
    ],
  },
  { date: '2026-05-14', exercise: 'Bench Press', sets: [[8, 85, 'kg']] },
  {
    date: '2026-05-21',
    exercise: 'Bench Press',
    sets: [
      [10, 85, 'kg'],
      [6, 90, 'kg'],
    ],
  },
  { date: '2026-05-28', exercise: 'Bench Press', sets: [[5, 100, 'kg']] },
  { date: '2026-06-04', exercise: 'Bench Press', sets: [[10, 90, 'kg']] },
  { date: '2026-06-11', exercise: 'Bench Press', sets: [[3, 105, 'kg']] },
  { date: '2026-06-18', exercise: 'Bench Press', sets: [[12, 85, 'kg']] },
  { date: '2026-06-25', exercise: 'Bench Press', sets: [[2, 110, 'kg']] },
  // Squat logged in lb (unit-conversion material)
  {
    date: '2026-05-06',
    exercise: 'Squat',
    sets: [
      [8, 275, 'lb'],
      [5, 315, 'lb'],
    ],
  },
  { date: '2026-05-13', exercise: 'Squat', sets: [[5, 315, 'lb']] },
  { date: '2026-05-20', exercise: 'Squat', sets: [[3, 345, 'lb']] },
  { date: '2026-06-03', exercise: 'Squat', sets: [[5, 335, 'lb']] },
  { date: '2026-06-10', exercise: 'Squat', sets: [[8, 300, 'lb']] },
  { date: '2026-06-17', exercise: 'Squat', sets: [[2, 365, 'lb']] },
  // Deadlift mixes units across sessions
  { date: '2026-05-09', exercise: 'Deadlift', sets: [[5, 160, 'kg']] },
  { date: '2026-05-23', exercise: 'Deadlift', sets: [[3, 375, 'lb']] },
  { date: '2026-06-06', exercise: 'Deadlift', sets: [[5, 170, 'kg']] },
  { date: '2026-06-20', exercise: 'Deadlift', sets: [[1, 405, 'lb']] },
  // Accessories
  {
    date: '2026-05-07',
    exercise: 'Overhead Press',
    sets: [
      [8, 50, 'kg'],
      [8, 50, 'kg'],
    ],
  },
  { date: '2026-05-21', exercise: 'Overhead Press', sets: [[6, 55, 'kg']] },
  { date: '2026-06-04', exercise: 'Overhead Press', sets: [[8, 55, 'kg']] },
  { date: '2026-06-18', exercise: 'Overhead Press', sets: [[4, 60, 'kg']] },
  { date: '2026-05-06', exercise: 'Barbell Row', sets: [[10, 70, 'kg']] },
  { date: '2026-05-20', exercise: 'Barbell Row', sets: [[10, 75, 'kg']] },
  { date: '2026-06-03', exercise: 'Barbell Row', sets: [[8, 80, 'kg']] },
  { date: '2026-06-17', exercise: 'Barbell Row', sets: [[8, 82.5, 'kg']] },
  { date: '2026-05-13', exercise: 'Lat Pulldown', sets: [[12, 60, 'kg']] },
  { date: '2026-06-10', exercise: 'Lat Pulldown', sets: [[12, 65, 'kg']] },
  // Edge case: exercise logged exactly once (single data point)
  { date: '2026-06-12', exercise: 'Cable Crunch', sets: [[15, 30, 'kg']] },
];

export async function seedDemoUser(dataSource: DataSource): Promise<number> {
  const existing: { count: string }[] = await dataSource.query(
    `SELECT count(*) AS count FROM workout_entries WHERE user_id = $1`,
    [DEMO_USER_ID],
  );
  if (parseInt(existing[0].count, 10) > 0) {
    return 0; // already seeded — keep idempotent
  }

  const converter = new UnitConverterRegistry();

  await dataSource.transaction(async (manager) => {
    for (const entry of DEMO_ENTRIES) {
      const [exercise]: { id: number }[] = await manager.query(
        `SELECT id FROM exercises WHERE LOWER(name) = LOWER($1)`,
        [entry.exercise],
      );
      const entryId = uuidv7();
      await manager.query(
        `INSERT INTO workout_entries (id, user_id, exercise_id, workout_date)
         VALUES ($1, $2, $3, $4)`,
        [entryId, DEMO_USER_ID, exercise.id, entry.date],
      );
      for (const [index, [reps, weight, unit]] of entry.sets.entries()) {
        await manager.query(
          `INSERT INTO sets (entry_id, position, reps, weight_original, unit_original, weight_kg)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            entryId,
            index + 1,
            reps,
            weight,
            unit,
            converter.toKg(weight, unit),
          ],
        );
      }
    }
  });

  return DEMO_ENTRIES.length;
}
