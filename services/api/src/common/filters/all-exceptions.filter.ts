import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const details =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const message =
      typeof details === 'object' && details !== null && 'message' in details
        ? details.message
        : exception instanceof HttpException
          ? exception.message
          : 'Erro interno do servidor';
    response.status(status).json({ statusCode: status, message });
  }
}
