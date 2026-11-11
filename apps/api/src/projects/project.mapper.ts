import { NotFoundException } from "@nestjs/common";
import {
  Prisma,
  ProjectStage as PrismaProjectStage,
  type ScrapeJob as PrismaScrapeJob,
} from "@repo/database";
import {
  scrapedMetadataSchema,
  type CryptoProject,
  type ProjectChecklistItemState,
  type ProjectStage,
  type ScrapeJob,
} from "@repo/shared";
import type { PrismaService } from "../prisma/prisma.service";

export const FULL_PROJECT_INCLUDE = {
  contexts: {
    orderBy: { createdAt: "asc" },
  },
  messages: {
    orderBy: { createdAt: "asc" },
  },
  checklistStates: true,
} satisfies Prisma.ProjectInclude;

export type ProjectWithRelations = Prisma.ProjectGetPayload<{
  include: typeof FULL_PROJECT_INCLUDE;
}>;

const PRISMA_TO_DOMAIN_STAGE: Record<PrismaProjectStage, ProjectStage> = {
  PRE_TGE: "Pre-TGE",
  MAINNET_LIVE: "Mainnet Live",
  IDO_LAUNCHPAD: "IDO / Launchpad",
  ECOSYSTEM_GROWTH: "Ecosystem Growth",
  STEALTH: "Stealth",
};

const DOMAIN_TO_PRISMA_STAGE: Record<ProjectStage, PrismaProjectStage> = {
  "Pre-TGE": PrismaProjectStage.PRE_TGE,
  "Mainnet Live": PrismaProjectStage.MAINNET_LIVE,
  "IDO / Launchpad": PrismaProjectStage.IDO_LAUNCHPAD,
  "Ecosystem Growth": PrismaProjectStage.ECOSYSTEM_GROWTH,
  Stealth: PrismaProjectStage.STEALTH,
};

export function toPrismaStage(stage: ProjectStage): PrismaProjectStage {
  return DOMAIN_TO_PRISMA_STAGE[stage];
}

export function toDomainStage(stage: PrismaProjectStage): ProjectStage {
  return PRISMA_TO_DOMAIN_STAGE[stage];
}

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
    stage: toDomainStage(project.stage),
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
      usedContextIds: msg.usedContextIds,
      suggestedActions: msg.suggestedActions,
      appliedSystemPromptTitle: msg.appliedSystemPromptTitle ?? undefined,
    })),
    checklistState,
  };
}

export function mapPrismaScrapeJobToDomain(job: PrismaScrapeJob): ScrapeJob {
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
    detectedSignals: job.detectedSignals,
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
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: FULL_PROJECT_INCLUDE,
  });

  if (!project) {
    throw new NotFoundException(`Project "${projectId}" not found.`);
  }

  return mapPrismaProjectToDomain(project);
}
