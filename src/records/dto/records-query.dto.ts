import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { IsSupportedUnit } from '../../units/is-supported-unit.validator';

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

export class RecordsQueryDto {
  /** Exact exercise name (case-insensitive). Required — PRs are per exercise. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  exercise: string;

  @IsOptional()
  @Matches(DATE_FORMAT, { message: 'from must be in YYYY-MM-DD format' })
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @Matches(DATE_FORMAT, { message: 'to must be in YYYY-MM-DD format' })
  @IsDateString({ strict: true })
  to?: string;

  /** Second range for "PR this month vs last month"; must come as a pair. */
  @IsOptional()
  @Matches(DATE_FORMAT, { message: 'compareFrom must be in YYYY-MM-DD format' })
  @IsDateString({ strict: true })
  compareFrom?: string;

  @IsOptional()
  @Matches(DATE_FORMAT, { message: 'compareTo must be in YYYY-MM-DD format' })
  @IsDateString({ strict: true })
  compareTo?: string;

  @IsOptional()
  @IsSupportedUnit()
  unit?: string;
}
