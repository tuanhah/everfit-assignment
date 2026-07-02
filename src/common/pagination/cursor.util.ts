import { BadRequestException } from '@nestjs/common';
import { AppErrorCode } from '../errors/app-errors';

/**
 * Keyset pagination cursor for (workout_date DESC, id DESC) ordering.
 * Opaque to clients: base64url of { d: 'YYYY-MM-DD', id: uuid }.
 * Keyset (vs OFFSET) keeps page N as cheap as page 1 — the composite
 * index is seeked directly to the cursor position.
 */
export interface HistoryCursor {
  /** workout_date of the last row on the previous page */
  d: string;
  /** id of the last row on the previous page (tie-break within a date) */
  id: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeCursor(cursor: HistoryCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function decodeCursor(raw: string): HistoryCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8'),
    ) as HistoryCursor;
    if (DATE_PATTERN.test(parsed.d) && UUID_PATTERN.test(parsed.id)) {
      return parsed;
    }
  } catch {
    // fall through to the shared error below
  }
  throw new BadRequestException({
    code: AppErrorCode.INVALID_CURSOR,
    message:
      'cursor is invalid or malformed; request the first page without a cursor',
  });
}
