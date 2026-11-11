import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import type { Request, Response } from "express";
import { Observable, tap } from "rxjs";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const existingId = request.headers["x-request-id"];
    const requestId =
      typeof existingId === "string" && existingId.trim().length > 0
        ? existingId
        : randomUUID();

    request.headers["x-request-id"] = requestId;
    response.setHeader("X-Request-Id", requestId);

    const start = Date.now();
    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          this.logger.log(
            `${request.method} ${request.originalUrl} ${response.statusCode} ${duration}ms [${requestId}]`
          );
        },
        error: (err: { status?: number }) => {
          const duration = Date.now() - start;
          this.logger.warn(
            `${request.method} ${request.originalUrl} ${err?.status ?? 500} ${duration}ms [${requestId}]`
          );
        },
      })
    );
  }
}
