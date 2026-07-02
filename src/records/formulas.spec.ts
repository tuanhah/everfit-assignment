import { epley1Rm } from './formulas';

describe('epley1Rm', () => {
  it('matches hand-computed values', () => {
    // 100kg x 10 reps -> 100 * (1 + 10/30) = 133.333...
    expect(epley1Rm(100, 10)).toBeCloseTo(133.333, 3);
    // 60kg x 30 reps -> exactly double
    expect(epley1Rm(60, 30)).toBe(120);
  });

  it('applies the formula to single reps (weight × 31/30)', () => {
    expect(epley1Rm(120, 1)).toBeCloseTo(124, 3);
  });

  it('returns 0 for bodyweight-only sets', () => {
    expect(epley1Rm(0, 12)).toBe(0);
  });

  it('mirrors the DB generated column formula', () => {
    // Same expression as est_1rm_kg in the migration:
    // weight_kg * (1 + reps / 30.0)
    const weightKg = 82.5;
    const reps = 7;
    expect(epley1Rm(weightKg, reps)).toBeCloseTo(82.5 * (1 + 7 / 30.0), 9);
  });
});
