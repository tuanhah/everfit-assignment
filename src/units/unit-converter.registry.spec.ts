import {
  UnitConverterRegistry,
  UnsupportedUnitError,
  isSupportedUnit,
} from './unit-converter.registry';

describe('UnitConverterRegistry', () => {
  let registry: UnitConverterRegistry;

  beforeEach(() => {
    registry = new UnitConverterRegistry();
  });

  describe('toKg', () => {
    it('keeps kg values unchanged', () => {
      expect(registry.toKg(100, 'kg')).toBe(100);
    });

    it('converts lb to kg with the exact avoirdupois factor', () => {
      expect(registry.toKg(100, 'lb')).toBeCloseTo(45.359237, 6);
    });

    it('converts zero weight (bodyweight exercises)', () => {
      expect(registry.toKg(0, 'lb')).toBe(0);
    });

    it('is case-insensitive on unit names', () => {
      expect(registry.toKg(100, 'LB')).toBeCloseTo(45.359237, 6);
    });

    it('throws UnsupportedUnitError with supported list for unknown units', () => {
      expect(() => registry.toKg(100, 'stone')).toThrow(UnsupportedUnitError);
      try {
        registry.toKg(100, 'stone');
      } catch (error) {
        const unsupported = error as UnsupportedUnitError;
        expect(unsupported.unit).toBe('stone');
        expect(unsupported.supportedUnits).toEqual(
          expect.arrayContaining(['kg', 'lb']),
        );
      }
    });
  });

  describe('fromKg', () => {
    it('converts kg back to lb', () => {
      expect(registry.fromKg(45.359237, 'lb')).toBeCloseTo(100, 6);
    });

    it('round-trips lb -> kg -> lb without drift', () => {
      const original = 225;
      const roundTripped = registry.fromKg(registry.toKg(original, 'lb'), 'lb');
      expect(roundTripped).toBeCloseTo(original, 9);
    });

    it('throws for unknown units', () => {
      expect(() => registry.fromKg(100, 'oz')).toThrow(UnsupportedUnitError);
    });
  });

  describe('isSupported / supportedUnits', () => {
    it('reports kg and lb as supported', () => {
      expect(registry.isSupported('kg')).toBe(true);
      expect(registry.isSupported('lb')).toBe(true);
      expect(registry.isSupported('stone')).toBe(false);
    });

    it('rejects non-string values in the type guard', () => {
      expect(isSupportedUnit(42)).toBe(false);
      expect(isSupportedUnit(null)).toBe(false);
      expect(isSupportedUnit(undefined)).toBe(false);
    });
  });
});
