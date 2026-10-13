import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { type FastifyReply, type FastifyRequest } from 'fastify';
import { TooManyRequestsException } from '../exceptions/too-many-requests.exception.js';
import { type ErrorResponseDto } from '../dto/error-response.dto.js';

const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 409: 'Conflict',
  413: 'Payload Too Large', 415: 'Unsupported Media Type', 422: 'Unprocessable Entity',
  429: 'Too Many Requests', 500: 'Internal Server Error', 503: 'Service Unavailable',
};

/** Single error contract for the whole API. Never leaks stack traces or internals on 5xx. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();

    // Responses hijacked by oidc-provider are already on the wire.
    if (reply.sent || reply.raw.headersSent) return;

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let messages: string[] = ['Internal server error'];
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const raw = typeof body === 'string' ? body : (body as { message?: string | string[] }).message;
      messages = Array.isArray(raw) ? raw : [raw ?? exception.message];
    }

    if (status >= 500) {
      this.logger.error({ msg: 'Unhandled exception', requestId: request.id, path: request.url, err: String(exception) });
      if (exception instanceof Error && exception.stack) this.logger.error(exception.stack);
    }

    const payload: ErrorResponseDto = {
      statusCode: status,
      error: STATUS_TEXT[status] ?? 'Error',
      message: messages,
      requestId: String(request.id),
      timestamp: new Date().toISOString(),
      path: request.url.split('?')[0] ?? request.url,
    };

    if (exception instanceof TooManyRequestsException) {
      payload.retryAfterSeconds = exception.retryAfterSeconds;
      void reply.header('Retry-After', String(exception.retryAfterSeconds));
    }

    void reply.status(status).send(payload);
  }
}
