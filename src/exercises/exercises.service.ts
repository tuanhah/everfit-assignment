import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Exercise } from './exercise.entity';

/**
 * Exercise identity is case-insensitive ("bench press" === "Bench Press"),
 * enforced by the LOWER(name) unique index.
 *
 * Unknown exercise names are auto-created with muscle group "unknown"
 * instead of rejecting the request: logging a workout must never block
 * on catalog gaps. Gaps are visible in logs and fixable by re-seeding
 * the catalog config.
 */
export const UNKNOWN_MUSCLE_GROUP = 'unknown';

@Injectable()
export class ExercisesService {
  private readonly logger = new Logger(ExercisesService.name);

  constructor(
    @InjectRepository(Exercise)
    private readonly repository: Repository<Exercise>,
  ) {}

  async findOrCreateByName(name: string): Promise<Exercise> {
    const trimmed = name.trim();

    const existing = await this.findByName(trimmed);
    if (existing) {
      return existing;
    }

    this.logger.warn(
      `Exercise "${trimmed}" not in catalog — creating with muscle group "${UNKNOWN_MUSCLE_GROUP}"`,
    );

    // ON CONFLICT DO NOTHING + re-select keeps concurrent first-time
    // logs of the same new exercise race-safe (unique LOWER(name) index).
    await this.repository
      .createQueryBuilder()
      .insert()
      .values({ name: trimmed, muscleGroup: UNKNOWN_MUSCLE_GROUP })
      .orIgnore()
      .execute();

    const created = await this.findByName(trimmed);
    if (!created) {
      throw new Error(`Failed to create exercise "${trimmed}"`);
    }
    return created;
  }

  private findByName(name: string): Promise<Exercise | null> {
    return this.repository
      .createQueryBuilder('exercise')
      .where('LOWER(exercise.name) = LOWER(:name)', { name })
      .getOne();
  }
}
