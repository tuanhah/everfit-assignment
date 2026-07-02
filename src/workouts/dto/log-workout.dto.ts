import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsSupportedUnit } from '../../units/is-supported-unit.validator';

export class LogSetDto {
  @IsInt()
  @Min(1)
  reps: number;

  /** Weight in the unit the user logged; 0 allowed for bodyweight work. */
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(99999.999)
  weight: number;

  @IsSupportedUnit()
  unit: string;
}

export class LogEntryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  exerciseName: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => LogSetDto)
  sets: LogSetDto[];
}

export class LogWorkoutDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  userId: string;

  /**
   * Business date of the workout in the user's own local calendar.
   * Plain YYYY-MM-DD by design — the client decides which date the
   * workout belongs to; the server never re-interprets timezones.
   */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  @IsDateString(
    { strict: true },
    { message: 'date must be a valid calendar date' },
  )
  date: string;

  /** One request can log several exercises (bulk). */
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => LogEntryDto)
  entries: LogEntryDto[];
}
