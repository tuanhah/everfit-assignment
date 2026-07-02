import {
  BadRequestException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { AppErrorCode, FieldErrorDetail } from './errors/app-errors';

/**
 * Global ValidationPipe configured to emit our error envelope payload:
 * every DTO violation becomes { field: "entries.0.sets.1.weight", message }.
 */
export function buildValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    exceptionFactory: (errors) =>
      new BadRequestException({
        code: AppErrorCode.VALIDATION_ERROR,
        message: 'Request validation failed',
        details: flattenValidationErrors(errors),
      }),
  });
}

function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): FieldErrorDetail[] {
  return errors.flatMap((error) => {
    const path = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const own = Object.values(error.constraints ?? {}).map((message) => ({
      field: path,
      message,
    }));
    const nested = flattenValidationErrors(error.children ?? [], path);
    return [...own, ...nested];
  });
}
