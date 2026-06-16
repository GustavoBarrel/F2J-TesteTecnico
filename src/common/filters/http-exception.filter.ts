import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const body =
      typeof exceptionResponse === 'string'
        ? {
            statusCode: status,
            error: HttpStatus[status] ?? 'Error',
            message: exceptionResponse,
          }
        : {
            statusCode: status,
            ...(exceptionResponse as Record<string, unknown>),
          };

    response.status(status).json(body);
  }
}
