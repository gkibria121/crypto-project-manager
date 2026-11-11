import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, ScrapeStatus as PrismaScrapeStatus } from "@repo/database";
import {
  scraperServiceResponseSchema,
  type CryptoProject,
  type ScrapeJob,
  type ScraperServiceResponse,
} from "@repo/shared";
import { z } from "zod";
import type { AppEnv } from "../config/env";
import { PrismaService } from "../prisma/prisma.service";
import {
  findFullProjectOrThrow,
  mapPrismaScrapeJobToDomain,
} from "../projects/project.mapper";

const batchScraperResponseSchema = z.object({
  results: z.array(scraperServiceResponseSchema),
});

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppEnv, true>
  ) {}

  async checkScraperHealth(): Promise<boolean> {
    const baseUrl = this.config.get("SCRAPER_SERVICE_URL", { infer: true });
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/health`, {
        signal: AbortSignal.timeout(2500),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async listJobsForProject(projectId: string): Promise<ScrapeJob[]> {
    await findFullProjectOrThrow(this.prisma, projectId);
    const jobs = await this.prisma.scrapeJob.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 25,
    });
    return jobs.map(mapPrismaScrapeJobToDomain);
  }

  async scrapeContext(
    projectId: string,
    contextId: string
  ): Promise<{ project: CryptoProject; job: ScrapeJob }> {
    const ctx = await this.prisma.projectContext.findFirst({
      where: { id: contextId, projectId },
    });

    if (!ctx) {
      throw new NotFoundException(
        `Context "${contextId}" not found for project "${projectId}".`
      );
    }

    const pendingJob = await this.prisma.scrapeJob.create({
      data: {
        projectId,
        contextId: ctx.id,
        targetType: ctx.type,
        targetValue: ctx.value,
        normalizedUrl: ctx.url,
        status: PrismaScrapeStatus.running,
      },
    });

    await this.prisma.projectContext.update({
      where: { id: ctx.id },
      data: { scrapeStatus: PrismaScrapeStatus.running },
    });

    try {
      const result = await this.callPythonScraper("/api/v1/scrape", {
        targetType: ctx.type,
        targetValue: ctx.value,
      });

      const parsed = scraperServiceResponseSchema.parse(result);
      const completedJob = await this.persistScrapeOutcome(
        pendingJob.id,
        ctx.id,
        ctx.summary,
        parsed
      );
      const project = await findFullProjectOrThrow(this.prisma, projectId);
      return { project, job: completedJob };
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : "Scraper service error";
      await this.prisma.scrapeJob.update({
        where: { id: pendingJob.id },
        data: {
          status: PrismaScrapeStatus.failed,
          errorMessage: errMsg,
          completedAt: new Date(),
        },
      });
      await this.prisma.projectContext.update({
        where: { id: ctx.id },
        data: { scrapeStatus: PrismaScrapeStatus.failed },
      });
      throw error;
    }
  }

  async scrapeAllProjectContexts(
    projectId: string
  ): Promise<{ project: CryptoProject; jobs: ScrapeJob[] }> {
    const projectRecord = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { contexts: true },
    });

    if (!projectRecord) {
      throw new NotFoundException(`Project "${projectId}" not found.`);
    }

    if (projectRecord.contexts.length === 0) {
      const project = await findFullProjectOrThrow(this.prisma, projectId);
      return { project, jobs: [] };
    }

    const targets = projectRecord.contexts.slice(0, 10);
    const pendingJobs = await Promise.all(
      targets.map((ctx) =>
        this.prisma.scrapeJob.create({
          data: {
            projectId,
            contextId: ctx.id,
            targetType: ctx.type,
            targetValue: ctx.value,
            normalizedUrl: ctx.url,
            status: PrismaScrapeStatus.running,
          },
        })
      )
    );

    try {
      const raw = await this.callPythonScraper("/api/v1/scrape/batch", {
        targets: targets.map((c) => ({
          targetType: c.type,
          targetValue: c.value,
        })),
      });

      const parsedBatch = batchScraperResponseSchema.parse(raw);
      const completedJobs: ScrapeJob[] = [];

      for (let i = 0; i < targets.length; i++) {
        const ctx = targets[i];
        const job = pendingJobs[i];
        const outcome = parsedBatch.results[i];
        if (!outcome) continue;

        const saved = await this.persistScrapeOutcome(
          job.id,
          ctx.id,
          ctx.summary,
          outcome
        );
        completedJobs.push(saved);
      }

      const project = await findFullProjectOrThrow(this.prisma, projectId);
      return { project, jobs: completedJobs };
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : "Batch scraper error";
      await Promise.all(
        pendingJobs.map((job) =>
          this.prisma.scrapeJob.update({
            where: { id: job.id },
            data: {
              status: PrismaScrapeStatus.failed,
              errorMessage: errMsg,
              completedAt: new Date(),
            },
          })
        )
      );
      throw error;
    }
  }

  private async persistScrapeOutcome(
    jobId: string,
    contextId: string,
    existingSummary: string | null,
    outcome: ScraperServiceResponse
  ): Promise<ScrapeJob> {
    const metadataJson: Prisma.InputJsonValue = {
      normalizedUrl: outcome.normalizedUrl ?? undefined,
      title: outcome.title ?? undefined,
      description: outcome.description ?? undefined,
      reachable: outcome.reachable,
      httpStatus: outcome.httpStatus ?? undefined,
      headings: outcome.headings,
      socialLinks: outcome.socialLinks,
      signals: outcome.signals,
      rawPreview: outcome.rawPreview ?? undefined,
      summary: outcome.summary ?? undefined,
      errorReason: outcome.errorReason ?? undefined,
    };

    const nextSummary =
      outcome.reachable && outcome.summary
        ? outcome.summary
        : existingSummary ?? outcome.summary ?? null;

    const now = new Date();
    const updatedJob = await this.prisma.scrapeJob.update({
      where: { id: jobId },
      data: {
        normalizedUrl: outcome.normalizedUrl ?? undefined,
        status: outcome.status,
        extractedTitle: outcome.title ?? undefined,
        extractedDescription: outcome.description ?? undefined,
        detectedSocials: outcome.socialLinks as Prisma.InputJsonValue,
        detectedSignals: outcome.signals,
        rawPreview: outcome.rawPreview ?? undefined,
        errorMessage: outcome.errorReason ?? undefined,
        durationMs: outcome.durationMs,
        completedAt: now,
      },
    });

    await this.prisma.projectContext.update({
      where: { id: contextId },
      data: {
        scrapeStatus: outcome.status,
        lastScrapedAt: now,
        scrapedMetadata: metadataJson,
        summary: nextSummary,
        updatedAtLabel: "Just scraped",
      },
    });

    return mapPrismaScrapeJobToDomain(updatedJob);
  }

  private async callPythonScraper(
    path: string,
    payload: unknown
  ): Promise<unknown> {
    const baseUrl = this.config
      .get("SCRAPER_SERVICE_URL", { infer: true })
      .replace(/\/$/, "");
    const apiKey = this.config.get("SCRAPER_API_KEY", { infer: true });
    const timeoutMs = this.config.get("SCRAPER_TIMEOUT_MS", { infer: true });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["X-Internal-Service-Key"] = apiKey;
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed calling Python scraper at ${path}: ${reason}`);
      throw new ServiceUnavailableException(
        `Python scraper microservice is unavailable: ${reason}`
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      this.logger.error(
        `Python scraper returned ${response.status} on ${path}: ${text}`
      );
      throw new ServiceUnavailableException(
        `Scraper microservice returned HTTP ${response.status}`
      );
    }

    return response.json();
  }
}
