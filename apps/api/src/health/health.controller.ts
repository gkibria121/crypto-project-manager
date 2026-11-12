import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { SystemHealthStatus } from "@repo/shared";
import { Public } from "../auth/auth.decorators.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { ScraperService } from "../scraper/scraper.service.js";

@ApiTags("health")
@Public()
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scraperService: ScraperService
  ) {}

  @Get("health")
  @ApiOperation({
    summary: "Root health check endpoint for container orchestration",
  })
  checkRoot(): Promise<SystemHealthStatus> {
    return this.buildHealthReport();
  }

  @Get("system/health")
  @ApiOperation({
    summary: "Check Core API, PostgreSQL database, and Python scraper health",
  })
  checkSystem(): Promise<SystemHealthStatus> {
    return this.buildHealthReport();
  }

  private async buildHealthReport(): Promise<SystemHealthStatus> {
    let databaseUp = false;
    try {
      await this.prisma.db.orm.public.PromptTemplate.select("id")
        .limit(1)
        .all();
      databaseUp = true;
    } catch {
      databaseUp = false;
    }

    const scraperUp = await this.scraperService.checkScraperHealth();

    return {
      status: databaseUp && scraperUp ? "ok" : "degraded",
      service: "pulseos-core-api",
      timestamp: new Date().toISOString(),
      dependencies: {
        database: databaseUp ? "up" : "down",
        scraper: scraperUp ? "up" : "down",
      },
    };
  }
}
