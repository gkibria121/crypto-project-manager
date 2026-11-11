import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  scraperServiceResponseSchema,
  type CryptoProject,
  type ScrapeJob,
  type ScraperServiceResponse,
} from "@repo/shared";
import { z } from "zod";
import type { AppEnv } from "../config/env.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  findFullProjectOrThrow,
  mapPrismaScrapeJobToDomain,
  type PrismaScrapeJobRow,
} from "../projects/project.mapper.js";

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
    const jobs = await this.prisma.db.orm.public.ScrapeJob.where({ projectId })
      .orderBy((j) => j.createdAt.desc())
      .limit(25)
      .all();
    return jobs.map(mapPrismaScrapeJobToDomain);
  }

  async scrapeContext(
    projectId: string,
    contextId: string
  ): Promise<{ project: CryptoProject; job: ScrapeJob }> {
    const ctx = await this.prisma.db.orm.public.ProjectContext.where({
      id: contextId,
      projectId,
    }).first();

    if (!ctx) {
      throw new NotFoundException(
        `Context "${contextId}" not found for project "${projectId}".`
      );
    }

    const pendingJob = await this.prisma.db.orm.public.ScrapeJob.create({
      projectId,
      contextId: ctx.id,
      targetType: ctx.type,
      targetValue: ctx.value,
      normalizedUrl: ctx.url,
      status: "running",
      attemptCount: 1,
    });

    await this.prisma.db.orm.public.ProjectContext.where({
      id: ctx.id,
    }).update({ scrapeStatus: "running" });

    try {
      const result = await this.callPythonScraper("/api/v1/scrape", {
        targetType: ctx.type,
        targetValue: ctx.value,
      });

      const parsed = scraperServiceResponseSchema.parse(result);
      const completedJob = await this.persistScrapeOutcome(
        pendingJob.id,
        ctx.id,
        projectId,
        ctx.summary,
        parsed
      );
      const project = await findFullProjectOrThrow(this.prisma, projectId);
      return { project, job: completedJob };
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : "Scraper service error";
      await this.prisma.db.orm.public.ScrapeJob.where({
        id: pendingJob.id,
      }).update({
        status: "failed",
        errorMessage: errMsg,
        completedAt: new Date(),
      });
      await this.prisma.db.orm.public.ProjectContext.where({
        id: ctx.id,
      }).update({ scrapeStatus: "failed" });
      throw error;
    }
  }

  async scrapeAllProjectContexts(
    projectId: string
  ): Promise<{ project: CryptoProject; jobs: ScrapeJob[] }> {
    const projectRecord = await this.prisma.db.orm.public.Project.include(
      "contexts"
    )
      .where({ id: projectId })
      .first();

    if (!projectRecord) {
      throw new NotFoundException(`Project "${projectId}" not found.`);
    }

    if (projectRecord.contexts.length === 0) {
      const project = await findFullProjectOrThrow(this.prisma, projectId);
      return { project, jobs: [] };
    }

    const targets = projectRecord.contexts.slice(0, 10);
    const pendingJobs: PrismaScrapeJobRow[] = [];
    for (const ctx of targets) {
      const job = await this.prisma.db.orm.public.ScrapeJob.create({
        projectId,
        contextId: ctx.id,
        targetType: ctx.type,
        targetValue: ctx.value,
        normalizedUrl: ctx.url,
        status: "running",
        attemptCount: 1,
      });
      pendingJobs.push(job);
    }

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
          projectId,
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
      for (const job of pendingJobs) {
        await this.prisma.db.orm.public.ScrapeJob.where({ id: job.id }).update({
          status: "failed",
          errorMessage: errMsg,
          completedAt: new Date(),
        });
      }
      throw error;
    }
  }

  private async persistScrapeOutcome(
    jobId: string,
    contextId: string,
    projectId: string,
    existingSummary: string | null,
    outcome: ScraperServiceResponse
  ): Promise<ScrapeJob> {
    const metadataJson = {
      ...(outcome.normalizedUrl
        ? { normalizedUrl: outcome.normalizedUrl }
        : {}),
      ...(outcome.title ? { title: outcome.title } : {}),
      ...(outcome.description ? { description: outcome.description } : {}),
      reachable: outcome.reachable,
      ...(outcome.httpStatus !== undefined && outcome.httpStatus !== null
        ? { httpStatus: outcome.httpStatus }
        : {}),
      headings: outcome.headings,
      socialLinks: outcome.socialLinks,
      signals: outcome.signals,
      ...(outcome.rawPreview ? { rawPreview: outcome.rawPreview } : {}),
      ...(outcome.summary ? { summary: outcome.summary } : {}),
      ...(outcome.errorReason ? { errorReason: outcome.errorReason } : {}),
    };

    const nextSummary =
      outcome.reachable && outcome.summary
        ? outcome.summary
        : existingSummary ?? outcome.summary ?? null;

    const now = new Date();
    const updatedJob = await this.prisma.db.transaction(async (tx) => {
      const job = await tx.orm.public.ScrapeJob.where({ id: jobId }).update({
        normalizedUrl: outcome.normalizedUrl ?? null,
        status: outcome.status,
        httpStatus: outcome.httpStatus ?? null,
        extractedTitle: outcome.title ?? null,
        extractedDescription: outcome.description ?? null,
        detectedSocials: outcome.socialLinks,
        detectedSignals: outcome.signals,
        rawPreview: outcome.rawPreview ?? null,
        errorMessage: outcome.errorReason ?? null,
        durationMs: outcome.durationMs ?? null,
        completedAt: now,
      });

      await tx.orm.public.ProjectContext.where({ id: contextId }).update({
        scrapeStatus: outcome.status,
        lastScrapedAt: now,
        scrapedMetadata: metadataJson,
        summary: nextSummary,
        updatedAtLabel: "Just scraped",
      });

      await tx.orm.public.Project.where({ id: projectId }).update({
        lastScrapedAt: now,
        lastActivityTime: "Just now",
      });

      return job;
    });

    if (!updatedJob) {
      throw new NotFoundException(`Scrape job "${jobId}" not found.`);
    }

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
