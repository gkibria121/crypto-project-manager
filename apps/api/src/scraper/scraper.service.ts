import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DEFAULT_SCRAPE_CONFIG,
  SPECIALIZED_SCRAPER_PROVIDERS,
  SPECIALIZED_SCRAPER_PROVIDER_META,
  scrapeConfigSchema,
  scraperServiceResponseSchema,
  type CryptoProject,
  type ProjectScrapedDataResponse,
  type ScrapeConfig,
  type ScrapeJob,
  type ScraperProviderStatus,
  type ScraperServiceResponse,
  type SpecializedScraperProvider,
  type TriggerScrapeDto,
} from "@repo/shared";
import { z } from "zod";
import type { AuthenticatedUser } from "../auth/auth.decorators.js";
import type { AppEnv } from "../config/env.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  activateProjectOnActivity,
  computeActivatedProjectPatch,
} from "../projects/project-lifecycle.helper.js";
import {
  findFullProjectOrThrow,
  mapPrismaScrapeJobToDomain,
  mapPrismaScrapedPageToDomain,
  type PrismaScrapeJobRow,
} from "../projects/project.mapper.js";
import {
  decryptProviderSecret,
  encryptProviderSecret,
  maskProviderSecret,
} from "./scraper-crypto.helper.js";

const batchScraperResponseSchema = z.object({
  results: z.array(scraperServiceResponseSchema),
});

interface ResolvedCredentials {
  xBearerToken?: string;
  linkedinAccessToken?: string;
  telegramBotToken?: string;
}

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppEnv, true>
  ) {}

  private getEncryptionMaterial(): string {
    return this.config.get("JWT_SECRET", { infer: true });
  }

  private getEnvKeyForProvider(provider: SpecializedScraperProvider): string {
    switch (provider) {
      case "x":
        return (
          this.config.get("X_API_BEARER_TOKEN", { infer: true }) ||
          process.env["X_API_KEY"] ||
          process.env["TWITTER_BEARER_TOKEN"] ||
          ""
        ).trim();
      case "linkedin":
        return (
          this.config.get("LINKEDIN_API_KEY", { infer: true }) ||
          process.env["LINKEDIN_ACCESS_TOKEN"] ||
          ""
        ).trim();
      case "telegram":
        return (
          this.config.get("TELEGRAM_BOT_TOKEN", { infer: true }) ||
          process.env["TELEGRAM_API_KEY"] ||
          ""
        ).trim();
    }
  }

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

  async listProviderStatuses(): Promise<ScraperProviderStatus[]> {
    const rows =
      await this.prisma.db.orm.public.ScraperProviderConfig.all();
    const dbMap = new Map(rows.map((r) => [r.provider, r]));
    const secretMaterial = this.getEncryptionMaterial();

    return SPECIALIZED_SCRAPER_PROVIDERS.map((provider) => {
      const meta = SPECIALIZED_SCRAPER_PROVIDER_META[provider];
      const dbRow = dbMap.get(provider);
      let workspaceKey = "";
      if (dbRow?.isEnabled && dbRow.apiKey) {
        try {
          workspaceKey = decryptProviderSecret(dbRow.apiKey, secretMaterial).trim();
        } catch {
          workspaceKey = "";
        }
      }

      const envKey = this.getEnvKeyForProvider(provider);
      const effectiveSource: ScraperProviderStatus["source"] = workspaceKey
        ? "workspace"
        : envKey
          ? "env"
          : "none";
      const activeKey = workspaceKey || envKey;

      return {
        provider,
        label: meta.label,
        shortLabel: meta.shortLabel,
        envVar: meta.envVar,
        preferredMethod: meta.preferredMethod,
        docsUrl: meta.docsUrl,
        requiredNotice: meta.requiredNotice,
        configured: Boolean(activeKey),
        source: effectiveSource,
        maskedKey: activeKey ? maskProviderSecret(activeKey) : null,
        updatedAt: dbRow?.updatedAt ? dbRow.updatedAt.toISOString() : null,
      };
    });
  }

  async saveProviderKey(
    provider: SpecializedScraperProvider,
    apiKey: string,
    actor?: AuthenticatedUser
  ): Promise<ScraperProviderStatus[]> {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      throw new BadRequestException("API key or token cannot be empty.");
    }
    const encrypted = encryptProviderSecret(
      trimmed,
      this.getEncryptionMaterial()
    );

    await this.prisma.db.transaction(async (tx) => {
      await tx.orm.public.ScraperProviderConfig.upsert({
        create: {
          provider,
          apiKey: encrypted,
          isEnabled: true,
          updatedBy: actor?.email ?? null,
        },
        update: {
          apiKey: encrypted,
          isEnabled: true,
          updatedBy: actor?.email ?? null,
        },
      });

      if (actor) {
        await tx.orm.public.AuditLog.create({
          actorId: actor.id,
          actorEmail: actor.email,
          actorRole: actor.role,
          action: "SCRAPER_PROVIDER_KEY_SAVED",
          resource: "scraper_provider_configs",
          resourceId: provider,
          details: { provider, maskedKey: maskProviderSecret(trimmed) },
        });
      }
    });

    return this.listProviderStatuses();
  }

  async deleteProviderKey(
    provider: SpecializedScraperProvider,
    actor?: AuthenticatedUser
  ): Promise<ScraperProviderStatus[]> {
    await this.prisma.db.transaction(async (tx) => {
      await tx.orm.public.ScraperProviderConfig.where({
        provider,
      }).deleteAll();

      if (actor) {
        await tx.orm.public.AuditLog.create({
          actorId: actor.id,
          actorEmail: actor.email,
          actorRole: actor.role,
          action: "SCRAPER_PROVIDER_KEY_REMOVED",
          resource: "scraper_provider_configs",
          resourceId: provider,
          details: { provider },
        });
      }
    });

    return this.listProviderStatuses();
  }

  private async resolveProviderCredentials(): Promise<ResolvedCredentials> {
    const rows =
      await this.prisma.db.orm.public.ScraperProviderConfig.all();
    const dbMap = new Map(rows.map((r) => [r.provider, r]));
    const secretMaterial = this.getEncryptionMaterial();

    const readKey = (provider: SpecializedScraperProvider): string | undefined => {
      const dbRow = dbMap.get(provider);
      if (dbRow?.isEnabled && dbRow.apiKey) {
        try {
          const decrypted = decryptProviderSecret(
            dbRow.apiKey,
            secretMaterial
          ).trim();
          if (decrypted) return decrypted;
        } catch (err) {
          this.logger.warn(
            `Failed decrypting saved key for ${provider}: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
      }
      const envKey = this.getEnvKeyForProvider(provider);
      return envKey || undefined;
    };

    return {
      xBearerToken: readKey("x"),
      linkedinAccessToken: readKey("linkedin"),
      telegramBotToken: readKey("telegram"),
    };
  }

  async listJobsForProject(projectId: string): Promise<ScrapeJob[]> {
    await findFullProjectOrThrow(this.prisma, projectId);
    const jobs = await this.prisma.db.orm.public.ScrapeJob.where({ projectId })
      .orderBy((j) => j.createdAt.desc())
      .limit(25)
      .all();
    return jobs.map((job) => mapPrismaScrapeJobToDomain(job));
  }

  async getProjectScrapedData(
    projectId: string,
    opts?: { contextId?: string; jobId?: string }
  ): Promise<ProjectScrapedDataResponse> {
    const project = await findFullProjectOrThrow(this.prisma, projectId);

    if (opts?.contextId) {
      const exists = project.contexts.some((c) => c.id === opts.contextId);
      if (!exists) {
        throw new NotFoundException(
          `Context "${opts.contextId}" not found for project "${projectId}".`
        );
      }
    }

    const jobsQuery = opts?.contextId
      ? this.prisma.db.orm.public.ScrapeJob.where({
          projectId,
          contextId: opts.contextId,
        })
      : this.prisma.db.orm.public.ScrapeJob.where({ projectId });

    const jobRows = await jobsQuery
      .orderBy((j) => j.createdAt.desc())
      .limit(50)
      .all();

    const filteredJobRows = opts?.jobId
      ? jobRows.filter((j) => j.id === opts.jobId)
      : jobRows;

    const pagesQuery = opts?.jobId
      ? this.prisma.db.orm.public.ScrapedPage.where({
          projectId,
          scrapeJobId: opts.jobId,
        })
      : opts?.contextId
        ? this.prisma.db.orm.public.ScrapedPage.where({
            projectId,
            contextId: opts.contextId,
          })
        : this.prisma.db.orm.public.ScrapedPage.where({ projectId });

    const pageRows = await pagesQuery
      .orderBy([(p) => p.scrapedAt.desc(), (p) => p.depth.asc()])
      .limit(300)
      .all();

    return {
      projectId: project.id,
      projectName: project.name,
      contextId: opts?.contextId ?? null,
      jobs: filteredJobRows.map((job) => mapPrismaScrapeJobToDomain(job)),
      pages: pageRows.map(mapPrismaScrapedPageToDomain),
    };
  }

  private normalizeScrapeConfig(rawConfig?: TriggerScrapeDto): ScrapeConfig {
    return scrapeConfigSchema.parse({
      ...DEFAULT_SCRAPE_CONFIG,
      ...(rawConfig ?? {}),
    });
  }

  private computeScrapeTimeoutMs(config: ScrapeConfig, targetCount = 1): number {
    const baseEnvMs = this.config.get("SCRAPER_TIMEOUT_MS", { infer: true });
    const estimatedMs =
      config.timeoutSeconds *
        1000 *
        Math.min(config.maxPages, 6) *
        Math.min(targetCount, 3) +
      15000;
    return Math.min(Math.max(baseEnvMs, estimatedMs), 240_000);
  }

  async scrapeContext(
    projectId: string,
    contextId: string,
    rawConfig?: TriggerScrapeDto
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

    const effectiveConfig = this.normalizeScrapeConfig(rawConfig);
    const credentials = await this.resolveProviderCredentials();

    const pendingJob = await this.prisma.db.orm.public.ScrapeJob.create({
      projectId,
      contextId: ctx.id,
      targetType: ctx.type,
      targetValue: ctx.value,
      normalizedUrl: ctx.url,
      status: "running",
      attemptCount: 1,
      config: effectiveConfig as never,
    });

    await this.prisma.db.orm.public.ProjectContext.where({
      id: ctx.id,
    }).update({ scrapeStatus: "running" });

    await activateProjectOnActivity(this.prisma.db.orm, projectId, "Just now");

    try {
      const result = await this.callPythonScraper(
        "/api/v1/scrape",
        {
          targetType: ctx.type,
          targetValue: ctx.value,
          config: effectiveConfig,
          providerCredentials: credentials,
        },
        this.computeScrapeTimeoutMs(effectiveConfig, 1)
      );

      const parsed = scraperServiceResponseSchema.parse(result);
      const completedJob = await this.persistScrapeOutcome(
        pendingJob.id,
        ctx.id,
        projectId,
        ctx.summary,
        parsed,
        effectiveConfig
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
    projectId: string,
    rawConfig?: TriggerScrapeDto
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
      await activateProjectOnActivity(this.prisma.db.orm, projectId, "Just now");
      const project = await findFullProjectOrThrow(this.prisma, projectId);
      return { project, jobs: [] };
    }

    const effectiveConfig = this.normalizeScrapeConfig(rawConfig);
    const credentials = await this.resolveProviderCredentials();

    await activateProjectOnActivity(this.prisma.db.orm, projectId, "Just now");

    const targets = projectRecord.contexts.slice(0, 20);
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
        config: effectiveConfig as never,
      });
      await this.prisma.db.orm.public.ProjectContext.where({
        id: ctx.id,
      }).update({ scrapeStatus: "running" });
      pendingJobs.push(job);
    }

    try {
      const raw = await this.callPythonScraper(
        "/api/v1/scrape/batch",
        {
          config: effectiveConfig,
          providerCredentials: credentials,
          targets: targets.map((c) => ({
            targetType: c.type,
            targetValue: c.value,
          })),
        },
        this.computeScrapeTimeoutMs(effectiveConfig, targets.length)
      );

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
          outcome,
          effectiveConfig
        );
        completedJobs.push(saved);
      }

      const project = await findFullProjectOrThrow(this.prisma, projectId);
      return { project, jobs: completedJobs };
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : "Batch scraper error";
      for (let i = 0; i < pendingJobs.length; i++) {
        const job = pendingJobs[i];
        const ctx = targets[i];
        await this.prisma.db.orm.public.ScrapeJob.where({ id: job.id }).update({
          status: "failed",
          errorMessage: errMsg,
          completedAt: new Date(),
        });
        if (ctx) {
          await this.prisma.db.orm.public.ProjectContext.where({
            id: ctx.id,
          }).update({ scrapeStatus: "failed" });
        }
      }
      throw error;
    }
  }

  async persistScrapeOutcome(
    jobId: string,
    contextId: string,
    projectId: string,
    existingSummary: string | null,
    outcome: ScraperServiceResponse,
    configUsed?: ScrapeConfig
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
      ...(outcome.providerUsed ? { providerUsed: outcome.providerUsed } : {}),
      ...(outcome.specializedProvider !== undefined
        ? { specializedProvider: outcome.specializedProvider }
        : {}),
      requiresApiKey: outcome.requiresApiKey,
      apiKeyConfigured: outcome.apiKeyConfigured,
      levelsScraped: outcome.levelsScraped,
      pagesCount: outcome.pagesScraped || outcome.pages.length,
      contacts: outcome.contacts,
      lastJobId: jobId,
      ...(configUsed ? { configUsed } : {}),
      ...(outcome.platformData ? { platformData: outcome.platformData } : {}),
    };

    const nextSummary =
      outcome.reachable && outcome.summary
        ? outcome.summary
        : existingSummary ?? outcome.summary ?? null;

    const now = new Date();
    const { updatedJob, savedPages } = await this.prisma.db.transaction(
      async (tx) => {
        const job = await tx.orm.public.ScrapeJob.where({ id: jobId }).update({
          normalizedUrl: outcome.normalizedUrl ?? null,
          status: outcome.status,
          httpStatus: outcome.httpStatus ?? null,
          extractedTitle: outcome.title ?? null,
          extractedDescription: outcome.description ?? null,
          detectedSocials: outcome.socialLinks as never,
          detectedSignals: outcome.signals,
          rawPreview: outcome.rawPreview ?? null,
          errorMessage: outcome.errorReason ?? null,
          durationMs: outcome.durationMs ?? null,
          config: (configUsed ?? outcome.configUsed ?? null) as never,
          providerUsed: outcome.providerUsed ?? null,
          requiresApiKey: outcome.requiresApiKey,
          levelsScraped: outcome.levelsScraped,
          pagesScraped: outcome.pagesScraped || outcome.pages.length,
          platformData: (outcome.platformData ?? null) as never,
          completedAt: now,
        });

        let createdPageRows: ReturnType<typeof mapPrismaScrapedPageToDomain>[] =
          [];
        if (outcome.pages.length > 0) {
          const inserted = await tx.orm.public.ScrapedPage.createAll(
            outcome.pages.map((p) => ({
              projectId,
              contextId,
              scrapeJobId: jobId,
              url: p.url,
              canonicalUrl: p.canonicalUrl ?? null,
              parentUrl: p.parentUrl ?? null,
              depth: p.depth,
              httpStatus: p.httpStatus ?? null,
              contentType: p.contentType ?? null,
              renderMode: p.renderMode,
              title: p.title ?? null,
              description: p.description ?? null,
              language: p.language ?? null,
              headings: p.headings as never,
              textContent: p.textContent ? p.textContent.slice(0, 30000) : null,
              wordCount: p.wordCount,
              links: p.links as never,
              socialLinks: p.socialLinks as never,
              contacts: p.contacts,
              signals: p.signals,
              metaTags: p.metaTags as never,
              structuredData: p.structuredData as never,
              platformData: (p.platformData ?? null) as never,
              errorMessage: p.errorMessage ?? null,
              durationMs: p.durationMs ?? null,
              scrapedAt: now,
            }))
          );
          createdPageRows = inserted.map(mapPrismaScrapedPageToDomain);
        }

        await tx.orm.public.ProjectContext.where({ id: contextId }).update({
          scrapeStatus: outcome.status,
          lastScrapedAt: now,
          scrapedMetadata: metadataJson as never,
          summary: nextSummary,
          updatedAtLabel:
            outcome.status === "api_key_required"
              ? "API key needed"
              : "Just scraped",
        });

        const projectRow = await tx.orm.public.Project.select(
          "id",
          "businessStatus",
          "tags"
        )
          .where({ id: projectId })
          .first();

        const activityPatch = projectRow
          ? computeActivatedProjectPatch(projectRow, "Just now")
          : { lastActivityTime: "Just now" };

        await tx.orm.public.Project.where({ id: projectId }).update({
          lastScrapedAt: now,
          ...activityPatch,
        });

        return { updatedJob: job, savedPages: createdPageRows };
      }
    );

    if (!updatedJob) {
      throw new NotFoundException(`Scrape job "${jobId}" not found.`);
    }

    return mapPrismaScrapeJobToDomain(updatedJob, savedPages);
  }

  private async callPythonScraper(
    path: string,
    payload: unknown,
    timeoutOverrideMs?: number
  ): Promise<unknown> {
    const baseUrl = this.config
      .get("SCRAPER_SERVICE_URL", { infer: true })
      .replace(/\/$/, "");
    const apiKey = this.config.get("SCRAPER_API_KEY", { infer: true });
    const timeoutMs =
      timeoutOverrideMs ??
      this.config.get("SCRAPER_TIMEOUT_MS", { infer: true }) ??
      60000;

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
