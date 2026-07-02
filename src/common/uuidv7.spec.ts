import { uuidv7 } from './uuidv7';

describe('uuidv7', () => {
  const UUID_V7_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it('produces RFC 9562 v7 ids (version and variant bits)', () => {
    for (let i = 0; i < 100; i++) {
      expect(uuidv7()).toMatch(UUID_V7_PATTERN);
    }
  });

  it('embeds the current timestamp in the first 48 bits', () => {
    const before = Date.now();
    const id = uuidv7();
    const after = Date.now();

    const embedded = parseInt(id.slice(0, 8) + id.slice(9, 13), 16);
    expect(embedded).toBeGreaterThanOrEqual(before);
    expect(embedded).toBeLessThanOrEqual(after);
  });

  it('sorts chronologically across different milliseconds', async () => {
    const first = uuidv7();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = uuidv7();
    expect(second > first).toBe(true);
  });

  it('never collides in a burst', () => {
    const ids = new Set(Array.from({ length: 10_000 }, () => uuidv7()));
    expect(ids.size).toBe(10_000);
  });
});
