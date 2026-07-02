import { DataSource } from 'typeorm';
import catalog from '../../exercises/exercise-catalog.json';

/**
 * Upserts the exercise catalog from config. Idempotent: re-running
 * updates muscle groups in place (conflict target is the LOWER(name)
 * unique index), so editing exercise-catalog.json + re-seeding is the
 * supported way to change the exercise -> muscle group mapping.
 */
export async function seedExercises(dataSource: DataSource): Promise<number> {
  for (const exercise of catalog.exercises) {
    await dataSource.query(
      `
        INSERT INTO exercises (name, muscle_group)
        VALUES ($1, $2)
        ON CONFLICT ((LOWER(name)))
        DO UPDATE SET muscle_group = EXCLUDED.muscle_group
      `,
      [exercise.name, exercise.muscleGroup],
    );
  }
  return catalog.exercises.length;
}
