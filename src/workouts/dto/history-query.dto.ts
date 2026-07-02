import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsSupportedUnit } from '../../units/is-supported-unit.validator';

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

export class HistoryQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  userId: string;

  /** Partial, case-insensitive exercise name match (ILIKE %term%). */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  exercise?: string;

  @IsOptional()
  @Matches(DATE_FORMAT, { message: 'from must be in YYYY-MM-DD format' })
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @Matches(DATE_FORMAT, { message: 'to must be in YYYY-MM-DD format' })
  @IsDateString({ strict: true })
  to?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  muscleGroup?: string;

  /** Unit for weights in the response; originals are always included. */
  @IsOptional()
  @IsSupportedUnit()
  unit?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
