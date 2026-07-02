import { BadRequestException } from '@nestjs/common';
import { decodeCursor, encodeCursor } from './cursor.util';

describe('cursor util', () => {
  const cursor = {
    d: '2026-07-01',
    id: '019f227b-cd70-7618-bf05-a7768cb20d4d',
  };

  it('round-trips encode -> decode', () => {
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('produces url-safe output', () => {
    expect(encodeCursor(cursor)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    ['garbage', 'not-base64-json!!!'],
    ['valid json, wrong shape', Buffer.from('{"a":1}').toString('base64url')],
    [
      'bad date format',
      Buffer.from(JSON.stringify({ d: '01/07/2026', id: cursor.id })).toString(
        'base64url',
      ),
    ],
    [
      'bad uuid',
      Buffer.from(JSON.stringify({ d: cursor.d, id: 'nope' })).toString(
        'base64url',
      ),
    ],
  ])('rejects %s with BadRequestException', (_label, raw) => {
    expect(() => decodeCursor(raw)).toThrow(BadRequestException);
  });
});
