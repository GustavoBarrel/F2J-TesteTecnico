import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { appendApiDebugMeta } from '../utils/append-api-debug-meta';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const body =
      typeof exceptionResponse === 'string'
        ? {
            statusCode: status,
            error: this.formatError(status),
            message: exceptionResponse,
          }
        : {
            statusCode: status,
            error: this.formatError(status),
            ...(exceptionResponse as Record<string, unknown>),
          };

    response
      .status(status)
      .json(appendApiDebugMeta(body, request, exception));
  }

  private formatError(status: number): string {
    const error = HttpStatus[status] ?? 'Error';

    return error
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
