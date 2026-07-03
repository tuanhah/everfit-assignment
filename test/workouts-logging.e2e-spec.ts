import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { uuidv7 } from '../src/common/uuidv7';
import { cleanupUsers, createTestApp } from './utils/create-test-app';

describe('POST /workouts (e2e)', () => {
  let app: INestApplication;
  const userId = `e2e-log-${uuidv7()}`;

  const validBody = () => ({
    userId,
    date: '2026-07-01',
    entries: [
      {
        exerciseName: 'Bench Press',
        sets: [
          { reps: 10, weight: 100, unit: 'kg' },
          { reps: 8, weight: 225, unit: 'lb' },
        ],
      },
      {
        exerciseName: 'Squat',
        sets: [{ reps: 5, weight: 140, unit: 'kg' }],
      },
    ],
  });

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupUsers(app, [userId]);
    await app.close();
  });

  it('logs multiple exercises in one request and normalizes to kg', async () => {
    const response = await request(app.getHttpServer())
      .post('/workouts')
      .send(validBody())
      .expect(201);

    const entries = response.body.data;
    expect(entries).toHaveLength(2);
    expect(entries[0].muscleGroup).toBe('chest');
    // 225 lb -> 102.058 kg (avoirdupois factor)
    expect(entries[0].sets[1].weightKg).toBeCloseTo(102.058, 3);
    expect(entries[0].sets[1].weight).toBe(225);
    expect(entries[0].sets[1].unit).toBe('lb');
  });

  it('persists what it returns (visible via history)', async () => {
    const history = await request(app.getHttpServer())
      .get('/workouts')
      .query({ userId })
      .expect(200);

    expect(history.body.data).toHaveLength(2);
  });

  describe('validation matrix', () => {
    const expectFieldError = async (
      body: Record<string, unknown>,
      field: string,
    ) => {
      const response = await request(app.getHttpServer())
        .post('/workouts')
        .send(body)
        .expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(
        response.body.error.details.map((d: { field: string }) => d.field),
      ).toContain(field);
    };

    it('rejects null date', () =>
      expectFieldError({ ...validBody(), date: null }, 'date'));

    it('rejects malformed date', () =>
      expectFieldError({ ...validBody(), date: '01/07/2026' }, 'date'));

    it('rejects impossible calendar date', () =>
      expectFieldError({ ...validBody(), date: '2026-13-45' }, 'date'));

    it('rejects missing userId', () =>
      expectFieldError({ ...validBody(), userId: undefined }, 'userId'));

    it('rejects empty entries array', () =>
      expectFieldError({ ...validBody(), entries: [] }, 'entries'));

    it('rejects empty sets array', () =>
      expectFieldError(
        {
          ...validBody(),
          entries: [{ exerciseName: 'Bench Press', sets: [] }],
        },
        'entries.0.sets',
      ));

    it('rejects negative reps', () =>
      expectFieldError(
        {
          ...validBody(),
          entries: [
            {
              exerciseName: 'Bench Press',
              sets: [{ reps: -5, weight: 100, unit: 'kg' }],
            },
          ],
        },
        'entries.0.sets.0.reps',
      ));

    it('rejects negative weight', () =>
      expectFieldError(
        {
          ...validBody(),
          entries: [
            {
              exerciseName: 'Bench Press',
              sets: [{ reps: 5, weight: -100, unit: 'kg' }],
            },
          ],
        },
        'entries.0.sets.0.weight',
      ));

    it('rejects unsupported unit with the supported list in the message', async () => {
      const response = await request(app.getHttpServer())
        .post('/workouts')
        .send({
          ...validBody(),
          entries: [
            {
              exerciseName: 'Bench Press',
              sets: [{ reps: 5, weight: 100, unit: 'stone' }],
            },
          ],
        })
        .expect(400);
      const detail = response.body.error.details.find(
        (d: { field: string }) => d.field === 'entries.0.sets.0.unit',
      );
      expect(detail.message).toContain('kg');
      expect(detail.message).toContain('lb');
    });
  });

  it('accepts concurrent identical requests as independent events', async () => {
    const raceUser = `e2e-race-${uuidv7()}`;
    const body = { ...validBody(), userId: raceUser };

    const [first, second] = await Promise.all([
      request(app.getHttpServer()).post('/workouts').send(body),
      request(app.getHttpServer()).post('/workouts').send(body),
    ]);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const history = await request(app.getHttpServer())
      .get('/workouts')
      .query({ userId: raceUser, limit: 100 })
      .expect(200);
    // Both requests persisted in full: 2 requests x 2 entries each.
    expect(history.body.data).toHaveLength(4);

    await cleanupUsers(app, [raceUser]);
  });
});
