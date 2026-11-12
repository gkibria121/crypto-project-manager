import "reflect-metadata";
import { Logger, RequestMethod } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import {
  json,
  urlencoded,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { AppModule } from "./app.module.js";
import { GlobalExceptionFilter } from "./common/filters/http-exception.filter.js";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor.js";
import type { AppEnv } from "./config/env.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger("Bootstrap");

  const config = app.get<ConfigService<AppEnv, true>>(ConfigService);
  const port = config.get("PORT", { infer: true });
  const corsOrigins = config
    .get("CORS_ORIGINS", { infer: true })
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableShutdownHooks();
  app.use(json({ limit: "10mb" }));
  app.use(urlencoded({ extended: true, limit: "10mb" }));

  // Companion security headers per modern-web-guidance (security)
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), geolocation=(), microphone=(), focus-without-user-activation=()"
    );
    next();
  });

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });

  app.setGlobalPrefix("api/v1", {
    exclude: [{ path: "health", method: RequestMethod.GET }],
  });

  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle("PulseOS Core Backend API")
    .setDescription(
      "NestJS core microservice with RBAC authentication & authorization for crypto project workspaces, contexts, AI campaigns, checklists, and Python scraper orchestration."
    )
    .setVersion("1.0.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  await app.listen(port, "0.0.0.0");
  logger.log(`PulseOS Core API listening on http://0.0.0.0:${port}`);
  logger.log(`Swagger documentation available at http://0.0.0.0:${port}/docs`);
}

void bootstrap();
