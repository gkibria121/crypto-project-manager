import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@repo/database";
import type { Request, Response } from "express";

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
    let details: unknown;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "string") {
        message = body;
      } else if (typeof body === "object" && body !== null) {
        const record = body as Record<string, unknown>;
        message = (record.message as string | string[]) ?? exception.message;
        if (record.errors) {
          details = record.errors;
        }
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === "P2025") {
        statusCode = HttpStatus.NOT_FOUND;
        message = "Requested record was not found";
      } else if (exception.code === "P2002") {
        statusCode = HttpStatus.CONFLICT;
        message = "Record already exists with the same unique key";
      } else {
        statusCode = HttpStatus.BAD_REQUEST;
        message = `Database request error (${exception.code})`;
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled error on ${request.method} ${request.url}: ${exception.message}`,
        exception.stack
      );
    }

    response.status(statusCode).json({
      statusCode,
      message,
      ...(details ? { details } : {}),
      path: request.url,
      requestId: typeof requestId === "string" ? requestId : undefined,
      timestamp: new Date().toISOString(),
    });
  }
}
