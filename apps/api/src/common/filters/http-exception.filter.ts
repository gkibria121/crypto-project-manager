import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = request.headers["x-request-id"];

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = "Internal server error";
    let code: string | undefined;
    let details: unknown;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "string") {
        message = body;
      } else if (isRecord(body)) {
        message = (body.message as string | string[]) ?? exception.message;
        if (typeof body.code === "string") {
          code = body.code;
        }
        if (body.errors) {
          details = body.errors;
        }
      }
    } else if (isRecord(exception) && typeof exception.sqlState === "string") {
      const sqlState = exception.sqlState;
      if (sqlState === "23505") {
        statusCode = HttpStatus.CONFLICT;
        message = "Record already exists with the same unique key";
      } else if (sqlState === "23503") {
        statusCode = HttpStatus.BAD_REQUEST;
        message = "Referenced record does not exist";
      } else if (sqlState === "23502" || sqlState === "23514") {
        statusCode = HttpStatus.BAD_REQUEST;
        message = "Database constraint validation failed";
      } else {
        this.logger.error(
          `SQL error (${sqlState}) on ${request.method} ${request.url}`
        );
      }
    } else if (isRecord(exception) && typeof exception.code === "string") {
      const code = exception.code;
      if (code === "RUNTIME.NO_ROWS") {
        statusCode = HttpStatus.NOT_FOUND;
        message = "Requested record was not found";
      } else if (code.startsWith("ORM.")) {
        statusCode = HttpStatus.BAD_REQUEST;
        message =
          typeof exception.message === "string"
            ? exception.message
            : `Database request error (${code})`;
      } else {
        this.logger.error(
          `Prisma runtime error (${code}) on ${request.method} ${request.url}`
        );
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled error on ${request.method} ${request.url}: ${exception.message}`,
        exception.stack
      );
    }

    response.status(statusCode).json({
      statusCode,
      ...(code ? { code } : {}),
      message,
      ...(details ? { details } : {}),
      path: request.url,
      requestId: typeof requestId === "string" ? requestId : undefined,
      timestamp: new Date().toISOString(),
    });
  }
}
