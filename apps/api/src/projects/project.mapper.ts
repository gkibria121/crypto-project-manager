import { NotFoundException } from "@nestjs/common";
import type {
  Models,
  PulseDbClient,
  ResultType,
  Scalars,
} from "@repo/database";
import {
  projectPlatformRanksSchema,
  scrapeConfigSchema,
  scrapedHeadingSchema,
  scrapedLinkSchema,
  scrapedMetadataSchema,
  type CryptoProject,
  type ProjectChecklistItemState,
  type ScrapedPage,
  type ScrapeJob,
} from "@repo/shared";
import type { PrismaService } from "../prisma/prisma.service.js";

export function fullProjectQuery(orm: PulseDbClient["orm"]) {
  return orm.public.Project.include("contexts", (c) =>
    c.orderBy((ctx) => ctx.createdAt.asc())
  )
    .include("messages", (m) => m.orderBy((msg) => msg.createdAt.asc()))
    .include("checklistStates");
}

export type ProjectWithRelations = ResultType<
  ReturnType<typeof fullProjectQuery>
>;

export type PrismaScrapeJobRow = Scalars<Models.public_ScrapeJob>;
export type PrismaScrapedPageRow = Scalars<Models.public_ScrapedPage>;

export function mapPrismaProjectToDomain(
  project: ProjectWithRelations
): CryptoProject {
  const checklistState: Record<string, ProjectChecklistItemState> = {};
  for (const state of project.checklistStates) {
    checklistState[state.checklistItemId] = {
      checked: state.checked,
      scanResultNote: state.scanResultNote ?? undefined,
      scannedAt: state.scannedAtLabel ?? undefined,
    };
  }

  const parsedRanks = project.platformRanks
    ? projectPlatformRanksSchema.safeParse(project.platformRanks)
    : null;
  const platformRanks =
    parsedRanks?.success && Object.keys(parsedRanks.data).length > 0
      ? parsedRanks.data
      : undefined;

  return {
    id: project.id,
    name: project.name,
    ticker: project.ticker,
    chain: project.chain,
    stage: project.stage,
    businessStatus: project.businessStatus,
    avatarBg: project.avatarBg,
    logoUrl: project.logoUrl ?? undefined,
    tagline: project.tagline,
    campaignBudget: project.campaignBudget,
    sentimentScore: project.sentimentScore,
    ...(platformRanks ? { platformRanks } : {}),
    tags: [...project.tags],
    isPinned: project.isPinned,
    unreadInsights: project.unreadInsights,
    lastActivityTime: project.lastActivityTime,
    contexts: project.contexts.map((ctx) => {
      const parsedMeta = ctx.scrapedMetadata
        ? scrapedMetadataSchema.safeParse(ctx.scrapedMetadata)
        : null;
      return {
        id: ctx.id,
        type: ctx.type,
        title: ctx.title,
        value: ctx.value,
        url: ctx.url ?? undefined,
        summary: ctx.summary ?? undefined,
        isActive: ctx.isActive,
        updatedAt: ctx.updatedAtLabel,
        scrapeStatus: ctx.scrapeStatus ?? undefined,
        lastScrapedAt: ctx.lastScrapedAt?.toISOString(),
        scrapedMetadata: parsedMeta?.success ? parsedMeta.data : undefined,
      };
    }),
    messages: project.messages.map((msg) => {
      const meta = toPlainRecord<unknown>(msg.metadata);
      const provider =
        typeof meta?.["provider"] === "string" ? meta["provider"] : undefined;
      const mcpToolsUsed = Array.isArray(meta?.["mcpToolsUsed"])
        ? meta["mcpToolsUsed"].filter(
            (item): item is string => typeof item === "string"
          )
        : undefined;
      const resolvedTags = Array.isArray(meta?.["resolvedTags"])
        ? meta["resolvedTags"].filter(
            (item): item is string => typeof item === "string"
          )
        : undefined;
      return {
        id: msg.id,
        sender: msg.sender,
        content: msg.content,
        timestamp: msg.timestampLabel,
        usedContextIds: [...msg.usedContextIds],
        suggestedActions: [...msg.suggestedActions],
        appliedSystemPromptTitle: msg.appliedSystemPromptTitle ?? undefined,
        ...(msg.model ? { model: msg.model } : {}),
        ...(provider ? { provider } : {}),
        ...(mcpToolsUsed && mcpToolsUsed.length > 0 ? { mcpToolsUsed } : {}),
        ...(resolvedTags && resolvedTags.length > 0 ? { resolvedTags } : {}),
      };
    }),
    checklistState,
  };
}

function toPlainRecord<T>(val: unknown): Record<string, T> | undefined {
  if (!val || typeof val !== "object" || Array.isArray(val)) {
    return undefined;
  }
  return val as Record<string, T>;
}

export function mapPrismaScrapedPageToDomain(
  page: PrismaScrapedPageRow
): ScrapedPage {
  const headingsParsed = Array.isArray(page.headings)
    ? page.headings
        .map((item) => scrapedHeadingSchema.safeParse(item))
        .filter((r) => r.success)
        .map((r) => r.data)
    : [];

  const linksParsed = Array.isArray(page.links)
    ? page.links
        .map((item) => scrapedLinkSchema.safeParse(item))
        .filter((r) => r.success)
        .map((r) => r.data)
    : [];

  return {
    id: page.id,
    projectId: page.projectId,
    contextId: page.contextId,
    scrapeJobId: page.scrapeJobId,
    url: page.url,
    canonicalUrl: page.canonicalUrl ?? null,
    parentUrl: page.parentUrl ?? null,
    depth: page.depth,
    httpStatus: page.httpStatus ?? null,
    contentType: page.contentType ?? null,
    renderMode: page.renderMode,
    title: page.title ?? null,
    description: page.description ?? null,
    language: page.language ?? null,
    headings: headingsParsed,
    textContent: page.textContent ?? null,
    wordCount: page.wordCount,
    links: linksParsed,
    socialLinks: toPlainRecord<string>(page.socialLinks) ?? {},
    contacts: [...page.contacts],
    signals: [...page.signals],
    metaTags: toPlainRecord<string>(page.metaTags) ?? {},
    structuredData: Array.isArray(page.structuredData)
      ? page.structuredData
      : [],
    platformData: toPlainRecord<unknown>(page.platformData) ?? null,
    errorMessage: page.errorMessage ?? null,
    durationMs: page.durationMs ?? null,
    scrapedAt: page.scrapedAt.toISOString(),
  };
}

export function mapPrismaScrapeJobToDomain(
  job: PrismaScrapeJobRow,
  pages?: ScrapedPage[]
): ScrapeJob {
  const socials = toPlainRecord<string>(job.detectedSocials);
  const parsedConfig = job.config
    ? scrapeConfigSchema.partial().safeParse(job.config)
    : null;

  return {
    id: job.id,
    projectId: job.projectId,
    contextId: job.contextId ?? undefined,
    targetType: job.targetType,
    targetValue: job.targetValue,
    normalizedUrl: job.normalizedUrl ?? undefined,
    status: job.status,
    httpStatus: job.httpStatus ?? null,
    extractedTitle: job.extractedTitle ?? undefined,
    extractedDescription: job.extractedDescription ?? undefined,
    detectedSocials: socials,
    detectedSignals: [...job.detectedSignals],
    rawPreview: job.rawPreview ?? undefined,
    errorMessage: job.errorMessage ?? undefined,
    durationMs: job.durationMs ?? undefined,
    config: parsedConfig?.success ? parsedConfig.data : undefined,
    providerUsed: job.providerUsed ?? undefined,
    requiresApiKey: job.requiresApiKey,
    levelsScraped: job.levelsScraped,
    pagesScraped: job.pagesScraped,
    platformData: toPlainRecord<unknown>(job.platformData) ?? null,
    ...(pages ? { pages } : {}),
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt?.toISOString(),
  };
}

export async function findFullProjectOrThrow(
  prisma: PrismaService,
  projectId: string
): Promise<CryptoProject> {
  const project = await fullProjectQuery(prisma.db.orm)
    .where({ id: projectId })
    .first();

  if (!project) {
    throw new NotFoundException(`Project "${projectId}" not found.`);
  }

  return mapPrismaProjectToDomain(project);
}
