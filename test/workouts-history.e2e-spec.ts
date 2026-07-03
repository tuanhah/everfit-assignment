import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { uuidv7 } from '../src/common/uuidv7';
import { cleanupUsers, createTestApp } from './utils/create-test-app';

describe('GET /workouts (e2e)', () => {
  let app: INestApplication;
  const userId = `e2e-hist-${uuidv7()}`;

  beforeAll(async () => {
    app = await createTestApp();
    // 5 days x (Bench Press kg + Squat lb) = 10 entries
    for (let day = 1; day <= 5; day++) {
      await request(app.getHttpServer())
        .post('/workouts')
        .send({
          userId,
          date: `2026-06-0${day}`,
          entries: [
            {
              exerciseName: 'Bench Press',
              sets: [{ reps: 10, weight: 80 + day, unit: 'kg' }],
            },
            {
              exerciseName: 'Squat',
              sets: [{ reps: 5, weight: 220 + day, unit: 'lb' }],
            },
          ],
        })
        .expect(201);
    }
  });

  afterAll(async () => {
    await cleanupUsers(app, [userId]);
    await app.close();
  });

  const get = (query: Record<string, string | number>) =>
    request(app.getHttpServer())
      .get('/workouts')
      .query({ userId, ...query });

  it('orders newest first and defaults to kg', async () => {
    const response = await get({ limit: 2 }).expect(200);
    // Both entries of the latest day come first. Their relative order
    // is an id tiebreak — ids created in the same bulk request share a
    // uuidv7 timestamp, so order within one request is not guaranteed.
    const dates = response.body.data.map(
      (entry: { date: string }) => entry.date,
    );
    expect(dates).toEqual(['2026-06-05', '2026-06-05']);

    const squat = response.body.data.find(
      (entry: { exerciseName: string }) => entry.exerciseName === 'Squat',
    );
    // 225 lb logged on 06-05, converted to kg by default
    expect(squat.sets[0].unit).toBe('kg');
    expect(squat.sets[0].weight).toBeCloseTo(102.06, 2);
    expect(squat.sets[0].originalWeight).toBe(225);
    expect(squat.sets[0].originalUnit).toBe('lb');
  });

  it('converts to the requested unit and keeps originals', async () => {
    const response = await get({ unit: 'lb', exercise: 'Bench' }).expect(200);
    const set = response.body.data[0].sets[0];
    // 85 kg -> 187.39 lb
    expect(set.weight).toBeCloseTo(187.39, 2);
    expect(set.unit).toBe('lb');
    expect(set.originalWeight).toBe(85);
    expect(set.originalUnit).toBe('kg');
  });

  it('combines partial name match with a date range', async () => {
    const response = await get({
      exercise: 'bench',
      from: '2026-06-02',
      to: '2026-06-04',
    }).expect(200);
    expect(response.body.data).toHaveLength(3);
    expect(
      response.body.data.every(
        (entry: { exerciseName: string }) =>
          entry.exerciseName === 'Bench Press',
      ),
    ).toBe(true);
  });

  it('filters by muscle group', async () => {
    const response = await get({ muscleGroup: 'legs', limit: 100 }).expect(200);
    expect(response.body.data).toHaveLength(5);
    expect(
      response.body.data.every(
        (entry: { exerciseName: string }) => entry.exerciseName === 'Squat',
      ),
    ).toBe(true);
  });

  it('walks all pages without duplicates or gaps', async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;

    do {
      const response = await get({
        limit: 3,
        ...(cursor ? { cursor } : {}),
      }).expect(200);
      seen.push(...response.body.data.map((entry: { id: string }) => entry.id));
      cursor = response.body.pagination.nextCursor;
      pages += 1;
    } while (cursor);

    expect(pages).toBe(4); // 10 entries / 3 per page
    expect(seen).toHaveLength(10);
    expect(new Set(seen).size).toBe(10);
  });

  it('treats LIKE wildcards in the exercise filter as literals', async () => {
    // "%" must not match everything — no exercise name contains a literal %.
    const response = await get({ exercise: '%' }).expect(200);
    expect(response.body.data).toEqual([]);
  });

  it('returns 200 with a message for an empty date range', async () => {
    const response = await get({
      from: '2020-01-01',
      to: '2020-12-31',
    }).expect(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.pagination.nextCursor).toBeNull();
    expect(response.body.message).toMatch(/no workout entries/i);
  });

  it('rejects a malformed cursor with INVALID_CURSOR', async () => {
    const response = await get({ cursor: 'garbage!!' }).expect(400);
    expect(response.body.error.code).toBe('INVALID_CURSOR');
  });

  it('rejects from > to', async () => {
    const response = await get({
      from: '2026-06-05',
      to: '2026-06-01',
    }).expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects limit above the maximum', async () => {
    const response = await get({ limit: 101 }).expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
