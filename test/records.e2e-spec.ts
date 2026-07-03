import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { uuidv7 } from '../src/common/uuidv7';
import { cleanupUsers, createTestApp } from './utils/create-test-app';

describe('GET /records (e2e)', () => {
  let app: INestApplication;
  const userId = `e2e-pr-${uuidv7()}`;

  /**
   * Fixture (all kg):
   *   May : 05-05 10x100 (vol 1000, 1rm 133.33)
   *         05-20  3x110 (vol 330,  1rm 121)
   *         05-25  3x110, 8x105  <- repeats the 110 max weight
   *   June: 06-10  2x120 (vol 240, 1rm 128)
   *         06-15 12x100 (vol 1200, 1rm 140)
   * Expected June vs May:
   *   maxWeight 120 (06-10) vs 110 (05-20 earliest!) -> delta +10
   *   maxVolume 1200 (06-15) vs 1000 (05-05)         -> delta +200
   *   best1RM   140 (06-15) vs 133.33 (05-05)        -> delta +6.67
   */
  const fixture: [string, [number, number][]][] = [
    ['2026-05-05', [[10, 100]]],
    ['2026-05-20', [[3, 110]]],
    [
      '2026-05-25',
      [
        [3, 110],
        [8, 105],
      ],
    ],
    ['2026-06-10', [[2, 120]]],
    ['2026-06-15', [[12, 100]]],
  ];

  beforeAll(async () => {
    app = await createTestApp();
    for (const [date, sets] of fixture) {
      await request(app.getHttpServer())
        .post('/workouts')
        .send({
          userId,
          date,
          entries: [
            {
              exerciseName: 'Bench Press',
              sets: sets.map(([reps, weight]) => ({
                reps,
                weight,
                unit: 'kg',
              })),
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

  const get = (query: Record<string, string> = {}) =>
    request(app.getHttpServer())
      .get('/records')
      .query({ userId, exercise: 'Bench Press', ...query });

  it('returns all three PR types with the date each was achieved', async () => {
    const response = await get().expect(200);
    const { records } = response.body.data.current;

    expect(records.maxWeight).toMatchObject({ value: 120, date: '2026-06-10' });
    expect(records.maxVolume).toMatchObject({
      value: 1200,
      reps: 12,
      date: '2026-06-15',
    });
    expect(records.best1Rm).toMatchObject({
      value: 140,
      date: '2026-06-15',
      formula: 'epley',
    });
  });

  it('tie-breaks equal PRs to the earliest date', async () => {
    const response = await get({
      from: '2026-05-01',
      to: '2026-05-31',
    }).expect(200);
    // 110kg lifted on 05-20 and again on 05-25 — first achievement wins.
    expect(response.body.data.current.records.maxWeight.date).toBe(
      '2026-05-20',
    );
  });

  it('compares two ranges and computes deltas', async () => {
    const response = await get({
      from: '2026-06-01',
      to: '2026-06-30',
      compareFrom: '2026-05-01',
      compareTo: '2026-05-31',
    }).expect(200);

    const { comparison, delta } = response.body.data;
    expect(comparison.records.maxWeight.value).toBe(110);
    expect(delta).toEqual({ maxWeight: 10, maxVolume: 200, best1Rm: 6.67 });
  });

  it('converts PR values into the requested unit', async () => {
    const response = await get({ unit: 'lb' }).expect(200);
    // 120 kg -> 264.55 lb
    expect(response.body.data.current.records.maxWeight.value).toBeCloseTo(
      264.55,
      2,
    );
    expect(response.body.data.unit).toBe('lb');
  });

  it('handles a single-data-point exercise without special casing', async () => {
    const singleUser = `e2e-pr-single-${uuidv7()}`;
    await request(app.getHttpServer())
      .post('/workouts')
      .send({
        userId: singleUser,
        date: '2026-06-12',
        entries: [
          {
            exerciseName: 'Cable Crunch',
            sets: [{ reps: 15, weight: 30, unit: 'kg' }],
          },
        ],
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/records')
      .query({ userId: singleUser, exercise: 'Cable Crunch' })
      .expect(200);

    const { records } = response.body.data.current;
    // All three PRs resolve to the same (only) set.
    expect(records.maxWeight.value).toBe(30);
    expect(records.maxVolume.value).toBe(450);
    expect(records.best1Rm.value).toBe(45);

    await cleanupUsers(app, [singleUser]);
  });

  it('returns 200 + null records + message for an empty range', async () => {
    const response = await get({
      from: '2020-01-01',
      to: '2020-12-31',
    }).expect(200);
    expect(response.body.data.current.records).toBeNull();
    expect(response.body.data.current.message).toMatch(/no sets logged/i);
  });

  it('returns 200 + message when only the comparison range is empty', async () => {
    const response = await get({
      compareFrom: '2020-01-01',
      compareTo: '2020-12-31',
    }).expect(200);
    expect(response.body.data.comparison.records).toBeNull();
    expect(response.body.data.delta).toBeNull();
  });

  it('404s for an unknown exercise', async () => {
    const response = await get({ exercise: 'Nonexistent Lift' }).expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects compareFrom without compareTo', async () => {
    const response = await get({ compareFrom: '2026-05-01' }).expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
