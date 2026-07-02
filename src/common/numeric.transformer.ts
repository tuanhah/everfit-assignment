import { ValueTransformer } from 'typeorm';

/**
 * pg returns NUMERIC columns as strings to avoid float precision loss.
 * Weights in this domain (max 99999.999, 3 decimals) fit safely in a JS
 * number, so we convert at the entity boundary once instead of in every mapper.
 */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null): number | null => value,
  from: (value: string | null): number | null =>
    value === null ? null : parseFloat(value),
};
