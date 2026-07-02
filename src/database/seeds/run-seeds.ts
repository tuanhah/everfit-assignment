import { AppDataSource } from '../data-source';
import { seedDemoUser, DEMO_USER_ID } from './seed-demo-user';
import { seedExercises } from './seed-exercises';
import { seedPerfUser, PERF_USER_ID } from './seed-perf-user';

/**
 * CLI seed runner: `npm run seed`.
 * Each seed function is idempotent, so the runner is safe to re-run.
 */
async function run(): Promise<void> {
  const dataSource = await AppDataSource.initialize();
  try {
    const exercises = await seedExercises(dataSource);
    console.log(`Seeded ${exercises} catalog exercises`);

    const demo = await seedDemoUser(dataSource);
    console.log(
      demo > 0
        ? `Seeded ${demo} entries for ${DEMO_USER_ID}`
        : `${DEMO_USER_ID} already seeded — skipped`,
    );

    const started = Date.now();
    const perf = await seedPerfUser(dataSource);
    console.log(
      perf > 0
        ? `Seeded ${perf} entries for ${PERF_USER_ID} in ${((Date.now() - started) / 1000).toFixed(1)}s`
        : `${PERF_USER_ID} already seeded — skipped`,
    );
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error) => {
  console.error('Seeding failed:', error);
  process.exitCode = 1;
});
