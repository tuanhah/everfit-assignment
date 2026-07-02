import { DataSource } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

export const PERF_USER_ID = 'perf-user';
export const PERF_ENTRY_COUNT = 50_000;

const EXERCISES_IN_ROTATION = 10;
const ENTRIES_PER_DAY = 5;
const ENTRY_BATCH_SIZE = 1_000;

/**
 * Generates 50k+ entries (~125k sets) for one user to prove that
 * history pagination and PR aggregation stay fast at the scale the
 * assignment requires. Deterministic (no randomness) and batched:
 * multi-row INSERTs keep the whole seed in the tens of seconds.
 */
export async function seedPerfUser(dataSource: DataSource): Promise<number> {
  const existing: { count: string }[] = await dataSource.query(
    `SELECT count(*) AS count FROM workout_entries WHERE user_id = $1`,
    [PERF_USER_ID],
  );
  if (parseInt(existing[0].count, 10) >= PERF_ENTRY_COUNT) {
    return 0; // already seeded — keep idempotent
  }

  const exercises: { id: number }[] = await dataSource.query(
    `SELECT id FROM exercises ORDER BY id LIMIT $1`,
    [EXERCISES_IN_ROTATION],
  );

  // Walk backwards from a fixed anchor date, ENTRIES_PER_DAY per day
  // (~27 years of history — irrelevant; only row volume matters here).
  const anchor = new Date('2026-06-30T00:00:00Z');

  for (let offset = 0; offset < PERF_ENTRY_COUNT; offset += ENTRY_BATCH_SIZE) {
    const entryValues: string[] = [];
    const entryParams: unknown[] = [];
    const setValues: string[] = [];
    const setParams: unknown[] = [];

    for (let i = offset; i < offset + ENTRY_BATCH_SIZE; i++) {
      const id = uuidv7();
      const dayOffset = Math.floor(i / ENTRIES_PER_DAY);
      const date = new Date(anchor);
      date.setUTCDate(date.getUTCDate() - dayOffset);
      const workoutDate = date.toISOString().slice(0, 10);
      const exerciseId = exercises[i % exercises.length].id;

      const base = entryParams.length;
      entryValues.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`,
      );
      entryParams.push(id, PERF_USER_ID, exerciseId, workoutDate);

      // 2-3 sets per entry, weights cycle 60..140kg with rep waves
      const setsCount = 2 + (i % 2);
      for (let position = 1; position <= setsCount; position++) {
        const weight = 60 + ((i + position * 7) % 81);
        const reps = 3 + ((i + position) % 10);
        const setBase = setParams.length;
        setValues.push(
          `($${setBase + 1}, $${setBase + 2}, $${setBase + 3}, $${setBase + 4}, $${setBase + 5}, $${setBase + 6})`,
        );
        setParams.push(id, position, reps, weight, 'kg', weight);
      }
    }

    await dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO workout_entries (id, user_id, exercise_id, workout_date)
         VALUES ${entryValues.join(', ')}`,
        entryParams,
      );
      await manager.query(
        `INSERT INTO sets (entry_id, position, reps, weight_original, unit_original, weight_kg)
         VALUES ${setValues.join(', ')}`,
        setParams,
      );
    });
  }

  return PERF_ENTRY_COUNT;
}
