import { AppDataSource } from '../data-source';
import { seedExercises } from './seed-exercises';

/**
 * CLI seed runner: `npm run seed`.
 * Each seed function is idempotent, so the runner is safe to re-run.
 */
async function run(): Promise<void> {
  const dataSource = await AppDataSource.initialize();
  try {
    const count = await seedExercises(dataSource);
    console.log(`Seeded ${count} catalog exercises`);
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error) => {
  console.error('Seeding failed:', error);
  process.exitCode = 1;
});
