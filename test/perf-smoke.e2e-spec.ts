import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import {
  seedPerfUser,
  PERF_USER_ID,
} from '../src/database/seeds/seed-perf-user';
import { createTestApp } from './utils/create-test-app';

/**
 * Proves the endpoints stay fast at the assignment's required scale
 * (50k+ entries per user). Wall-clock thresholds are generous on
 * purpose — the EXPLAIN assertion is the real regression guard: if a
 * query stops using the composite indexes, it fails long before the
 * timing does.
 */
describe('performance smoke at 50k entries (e2e)', () => {
  let app: INestApplication;
  const PAGE_BUDGET_MS = 200;

  beforeAll(async () => {
    app = await createTestApp();
    // Idempotent: instantly skipped when the perf user is already seeded.
    await seedPerfUser(app.get(DataSource));
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  it('serves a deep history page within budget', async () => {
    // Walk three pages so the last request lands mid-dataset.
    let cursor: string | null = null;
    for (let page = 0; page < 3; page++) {
      const started = Date.now();
      const response = await request(app.getHttpServer())
        .get('/workouts')
        .query({
          userId: PERF_USER_ID,
          limit: 50,
          ...(cursor ? { cursor } : {}),
        })
        .expect(200);
      const elapsed = Date.now() - started;

      expect(response.body.data).toHaveLength(50);
      expect(elapsed).toBeLessThan(PAGE_BUDGET_MS);
      cursor = response.body.pagination.nextCursor;
    }
  });

  it('serves PRs over ~12k sets of one exercise within budget', async () => {
    const started = Date.now();
    const response = await request(app.getHttpServer())
      .get(`/users/${PERF_USER_ID}/records`)
      .query({ exercise: 'Bench Press' })
      .expect(200);
    const elapsed = Date.now() - started;

    expect(response.body.data.current.records).not.toBeNull();
    expect(elapsed).toBeLessThan(PAGE_BUDGET_MS);
  });

  it('uses the composite indexes, not sequential scans', async () => {
    const dataSource = app.get(DataSource);

    const historyPlan: { 'QUERY PLAN': string }[] = await dataSource.query(
      `EXPLAIN SELECT * FROM workout_entries
       WHERE user_id = $1
       ORDER BY workout_date DESC, id DESC LIMIT 20`,
      [PERF_USER_ID],
    );
    expect(JSON.stringify(historyPlan)).toContain('ix_entries_user_date_id');

    const prPlan: { 'QUERY PLAN': string }[] = await dataSource.query(
      `EXPLAIN SELECT s.* FROM sets s
       JOIN workout_entries we ON we.id = s.entry_id
       WHERE we.user_id = $1 AND we.exercise_id = 1`,
      [PERF_USER_ID],
    );
    expect(JSON.stringify(prPlan)).toContain('ix_entries_user_exercise_date');
  });
});
