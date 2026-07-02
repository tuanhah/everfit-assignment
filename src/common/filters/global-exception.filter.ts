import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { UnsupportedUnitError } from '../../units/unit-converter.registry';
import { AppErrorCode, AppErrorPayload } from '../errors/app-errors';

/**
 * Maps every thrown error to the single response envelope:
 *   { error: { code, message, details? } }
 *
 * - HttpExceptions built by our code carry an AppErrorPayload and pass through
 * - Nest's own HttpExceptions (404 on unknown route, etc.) get a code derived
 *   from their status
 * - Domain errors thrown below the controller layer (UnsupportedUnitError)
 *   are translated here so services stay HTTP-agnostic
 * - Anything else is a 500 with a generic message — stack goes to logs only
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, payload } = this.toEnvelope(exception);

    if (status >= 500) {
      this.logger.error(
        payload.message,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({ error: payload });
  }

  private toEnvelope(exception: unknown): {
    status: number;
    payload: AppErrorPayload;
  } {
    if (exception instanceof UnsupportedUnitError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        payload: {
          code: AppErrorCode.UNSUPPORTED_UNIT,
          message: exception.message,
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      // Payload already in our shape (built by exceptionFactory or services).
      if (typeof body === 'object' && body !== null && 'code' in body) {
        return { status, payload: body as AppErrorPayload };
      }

      const message =
        typeof body === 'object' && body !== null && 'message' in body
          ? String(body.message)
          : exception.message;

      return {
        status,
        payload: { code: this.codeFromStatus(status), message },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      payload: {
        code: AppErrorCode.INTERNAL,
        message: 'Internal server error',
      },
    };
  }

  private codeFromStatus(status: number): AppErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return AppErrorCode.VALIDATION_ERROR;
      case HttpStatus.NOT_FOUND:
        return AppErrorCode.NOT_FOUND;
      default:
        return status >= 500
          ? AppErrorCode.INTERNAL
          : AppErrorCode.VALIDATION_ERROR;
    }
  }
}
