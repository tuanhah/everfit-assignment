import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { AppErrorCode } from '../common/errors/app-errors';
import { decodeCursor, encodeCursor } from '../common/pagination/cursor.util';
import { ExercisesService } from '../exercises/exercises.service';
import { UnitConverterRegistry } from '../units/unit-converter.registry';
import { HistoryQueryDto } from './dto/history-query.dto';
import { LogWorkoutDto } from './dto/log-workout.dto';
import {
  HistoryEntryResponse,
  toHistoryEntryResponse,
} from './workout-response.mapper';
import { WorkoutEntry } from './workout-entry.entity';
import { WorkoutSet } from './set.entity';

export interface HistoryPage {
  data: HistoryEntryResponse[];
  pagination: { nextCursor: string | null; limit: number };
  message?: string;
}

const DEFAULT_PAGE_SIZE = 20;

export interface LoggedSet {
  position: number;
  reps: number;
  weight: number;
  unit: string;
  weightKg: number;
}

export interface LoggedEntry {
  id: string;
  userId: string;
  exerciseName: string;
  muscleGroup: string;
  date: string;
  sets: LoggedSet[];
}

/**
 * Concurrency stance: logging is append-only — there is no
 * read-modify-write, so concurrent identical requests cannot corrupt
 * data or lose updates. Two identical entries are two legitimate
 * workout events. Atomicity of one bulk request is guaranteed by a
 * single transaction; nothing else is needed.
 */
@Injectable()
export class WorkoutsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(WorkoutEntry)
    private readonly entriesRepository: Repository<WorkoutEntry>,
    @InjectRepository(WorkoutSet)
    private readonly setsRepository: Repository<WorkoutSet>,
    private readonly exercisesService: ExercisesService,
    private readonly unitConverter: UnitConverterRegistry,
  ) {}

  async logWorkout(dto: LogWorkoutDto): Promise<LoggedEntry[]> {
    // Resolve exercises before the transaction: findOrCreateByName is
    // idempotent and race-safe on its own, and a catalog row staying
    // behind after a failed workout insert is harmless.
    const exercises = await Promise.all(
      dto.entries.map((entry) =>
        this.exercisesService.findOrCreateByName(entry.exerciseName),
      ),
    );

    // UUIDv7 ids generated app-side: known before INSERT, so entries and
    // sets are bulk-inserted in exactly two statements inside one tx.
    const entryRows = dto.entries.map((entry, index) => ({
      id: uuidv7(),
      userId: dto.userId,
      exerciseId: exercises[index].id,
      workoutDate: dto.date,
    }));

    const setRows = dto.entries.flatMap((entry, index) =>
      entry.sets.map((set, setIndex) => ({
        entryId: entryRows[index].id,
        position: setIndex + 1,
        reps: set.reps,
        weightOriginal: set.weight,
        unitOriginal: set.unit.toLowerCase(),
        weightKg: this.unitConverter.toKg(set.weight, set.unit),
      })),
    );

    await this.dataSource.transaction(async (manager) => {
      await manager.insert(WorkoutEntry, entryRows);
      await manager.insert(WorkoutSet, setRows);
    });

    return dto.entries.map((entry, index) => ({
      id: entryRows[index].id,
      userId: dto.userId,
      exerciseName: exercises[index].name,
      muscleGroup: exercises[index].muscleGroup,
      date: dto.date,
      sets: setRows
        .filter((set) => set.entryId === entryRows[index].id)
        .map((set) => ({
          position: set.position,
          reps: set.reps,
          weight: set.weightOriginal,
          unit: set.unitOriginal,
          weightKg: round3(set.weightKg),
        })),
    }));
  }

  /**
   * Filtered history with keyset pagination.
   *
   * Two-step load by design: page of entries first (rides the
   * (user_id, workout_date DESC, id DESC) index), then their sets via
   * one IN query — joining sets directly would multiply rows and break
   * LIMIT semantics.
   */
  async getHistory(query: HistoryQueryDto): Promise<HistoryPage> {
    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException({
        code: AppErrorCode.VALIDATION_ERROR,
        message: 'from must be earlier than or equal to to',
        details: [
          { field: 'from', message: 'must be earlier than or equal to to' },
        ],
      });
    }

    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const unit = query.unit?.toLowerCase() ?? 'kg';

    const qb = this.entriesRepository
      .createQueryBuilder('entry')
      .innerJoinAndSelect('entry.exercise', 'exercise')
      .where('entry.userId = :userId', { userId: query.userId })
      .orderBy('entry.workoutDate', 'DESC')
      .addOrderBy('entry.id', 'DESC')
      // Fetch one extra row to know whether a next page exists.
      .take(limit + 1);

    if (query.exercise) {
      qb.andWhere('exercise.name ILIKE :exercise', {
        exercise: `%${query.exercise}%`,
      });
    }
    if (query.muscleGroup) {
      qb.andWhere('exercise.muscle_group = :muscleGroup', {
        muscleGroup: query.muscleGroup,
      });
    }
    if (query.from) {
      qb.andWhere('entry.workoutDate >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('entry.workoutDate <= :to', { to: query.to });
    }
    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      // Row-tuple comparison seeks the index straight to the cursor.
      qb.andWhere('(entry.workout_date, entry.id) < (:cursorDate, :cursorId)', {
        cursorDate: cursor.d,
        cursorId: cursor.id,
      });
    }

    const rows = await qb.getMany();
    const hasNextPage = rows.length > limit;
    const page = hasNextPage ? rows.slice(0, limit) : rows;

    const sets = page.length
      ? await this.setsRepository.find({
          where: { entryId: In(page.map((entry) => entry.id)) },
          order: { entryId: 'ASC', position: 'ASC' },
        })
      : [];
    const setsByEntry = new Map<string, WorkoutSet[]>();
    for (const set of sets) {
      const bucket = setsByEntry.get(set.entryId) ?? [];
      bucket.push(set);
      setsByEntry.set(set.entryId, bucket);
    }

    const last = page[page.length - 1];
    return {
      data: page.map((entry) =>
        toHistoryEntryResponse(
          entry,
          setsByEntry.get(entry.id) ?? [],
          unit,
          this.unitConverter,
        ),
      ),
      pagination: {
        nextCursor: hasNextPage
          ? encodeCursor({ d: last.workoutDate, id: last.id })
          : null,
        limit,
      },
      ...(page.length === 0 && {
        message: 'No workout entries found for the given filters',
      }),
    };
  }
}

const round3 = (value: number): number => Math.round(value * 1000) / 1000;
