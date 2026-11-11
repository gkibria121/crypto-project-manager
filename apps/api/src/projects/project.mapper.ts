import { NotFoundException } from "@nestjs/common";
import type {
  Models,
  PulseDbClient,
  ResultType,
  Scalars,
} from "@repo/database";
import {
  scrapedMetadataSchema,
  type CryptoProject,
  type ProjectChecklistItemState,
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
    messages: project.messages.map((msg) => ({
      id: msg.id,
      sender: msg.sender,
      content: msg.content,
      timestamp: msg.timestampLabel,
      usedContextIds: [...msg.usedContextIds],
      suggestedActions: [...msg.suggestedActions],
      appliedSystemPromptTitle: msg.appliedSystemPromptTitle ?? undefined,
    })),
    checklistState,
  };
}

export function mapPrismaScrapeJobToDomain(job: PrismaScrapeJobRow): ScrapeJob {
  const socials =
    job.detectedSocials &&
    typeof job.detectedSocials === "object" &&
    !Array.isArray(job.detectedSocials)
      ? (job.detectedSocials as Record<string, string>)
      : undefined;

  return {
    id: job.id,
    projectId: job.projectId,
    contextId: job.contextId ?? undefined,
    targetType: job.targetType,
    targetValue: job.targetValue,
    normalizedUrl: job.normalizedUrl ?? undefined,
    status: job.status,
    extractedTitle: job.extractedTitle ?? undefined,
    extractedDescription: job.extractedDescription ?? undefined,
    detectedSocials: socials,
    detectedSignals: [...job.detectedSignals],
    rawPreview: job.rawPreview ?? undefined,
    errorMessage: job.errorMessage ?? undefined,
    durationMs: job.durationMs ?? undefined,
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
