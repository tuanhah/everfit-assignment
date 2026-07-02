import { Injectable } from '@nestjs/common';

/**
 * Single source of truth for supported weight units.
 * Adding a new unit (e.g. stone) is ONE entry here — validation,
 * conversion and error messages all derive from this map.
 */
const UNIT_DEFINITIONS: Record<string, { toKgFactor: number }> = {
  kg: { toKgFactor: 1 },
  lb: { toKgFactor: 0.45359237 },
};

export class UnsupportedUnitError extends Error {
  constructor(
    public readonly unit: string,
    public readonly supportedUnits: string[],
  ) {
    super(
      `Unsupported weight unit "${unit}". Supported units: ${supportedUnits.join(', ')}`,
    );
    this.name = 'UnsupportedUnitError';
  }
}

/** Units list usable in contexts without DI (e.g. validator decorators). */
export const SUPPORTED_UNITS = Object.keys(UNIT_DEFINITIONS);

export const isSupportedUnit = (unit: unknown): unit is string =>
  typeof unit === 'string' && unit.toLowerCase() in UNIT_DEFINITIONS;

@Injectable()
export class UnitConverterRegistry {
  supportedUnits(): string[] {
    return SUPPORTED_UNITS;
  }

  isSupported(unit: string): boolean {
    return isSupportedUnit(unit);
  }

  /** Normalize a weight value to kilograms. */
  toKg(value: number, unit: string): number {
    return value * this.factorOf(unit);
  }

  /** Convert a kilogram value into the requested unit. */
  fromKg(valueKg: number, unit: string): number {
    return valueKg / this.factorOf(unit);
  }

  private factorOf(unit: string): number {
    const definition = UNIT_DEFINITIONS[unit?.toLowerCase()];
    if (!definition) {
      throw new UnsupportedUnitError(unit, this.supportedUnits());
    }
    return definition.toKgFactor;
  }
}
