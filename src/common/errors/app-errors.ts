/**
 * Stable machine-readable error codes for the API envelope.
 * Every error response has the shape:
 *   { error: { code, message, details? } }
 */
export enum AppErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNSUPPORTED_UNIT = 'UNSUPPORTED_UNIT',
  NOT_FOUND = 'NOT_FOUND',
  INVALID_CURSOR = 'INVALID_CURSOR',
  INTERNAL = 'INTERNAL',
}

export interface FieldErrorDetail {
  field: string;
  message: string;
}

/** Payload carried inside HttpException responses built by our code. */
export interface AppErrorPayload {
  code: AppErrorCode;
  message: string;
  details?: FieldErrorDetail[];
}
