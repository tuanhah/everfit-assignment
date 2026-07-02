import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { buildValidationPipe } from '../../src/common/validation.pipe-factory';

/**
 * Boots the real AppModule against the real Postgres from .env —
 * integration tests exercise actual SQL, indexes and constraints.
 * Global pipe + filter mirror main.ts exactly so error envelopes
 * behave identically to production.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(buildValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());
  await app.init();
  return app;
}

/** Removes all workout data for the given users (sets cascade). */
export async function cleanupUsers(
  app: INestApplication,
  userIds: string[],
): Promise<void> {
  const dataSource = app.get(DataSource);
  await dataSource.query(
    `DELETE FROM workout_entries WHERE user_id = ANY($1)`,
    [userIds],
  );
}
