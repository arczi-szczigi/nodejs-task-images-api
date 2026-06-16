import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';

/**
 * Consistent, debuggable error envelope for the whole API.
 *
 * Every error response carries:
 *  - the HTTP status and a short error name,
 *  - a clear human-readable `message` (validation errors keep the per-field
 *    details from class-validator so the caller knows exactly what was wrong),
 *  - the `path`/`method` that failed and a timestamp,
 *  - a `traceId` that is also logged server-side — so a reported error can be
 *    located in the logs instantly.
 *
 * Unexpected (non-HTTP) errors are logged with their stack but never leak
 * internals to the client (OWASP A05/A09).
 */
interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  method: string;
  timestamp: string;
  traceId: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const traceId = randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'Internal Server Error';
    let message: string | string[] = 'An unexpected error occurred.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string') {
        message = response;
      } else if (typeof response === 'object' && response !== null) {
        const r = response as Record<string, unknown>;
        // class-validator/Nest put details under `message`, name under `error`
        message = (r.message as string | string[]) ?? exception.message;
        error = (r.error as string) ?? error;
      }
      if (error === 'Internal Server Error') error = exception.name;
    } else if (exception instanceof Error) {
      // Unexpected: log full detail, return generic message + traceId.
      this.logger.error(
        `[${traceId}] Unhandled ${exception.name}: ${exception.message}`,
        exception.stack,
      );
    }

    if (status >= 500) {
      this.logger.error(`[${traceId}] ${req.method} ${req.url} -> ${status}`);
    } else {
      this.logger.warn(`[${traceId}] ${req.method} ${req.url} -> ${status}: ${message}`);
    }

    const body: ErrorBody = {
      statusCode: status,
      error,
      message,
      path: req.url,
      method: req.method,
      timestamp: new Date().toISOString(),
      traceId,
    };
    res.status(status).json(body);
  }
}
