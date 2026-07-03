import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppErrorCode } from '../common/errors/app-errors';
import { ExercisesService } from '../exercises/exercises.service';
import { UnitConverterRegistry } from '../units/unit-converter.registry';
import { RecordsQueryDto } from './dto/records-query.dto';

interface PrRow {
  reps: number;
  weight_original: string;
  unit_original: string;
  weight_kg: string;
  volume_kg: string;
  est_1rm_kg: string;
  workout_date: string;
  rn_weight: string;
  rn_volume: string;
  rn_1rm: string;
}

export interface PrRecord {
  value: number;
  reps: number;
  date: string;
  originalWeight: number;
  originalUnit: string;
}

export interface PrRecords {
  maxWeight: PrRecord;
  maxVolume: PrRecord;
  best1Rm: PrRecord & { formula: 'epley' };
}

export interface RangeRecords {
  range: { from: string | null; to: string | null };
  records: PrRecords | null;
  message?: string;
}

export interface RecordsResponse {
  userId: string;
  exercise: string;
  unit: string;
  current: RangeRecords;
  comparison?: RangeRecords;
  delta?: {
    maxWeight: number;
    maxVolume: number;
    best1Rm: number;
  } | null;
}

const NO_DATA_MESSAGE = 'No sets logged for this exercise in the given range';

/**
 * One indexed query per range returns all three PR types:
 * window functions rank sets by weight_kg / volume_kg / est_1rm_kg
 * (all precomputed columns) after the (user_id, exercise_id) index
 * narrows the scan to one user's history of one exercise.
 * Tie-break is earliest workout_date — the day the PR was first achieved.
 */
@Injectable()
export class RecordsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly exercisesService: ExercisesService,
    private readonly unitConverter: UnitConverterRegistry,
  ) {}

  async getRecords(query: RecordsQueryDto): Promise<RecordsResponse> {
    const { userId } = query;
    this.assertValidRanges(query);

    const exercise = await this.exercisesService.findByName(query.exercise);
    if (!exercise) {
      throw new NotFoundException({
        code: AppErrorCode.NOT_FOUND,
        message: `Exercise "${query.exercise}" not found`,
      });
    }

    const unit = query.unit?.toLowerCase() ?? 'kg';
    const current = await this.recordsForRange(
      userId,
      exercise.id,
      unit,
      query.from ?? null,
      query.to ?? null,
    );

    const response: RecordsResponse = {
      userId,
      exercise: exercise.name,
      unit,
      current,
    };

    if (query.compareFrom && query.compareTo) {
      const comparison = await this.recordsForRange(
        userId,
        exercise.id,
        unit,
        query.compareFrom,
        query.compareTo,
      );
      response.comparison = comparison;
      response.delta =
        current.records && comparison.records
          ? {
              maxWeight: round2(
                current.records.maxWeight.value -
                  comparison.records.maxWeight.value,
              ),
              maxVolume: round2(
                current.records.maxVolume.value -
                  comparison.records.maxVolume.value,
              ),
              best1Rm: round2(
                current.records.best1Rm.value -
                  comparison.records.best1Rm.value,
              ),
            }
          : null;
    }

    return response;
  }

  private async recordsForRange(
    userId: string,
    exerciseId: number,
    unit: string,
    from: string | null,
    to: string | null,
  ): Promise<RangeRecords> {
    const rows = await this.dataSource.query<PrRow[]>(
      `
        SELECT *
        FROM (
          SELECT
            s.reps,
            s.weight_original,
            s.unit_original,
            s.weight_kg,
            s.volume_kg,
            s.est_1rm_kg,
            to_char(we.workout_date, 'YYYY-MM-DD') AS workout_date,
            ROW_NUMBER() OVER (ORDER BY s.weight_kg DESC, we.workout_date ASC) AS rn_weight,
            ROW_NUMBER() OVER (ORDER BY s.volume_kg DESC, we.workout_date ASC) AS rn_volume,
            ROW_NUMBER() OVER (ORDER BY s.est_1rm_kg DESC, we.workout_date ASC) AS rn_1rm
          FROM sets s
          JOIN workout_entries we ON we.id = s.entry_id
          WHERE we.user_id = $1
            AND we.exercise_id = $2
            AND ($3::date IS NULL OR we.workout_date >= $3)
            AND ($4::date IS NULL OR we.workout_date <= $4)
        ) ranked
        WHERE rn_weight = 1 OR rn_volume = 1 OR rn_1rm = 1
      `,
      [userId, exerciseId, from, to],
    );

    const range = { from, to };
    if (rows.length === 0) {
      return { range, records: null, message: NO_DATA_MESSAGE };
    }

    const byRank = (key: 'rn_weight' | 'rn_volume' | 'rn_1rm'): PrRow =>
      rows.find((row) => row[key] === '1') as PrRow;

    const weightRow = byRank('rn_weight');
    const volumeRow = byRank('rn_volume');
    const oneRmRow = byRank('rn_1rm');

    return {
      range,
      records: {
        maxWeight: this.toRecord(
          weightRow,
          parseFloat(weightRow.weight_kg),
          unit,
        ),
        maxVolume: this.toRecord(
          volumeRow,
          parseFloat(volumeRow.volume_kg),
          unit,
        ),
        best1Rm: {
          ...this.toRecord(oneRmRow, parseFloat(oneRmRow.est_1rm_kg), unit),
          formula: 'epley',
        },
      },
    };
  }

  private toRecord(row: PrRow, valueKg: number, unit: string): PrRecord {
    return {
      value: round2(this.unitConverter.fromKg(valueKg, unit)),
      reps: row.reps,
      date: row.workout_date,
      originalWeight: parseFloat(row.weight_original),
      originalUnit: row.unit_original,
    };
  }

  private assertValidRanges(query: RecordsQueryDto): void {
    const violations: { field: string; message: string }[] = [];

    if (query.from && query.to && query.from > query.to) {
      violations.push({
        field: 'from',
        message: 'must be earlier than or equal to to',
      });
    }
    if (Boolean(query.compareFrom) !== Boolean(query.compareTo)) {
      violations.push({
        field: 'compareFrom',
        message: 'compareFrom and compareTo must be provided together',
      });
    }
    if (
      query.compareFrom &&
      query.compareTo &&
      query.compareFrom > query.compareTo
    ) {
      violations.push({
        field: 'compareFrom',
        message: 'must be earlier than or equal to compareTo',
      });
    }

    if (violations.length > 0) {
      throw new BadRequestException({
        code: AppErrorCode.VALIDATION_ERROR,
        message: 'Request validation failed',
        details: violations,
      });
    }
  }
}

const round2 = (value: number): number => Math.round(value * 100) / 100;
