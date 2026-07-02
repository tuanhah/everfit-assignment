import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { ExercisesService } from '../exercises/exercises.service';
import { UnitConverterRegistry } from '../units/unit-converter.registry';
import { LogWorkoutDto } from './dto/log-workout.dto';
import { WorkoutEntry } from './workout-entry.entity';
import { WorkoutSet } from './set.entity';

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
}

const round3 = (value: number): number => Math.round(value * 1000) / 1000;
