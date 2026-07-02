import { randomBytes } from 'crypto';

/**
 * RFC 9562 UUIDv7: 48-bit unix-ms timestamp + 74 random bits.
 * Time-ordered ids give sequential B-tree inserts (no random page
 * splits) while staying unguessable.
 *
 * Hand-rolled instead of the `uuid` package: v14 ships ESM-only,
 * which breaks under Jest's CommonJS runtime, and this is 15 lines.
 */
export function uuidv7(): string {
  const bytes = randomBytes(16);
  const timestamp = Date.now();

  // 48-bit big-endian timestamp in bytes 0-5
  bytes[0] = Math.floor(timestamp / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(timestamp / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(timestamp / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(timestamp / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(timestamp / 2 ** 8) & 0xff;
  bytes[5] = timestamp & 0xff;

  bytes[6] = (bytes[6] & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC variant

  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
