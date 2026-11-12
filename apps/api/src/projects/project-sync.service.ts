import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  SOLID_AVATAR_COLORS,
  SYNC_PROVIDERS,
  SYNC_PROVIDER_META,
  type ContextType,
  type CryptoProject,
  type ProjectChain,
  type ProjectStage,
  type SyncProjectsDto,
  type SyncProjectsResponse,
  type SyncProvider,
  type SyncProviderStatus,
} from "@repo/shared";
import { randomUUID } from "crypto";
import type { AuthenticatedUser } from "../auth/auth.decorators.js";
import type { AppEnv } from "../config/env.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  fullProjectQuery,
  mapPrismaProjectToDomain,
  type ProjectWithRelations,
} from "./project.mapper.js";

export interface NormalizedThirdPartyProject {
  externalId: string;
  name: string;
  symbol: string;
  slug: string;
  rank: number;
  marketCapUsd: number | null;
  priceUsd: number | null;
  changePercent24h: number | null;
  logoUrl: string | null;
  description: string | null;
  platformHint: string | null;
  websiteUrl: string | null;
  xHandle: string | null;
  linkedinUrl: string | null;
  telegramUrl: string | null;
}

function slugifyProjectName(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "crypto-project"
  );
}

function stripHtmlTags(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatCompactUsd(amount: number | null): string {
  if (amount === null || !Number.isFinite(amount) || amount <= 0) {
    return "N/A";
  }
  if (amount >= 1_000_000_000_000) {
    return `$${(amount / 1_000_000_000_000).toFixed(2)}T`;
  }
  if (amount >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toFixed(2)}B`;
  }
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(2)}M`;
  }
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

export function normalizeXHandle(
  raw: string | null | undefined,
  fallbackSlug: string
): { handle: string; url: string } {
  const cleanedFallback = fallbackSlug.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 15) || "project";
  if (!raw || !raw.trim()) {
    return {
      handle: `@${cleanedFallback}`,
      url: `https://x.com/${cleanedFallback}`,
    };
  }

  const trimmed = raw.trim();
  const urlMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/([A-Za-z0-9_]{1,30})/i
  );
  if (urlMatch?.[1]) {
    const handle = urlMatch[1];
    return {
      handle: `@${handle}`,
      url: `https://x.com/${handle}`,
    };
  }

  const bareHandle = trimmed.replace(/^@+/, "").replace(/[^A-Za-z0-9_]/g, "");
  if (bareHandle) {
    return {
      handle: `@${bareHandle}`,
      url: `https://x.com/${bareHandle}`,
    };
  }

  return {
    handle: `@${cleanedFallback}`,
    url: `https://x.com/${cleanedFallback}`,
  };
}

export function normalizeWebsiteUrl(
  raw: string | null | undefined,
  fallbackSlug: string
): { value: string; url: string } {
  if (raw && raw.trim()) {
    const trimmed = raw.trim();
    const url =
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`;
    return { value: url, url };
  }
  const fallbackUrl = `https://${fallbackSlug}.network`;
  return { value: fallbackUrl, url: fallbackUrl };
}

export function normalizeLinkedinUrl(
  raw: string | null | undefined,
  fallbackSlug: string
): { value: string; url: string } {
  if (raw && raw.trim()) {
    const trimmed = raw.trim();
    const url =
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed.replace(/^\/+/, "")}`;
    const displayValue = url.replace(/^https?:\/\/(www\.)?/i, "");
    return { value: displayValue, url };
  }
  const value = `linkedin.com/company/${fallbackSlug}`;
  return {
    value,
    url: `https://www.${value}`,
  };
}

export function inferProjectChain(
  platformHint: string | null | undefined,
  symbol: string,
  name: string
): ProjectChain {
  const combined = `${platformHint ?? ""} ${symbol} ${name}`.toLowerCase();
  if (
    combined.includes("solana") ||
    symbol.toUpperCase() === "SOL" ||
    combined.includes("spl")
  ) {
    return "Solana";
  }
  if (combined.includes("base") || symbol.toUpperCase() === "BASE") {
    return "Base";
  }
  if (
    combined.includes("arbitrum") ||
    symbol.toUpperCase() === "ARB"
  ) {
    return "Arbitrum";
  }
  if (
    combined.includes("sui") ||
    symbol.toUpperCase() === "SUI" ||
    combined.includes("move")
  ) {
    return "Sui";
  }
  if (
    combined.includes("ethereum") ||
    combined.includes("erc20") ||
    combined.includes("optimism") ||
    combined.includes("polygon") ||
    combined.includes("zksync") ||
    symbol.toUpperCase() === "ETH"
  ) {
    return "Ethereum L2";
  }
  return "Monad / EVM";
}

function inferCampaignBudget(marketCapUsd: number | null): string {
  if (marketCapUsd !== null && marketCapUsd >= 10_000_000_000) {
    return "$50,000 / mo";
  }
  if (marketCapUsd !== null && marketCapUsd >= 1_000_000_000) {
    return "$35,000 / mo";
  }
  return "$25,000 / mo";
}

function inferSentimentScore(changePercent24h: number | null): number {
  if (changePercent24h === null || !Number.isFinite(changePercent24h)) {
    return 88;
  }
  const score = Math.round(85 + changePercent24h * 0.7);
  return Math.max(60, Math.min(98, score));
}

function firstValidUrl(candidates: unknown): string | null {
  if (!Array.isArray(candidates)) return null;
  for (const item of candidates) {
    if (typeof item === "string" && item.trim().length > 0) {
      return item.trim();
    }
  }
  return null;
}

function findUrlMatchingDomain(
  candidates: unknown[],
  domainSubstring: string
): string | null {
  for (const item of candidates) {
    if (
      typeof item === "string" &&
      item.toLowerCase().includes(domainSubstring.toLowerCase())
    ) {
      return item.trim();
    }
  }
  return null;
}

@Injectable()
export class ProjectSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppEnv, true>
  ) {}

  listProvidersStatus(): SyncProviderStatus[] {
    return SYNC_PROVIDERS.map((providerId) => {
      const meta = SYNC_PROVIDER_META[providerId];
      const apiKey = this.getProviderApiKey(providerId);
      return {
        id: providerId,
        name: meta.label,
        envVar: meta.envVar,
        apiBaseUrl: meta.apiBaseUrl,
        configured: Boolean(apiKey && apiKey.trim().length > 0),
      };
    });
  }

  getProviderApiKey(provider: SyncProvider): string {
    switch (provider) {
      case "coingecko":
        return (
          this.config.get("COINGECKO_API_KEY", { infer: true }) ??
          process.env["COINGECKO_API_KEY"] ??
          ""
        ).trim();
      case "coinmarketcap":
        return (
          this.config.get("COINMARKETCAP_API_KEY", { infer: true }) ??
          process.env["COINMARKETCAP_API_KEY"] ??
          ""
        ).trim();
      case "livecoinwatch":
        return (
          this.config.get("LIVECOINWATCH_API_KEY", { infer: true }) ??
          process.env["LIVECOINWATCH_API_KEY"] ??
          ""
        ).trim();
      case "coincap":
        return (
          this.config.get("COINCAP_API_KEY", { infer: true }) ??
          process.env["COINCAP_API_KEY"] ??
          ""
        ).trim();
    }
  }

  requireProviderApiKey(provider: SyncProvider): string {
    const meta = SYNC_PROVIDER_META[provider];
    const apiKey = this.getProviderApiKey(provider);
    if (!apiKey) {
      throw new BadRequestException(
        `API key is not given for provider "${meta.shortLabel}". Please define ${meta.envVar} in your .env file.`
      );
    }
    return apiKey;
  }

  async syncFromProvider(
    dto: SyncProjectsDto,
    actor?: AuthenticatedUser,
    fetchImpl: typeof fetch = fetch
  ): Promise<SyncProjectsResponse> {
    const provider = dto.provider;
    const limit = dto.limit ?? 5;
    const meta = SYNC_PROVIDER_META[provider];
    const apiKey = this.requireProviderApiKey(provider);

    const existingProjects = await fullProjectQuery(this.prisma.db.orm)
      .orderBy((p) => p.createdAt.desc())
      .all();

    const existingByTicker = new Map<string, ProjectWithRelations>();
    const existingByName = new Map<string, ProjectWithRelations>();

    for (const proj of existingProjects) {
      const tickerKey = proj.ticker.replace(/^\$/, "").toUpperCase();
      const nameKey = proj.name.trim().toLowerCase();
      if (tickerKey && !existingByTicker.has(tickerKey)) {
        existingByTicker.set(tickerKey, proj);
      }
      if (nameKey && !existingByName.has(nameKey)) {
        existingByName.set(nameKey, proj);
      }
    }

    const existingTickers = new Set(existingByTicker.keys());
    const existingNames = new Set(existingByName.keys());

    const fetchCandidateCount = Math.min(Math.max(limit * 2, 10), 40);

    let candidates: NormalizedThirdPartyProject[];
    switch (provider) {
      case "coingecko":
        candidates = await this.fetchFromCoinGecko(
          apiKey,
          fetchCandidateCount,
          limit,
          existingTickers,
          existingNames,
          fetchImpl
        );
        break;
      case "coinmarketcap":
        candidates = await this.fetchFromCoinMarketCap(
          apiKey,
          fetchCandidateCount,
          fetchImpl
        );
        break;
      case "livecoinwatch":
        candidates = await this.fetchFromLiveCoinWatch(
          apiKey,
          fetchCandidateCount,
          fetchImpl
        );
        break;
      case "coincap":
        candidates = await this.fetchFromCoinCap(
          apiKey,
          fetchCandidateCount,
          fetchImpl
        );
        break;
    }

    let skippedCount = 0;
    const toCreate: NormalizedThirdPartyProject[] = [];
    const toUpdate: Array<{
      existing: ProjectWithRelations;
      candidate: NormalizedThirdPartyProject;
    }> = [];
    const seenUpdatedIds = new Set<string>();

    for (const candidate of candidates) {
      const normalizedSymbol = candidate.symbol
        .replace(/^\$/, "")
        .toUpperCase()
        .slice(0, 11);
      const normalizedName = candidate.name.trim().toLowerCase();

      if (!normalizedSymbol) {
        skippedCount += 1;
        continue;
      }

      const existingMatch =
        existingByTicker.get(normalizedSymbol) ??
        existingByName.get(normalizedName);

      if (existingMatch) {
        if (!seenUpdatedIds.has(existingMatch.id)) {
          seenUpdatedIds.add(existingMatch.id);
          toUpdate.push({ existing: existingMatch, candidate });
        } else {
          skippedCount += 1;
        }
        continue;
      }

      if (
        existingTickers.has(normalizedSymbol) ||
        existingNames.has(normalizedName)
      ) {
        skippedCount += 1;
        continue;
      }

      if (toCreate.length >= limit) {
        continue;
      }

      existingTickers.add(normalizedSymbol);
      existingNames.add(normalizedName);
      toCreate.push(candidate);
    }

    const createdProjectIds: string[] = [];
    const updatedProjectIds: string[] = [];
    const baseTime = Date.now();

    if (toCreate.length > 0 || toUpdate.length > 0) {
      await this.prisma.db.transaction(async (tx) => {
        // 1. Update existing DB projects with latest provider data
        for (let idx = 0; idx < toUpdate.length; idx++) {
          const { existing, candidate: item } = toUpdate[idx];
          const suffix = randomUUID().slice(0, 8);
          const itemTime = baseTime + idx * 50;
          const cleanSymbol = item.symbol
            .replace(/^\$/, "")
            .toUpperCase()
            .slice(0, 11);
          const cleanTicker = `$${cleanSymbol}`;
          const slug = item.slug || slugifyProjectName(item.name);
          const mcapLabel = formatCompactUsd(item.marketCapUsd);
          const sentimentScore = inferSentimentScore(item.changePercent24h);

          const rawSummary = item.description
            ? stripHtmlTags(item.description).slice(0, 140)
            : existing.tagline;
          const nextTagline =
            item.marketCapUsd && item.marketCapUsd > 0
              ? `Rank #${item.rank} (${mcapLabel} Market Cap) — ${rawSummary}`
              : existing.tagline || rawSummary;

          const mergedTags = Array.from(
            new Set([
              ...(existing.businessStatus === "new" ? ["new"] : []),
              ...existing.tags,
              provider,
            ])
          );

          await tx.orm.public.Project.where({ id: existing.id }).update({
            logoUrl: item.logoUrl || existing.logoUrl || null,
            tagline: nextTagline,
            sentimentScore,
            tags: mergedTags,
            lastActivityTime: "Now",
          });

          const websiteCtx = normalizeWebsiteUrl(item.websiteUrl, slug);
          const xCtx = normalizeXHandle(item.xHandle, slug);
          const linkedinCtx = normalizeLinkedinUrl(item.linkedinUrl, slug);

          const existingWeb = existing.contexts.find(
            (c) => c.type === "website"
          );
          if (!existingWeb) {
            await tx.orm.public.ProjectContext.create({
              id: `ctx-${itemTime}-web-${suffix}`,
              projectId: existing.id,
              type: "website",
              title: "Official Website",
              value: websiteCtx.value,
              url: websiteCtx.url,
              summary: `Official website for ${existing.name} (${cleanTicker}) synced via ${meta.shortLabel}.`,
              isActive: true,
              updatedAtLabel: "Now",
              createdAt: new Date(itemTime),
            });
          } else if (item.websiteUrl && item.websiteUrl.trim()) {
            await tx.orm.public.ProjectContext.where({
              id: existingWeb.id,
            }).update({
              value: websiteCtx.value,
              url: websiteCtx.url,
              updatedAtLabel: "Now",
            });
          }

          const existingX = existing.contexts.find(
            (c) => c.type === "x_handle"
          );
          if (!existingX) {
            await tx.orm.public.ProjectContext.create({
              id: `ctx-${itemTime}-x-${suffix}`,
              projectId: existing.id,
              type: "x_handle",
              title: "Official X",
              value: xCtx.handle,
              url: xCtx.url,
              summary: `Official X (Twitter) channel (${xCtx.handle}) synced via ${meta.shortLabel}.`,
              isActive: true,
              updatedAtLabel: "Now",
              createdAt: new Date(itemTime + 10),
            });
          } else if (item.xHandle && item.xHandle.trim()) {
            await tx.orm.public.ProjectContext.where({
              id: existingX.id,
            }).update({
              value: xCtx.handle,
              url: xCtx.url,
              updatedAtLabel: "Now",
            });
          }

          const existingLinkedin = existing.contexts.find(
            (c) => c.type === "linkedin"
          );
          if (!existingLinkedin) {
            await tx.orm.public.ProjectContext.create({
              id: `ctx-${itemTime}-li-${suffix}`,
              projectId: existing.id,
              type: "linkedin",
              title: "LinkedIn",
              value: linkedinCtx.value,
              url: linkedinCtx.url,
              summary: `Company LinkedIn profile for ${existing.name} synced via ${meta.shortLabel}.`,
              isActive: true,
              updatedAtLabel: "Now",
              createdAt: new Date(itemTime + 20),
            });
          } else if (item.linkedinUrl && item.linkedinUrl.trim()) {
            await tx.orm.public.ProjectContext.where({
              id: existingLinkedin.id,
            }).update({
              value: linkedinCtx.value,
              url: linkedinCtx.url,
              updatedAtLabel: "Now",
            });
          }

          if (item.telegramUrl && item.telegramUrl.trim()) {
            const rawTg = item.telegramUrl.trim();
            const tgUrl =
              rawTg.startsWith("http://") || rawTg.startsWith("https://")
                ? rawTg
                : rawTg.startsWith("t.me/")
                  ? `https://${rawTg}`
                  : `https://t.me/${rawTg.replace(/^@/, "")}`;
            const existingTg = existing.contexts.find(
              (c) => c.type === "telegram"
            );
            if (!existingTg) {
              await tx.orm.public.ProjectContext.create({
                id: `ctx-${itemTime}-tg-${suffix}`,
                projectId: existing.id,
                type: "telegram",
                title: "Telegram Community",
                value: rawTg,
                url: tgUrl,
                summary: `Official Telegram community synced via ${meta.shortLabel}.`,
                isActive: true,
                updatedAtLabel: "Now",
                createdAt: new Date(itemTime + 25),
              });
            } else {
              await tx.orm.public.ProjectContext.where({
                id: existingTg.id,
              }).update({
                value: rawTg,
                url: tgUrl,
                updatedAtLabel: "Now",
              });
            }
          }

          const priceDisplay =
            item.priceUsd !== null && Number.isFinite(item.priceUsd)
              ? `$${item.priceUsd >= 1 ? item.priceUsd.toFixed(2) : item.priceUsd.toPrecision(4)}`
              : "N/A";
          const changeDisplay =
            item.changePercent24h !== null &&
            Number.isFinite(item.changePercent24h)
              ? `${item.changePercent24h >= 0 ? "+" : ""}${item.changePercent24h.toFixed(2)}%`
              : "N/A";
          const mcapValue = `Provider: ${meta.shortLabel} • Market Cap Rank: #${item.rank} • Market Cap: ${mcapLabel} • Price: ${priceDisplay} (24h: ${changeDisplay}). ${rawSummary}`;

          const existingMcapCtx = existing.contexts.find(
            (c) =>
              c.type === "message" &&
              c.title === "Market Cap & Sync Intelligence"
          );
          if (existingMcapCtx) {
            await tx.orm.public.ProjectContext.where({
              id: existingMcapCtx.id,
            }).update({
              value: mcapValue,
              summary: `Market capitalization telemetry synced from ${meta.label}.`,
              updatedAtLabel: "Now",
            });
          } else {
            await tx.orm.public.ProjectContext.create({
              id: `ctx-${itemTime}-mcap-${suffix}`,
              projectId: existing.id,
              type: "message",
              title: "Market Cap & Sync Intelligence",
              value: mcapValue,
              url: null,
              summary: `Market capitalization telemetry synced from ${meta.label}.`,
              isActive: true,
              updatedAtLabel: "Now",
              createdAt: new Date(itemTime + 30),
            });
          }

          updatedProjectIds.push(existing.id);
        }

        // 2. Create missing projects in DB and tag them "new"
        for (let idx = 0; idx < toCreate.length; idx++) {
          const item = toCreate[idx];
          const suffix = randomUUID().slice(0, 8);
          const itemTime = baseTime + 5000 + idx * 100;
          const projectId = `proj-sync-${itemTime}-${suffix}`;
          const cleanSymbol = item.symbol
            .replace(/^\$/, "")
            .toUpperCase()
            .slice(0, 11);
          const cleanTicker = `$${cleanSymbol}`;
          const slug = item.slug || slugifyProjectName(item.name);
          const chain = inferProjectChain(
            item.platformHint,
            cleanSymbol,
            item.name
          );
          const stage: ProjectStage =
            item.rank > 50 ? "Ecosystem Growth" : "Mainnet Live";
          const avatarBg =
            SOLID_AVATAR_COLORS[idx % SOLID_AVATAR_COLORS.length];
          const campaignBudget = inferCampaignBudget(item.marketCapUsd);
          const sentimentScore = inferSentimentScore(item.changePercent24h);
          const mcapLabel = formatCompactUsd(item.marketCapUsd);

          const rawSummary = item.description
            ? stripHtmlTags(item.description).slice(0, 140)
            : `${item.name} (${cleanTicker}) on ${chain}`;
          const tagline =
            item.marketCapUsd && item.marketCapUsd > 0
              ? `Rank #${item.rank} (${mcapLabel} Market Cap) — ${rawSummary}`
              : rawSummary;

          const websiteCtx = normalizeWebsiteUrl(item.websiteUrl, slug);
          const xCtx = normalizeXHandle(item.xHandle, slug);
          const linkedinCtx = normalizeLinkedinUrl(item.linkedinUrl, slug);

          const contextCreates: Array<{
            id: string;
            projectId: string;
            type: ContextType;
            title: string;
            value: string;
            url: string | null;
            summary: string | null;
            isActive: boolean;
            updatedAtLabel: string;
            createdAt: Date;
          }> = [
            {
              id: `ctx-${itemTime}-web-${suffix}`,
              projectId,
              type: "website",
              title: "Official Website",
              value: websiteCtx.value,
              url: websiteCtx.url,
              summary: `Official website for ${item.name} (${cleanTicker}) synced via ${meta.shortLabel}.`,
              isActive: true,
              updatedAtLabel: "Now",
              createdAt: new Date(itemTime),
            },
            {
              id: `ctx-${itemTime}-x-${suffix}`,
              projectId,
              type: "x_handle",
              title: "Official X",
              value: xCtx.handle,
              url: xCtx.url,
              summary: `Official X (Twitter) channel (${xCtx.handle}) synced via ${meta.shortLabel}.`,
              isActive: true,
              updatedAtLabel: "Now",
              createdAt: new Date(itemTime + 10),
            },
            {
              id: `ctx-${itemTime}-li-${suffix}`,
              projectId,
              type: "linkedin",
              title: "LinkedIn",
              value: linkedinCtx.value,
              url: linkedinCtx.url,
              summary: `Company LinkedIn profile for ${item.name} synced via ${meta.shortLabel}.`,
              isActive: true,
              updatedAtLabel: "Now",
              createdAt: new Date(itemTime + 20),
            },
          ];

          if (item.telegramUrl && item.telegramUrl.trim()) {
            const rawTg = item.telegramUrl.trim();
            const tgUrl =
              rawTg.startsWith("http://") || rawTg.startsWith("https://")
                ? rawTg
                : rawTg.startsWith("t.me/")
                  ? `https://${rawTg}`
                  : `https://t.me/${rawTg.replace(/^@/, "")}`;
            contextCreates.push({
              id: `ctx-${itemTime}-tg-${suffix}`,
              projectId,
              type: "telegram",
              title: "Telegram Community",
              value: rawTg,
              url: tgUrl,
              summary: `Official Telegram community synced via ${meta.shortLabel}.`,
              isActive: true,
              updatedAtLabel: "Now",
              createdAt: new Date(itemTime + 25),
            });
          }

          const priceDisplay =
            item.priceUsd !== null && Number.isFinite(item.priceUsd)
              ? `$${item.priceUsd >= 1 ? item.priceUsd.toFixed(2) : item.priceUsd.toPrecision(4)}`
              : "N/A";
          const changeDisplay =
            item.changePercent24h !== null &&
            Number.isFinite(item.changePercent24h)
              ? `${item.changePercent24h >= 0 ? "+" : ""}${item.changePercent24h.toFixed(2)}%`
              : "N/A";

          contextCreates.push({
            id: `ctx-${itemTime}-mcap-${suffix}`,
            projectId,
            type: "message",
            title: "Market Cap & Sync Intelligence",
            value: `Provider: ${meta.shortLabel} • Market Cap Rank: #${item.rank} • Market Cap: ${mcapLabel} • Price: ${priceDisplay} (24h: ${changeDisplay}). ${rawSummary}`,
            url: null,
            summary: `Market capitalization telemetry imported from ${meta.label}.`,
            isActive: true,
            updatedAtLabel: "Now",
            createdAt: new Date(itemTime + 30),
          });

          const projectTags = Array.from(
            new Set([
              "new",
              chain.toLowerCase(),
              stage.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
              provider,
            ])
          );

          await tx.orm.public.Project.create({
            id: projectId,
            name: item.name,
            ticker: cleanTicker,
            chain,
            stage,
            businessStatus: "new",
            avatarBg,
            logoUrl: item.logoUrl || null,
            tagline,
            campaignBudget,
            sentimentScore,
            tags: projectTags,
            isPinned: false,
            unreadInsights: 1,
            lastActivityTime: "Now",
            archivedAt: null,
          });

          await tx.orm.public.ProjectContext.createAll(contextCreates);

          await tx.orm.public.ChatMessage.create({
            id: `msg-${itemTime}-${suffix}`,
            projectId,
            sender: "ai",
            content: `Synced **${item.name} (${cleanTicker})** from **${meta.shortLabel}** into **New** status and tagged **\`new\`** with **${contextCreates.length} active contexts** (Website: \`${websiteCtx.url}\`, X: \`${xCtx.handle}\`, LinkedIn: \`${linkedinCtx.value}\`).`,
            timestampLabel: "Now",
            usedContextIds: contextCreates.map((c) => c.id),
            suggestedActions: [],
            model: "pulseos-engine",
          });

          createdProjectIds.push(projectId);
        }

        if (actor) {
          await tx.orm.public.AuditLog.create({
            id: `aud-${Date.now()}-${randomUUID().slice(0, 8)}`,
            actorId: actor.id,
            actorEmail: actor.email,
            actorRole: actor.role,
            action: "projects.synced",
            resource: "project",
            resourceId: createdProjectIds[0] ?? updatedProjectIds[0] ?? null,
            details: {
              provider,
              providerName: meta.shortLabel,
              syncedCount: createdProjectIds.length,
              updatedCount: updatedProjectIds.length,
              skippedCount,
            },
            ipAddress: null,
          });
        }
      });
    }

    const updatedRows = await fullProjectQuery(this.prisma.db.orm)
      .orderBy((p) => p.createdAt.desc())
      .all();

    const allProjects: CryptoProject[] = [...updatedRows]
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned))
      .map(mapPrismaProjectToDomain);

    const createdProjects = allProjects.filter((p) =>
      createdProjectIds.includes(p.id)
    );
    const updatedProjects = allProjects.filter((p) =>
      updatedProjectIds.includes(p.id)
    );

    let message: string;
    if (createdProjects.length > 0 && updatedProjects.length > 0) {
      message = `Added ${createdProjects.length} new ${createdProjects.length === 1 ? "project" : "projects"} (tagged "new") and synced ${updatedProjects.length} existing ${updatedProjects.length === 1 ? "project" : "projects"} from ${meta.shortLabel}.`;
    } else if (createdProjects.length > 0) {
      message = `Added ${createdProjects.length} new crypto ${createdProjects.length === 1 ? "project" : "projects"} from ${meta.shortLabel} into New status and tagged "new".`;
    } else if (updatedProjects.length > 0) {
      message = `Synced latest market data and context links for ${updatedProjects.length} existing ${updatedProjects.length === 1 ? "project" : "projects"} from ${meta.shortLabel} (no new projects found).`;
    } else {
      message = `No projects returned by ${meta.shortLabel} to sync.`;
    }

    return {
      provider,
      providerName: meta.shortLabel,
      syncedCount: createdProjects.length,
      updatedCount: updatedProjects.length,
      skippedCount,
      createdProjects,
      updatedProjects,
      projects: allProjects,
      message,
    };
  }

  private async fetchFromCoinGecko(
    apiKey: string,
    perPage: number,
    targetNewLimit: number,
    existingTickers: Set<string>,
    existingNames: Set<string>,
    fetchImpl: typeof fetch
  ): Promise<NormalizedThirdPartyProject[]> {
    const marketsUrl = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=1&sparkline=false`;
    const headers: Record<string, string> = {
      Accept: "application/json",
      "x-cg-demo-api-key": apiKey,
    };

    const response = await this.performProviderFetch(
      "CoinGecko",
      marketsUrl,
      { method: "GET", headers },
      fetchImpl
    );

    if (!Array.isArray(response)) {
      throw new BadGatewayException(
        "CoinGecko API returned an unexpected payload format."
      );
    }

    const results: NormalizedThirdPartyProject[] = [];
    let detailFetchCount = 0;

    for (let i = 0; i < response.length; i++) {
      const row = response[i] as Record<string, unknown>;
      const id = String(row["id"] ?? `cg-${i}`);
      const name = String(row["name"] ?? "").trim();
      const symbol = String(row["symbol"] ?? "").trim().toUpperCase();
      if (!name || !symbol) continue;

      const slug = slugifyProjectName(id || name);
      const rank =
        typeof row["market_cap_rank"] === "number"
          ? row["market_cap_rank"]
          : i + 1;
      const marketCapUsd =
        typeof row["market_cap"] === "number" ? row["market_cap"] : null;
      const priceUsd =
        typeof row["current_price"] === "number" ? row["current_price"] : null;
      const changePercent24h =
        typeof row["price_change_percentage_24h"] === "number"
          ? row["price_change_percentage_24h"]
          : null;
      const logoUrl =
        typeof row["image"] === "string" && row["image"].trim()
          ? row["image"].trim()
          : null;

      let websiteUrl: string | null = null;
      let xHandle: string | null = null;
      let linkedinUrl: string | null = null;
      let telegramUrl: string | null = null;
      let description: string | null = null;
      let platformHint: string | null = null;

      const isAlreadyExisting =
        existingTickers.has(symbol.slice(0, 11)) ||
        existingNames.has(name.toLowerCase());

      if (!isAlreadyExisting && detailFetchCount < targetNewLimit) {
        detailFetchCount += 1;
        try {
          const detailUrl = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`;
          const detail = (await this.performProviderFetch(
            "CoinGecko",
            detailUrl,
            { method: "GET", headers },
            fetchImpl
          )) as Record<string, unknown>;

          if (detail && typeof detail === "object") {
            if (typeof detail["asset_platform_id"] === "string") {
              platformHint = detail["asset_platform_id"];
            }
            const descObj = detail["description"] as
              | Record<string, unknown>
              | undefined;
            if (descObj && typeof descObj["en"] === "string") {
              description = descObj["en"];
            }
            const links = detail["links"] as
              | Record<string, unknown>
              | undefined;
            if (links && typeof links === "object") {
              websiteUrl = firstValidUrl(links["homepage"]);
              if (
                typeof links["twitter_screen_name"] === "string" &&
                links["twitter_screen_name"].trim()
              ) {
                xHandle = links["twitter_screen_name"].trim();
              }
              if (
                typeof links["telegram_channel_identifier"] === "string" &&
                links["telegram_channel_identifier"].trim()
              ) {
                telegramUrl = `https://t.me/${links["telegram_channel_identifier"].trim()}`;
              }
              const forumUrls = Array.isArray(links["official_forum_url"])
                ? links["official_forum_url"]
                : [];
              const chatUrls = Array.isArray(links["chat_url"])
                ? links["chat_url"]
                : [];
              linkedinUrl = findUrlMatchingDomain(
                [...forumUrls, ...chatUrls],
                "linkedin.com"
              );
            }
          }
        } catch {
          // Gracefully continue with market listing metadata if detail lookup fails
        }
      }

      results.push({
        externalId: id,
        name,
        symbol,
        slug,
        rank,
        marketCapUsd,
        priceUsd,
        changePercent24h,
        logoUrl,
        description,
        platformHint,
        websiteUrl,
        xHandle,
        linkedinUrl,
        telegramUrl,
      });
    }

    return results;
  }

  private async fetchFromCoinMarketCap(
    apiKey: string,
    limit: number,
    fetchImpl: typeof fetch
  ): Promise<NormalizedThirdPartyProject[]> {
    const listingsUrl = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?start=1&limit=${limit}&convert=USD`;
    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-CMC_PRO_API_KEY": apiKey,
    };

    const payload = (await this.performProviderFetch(
      "CoinMarketCap",
      listingsUrl,
      { method: "GET", headers },
      fetchImpl
    )) as Record<string, unknown>;

    const dataRows = Array.isArray(payload?.["data"])
      ? (payload["data"] as Array<Record<string, unknown>>)
      : null;

    if (!dataRows) {
      throw new BadGatewayException(
        "CoinMarketCap API returned an unexpected payload format."
      );
    }

    const ids = dataRows
      .map((r) => r["id"])
      .filter((id): id is number | string => id !== undefined && id !== null)
      .map(String);

    let infoMap: Record<string, Record<string, unknown>> = {};
    if (ids.length > 0) {
      try {
        const infoUrl = `https://pro-api.coinmarketcap.com/v2/cryptocurrency/info?id=${encodeURIComponent(ids.join(","))}`;
        const infoPayload = (await this.performProviderFetch(
          "CoinMarketCap",
          infoUrl,
          { method: "GET", headers },
          fetchImpl
        )) as Record<string, unknown>;
        if (
          infoPayload?.["data"] &&
          typeof infoPayload["data"] === "object"
        ) {
          infoMap = infoPayload["data"] as Record<
            string,
            Record<string, unknown>
          >;
        }
      } catch {
        // Proceed with listings data if info call is unavailable
      }
    }

    const results: NormalizedThirdPartyProject[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const id = String(row["id"] ?? i + 1);
      const name = String(row["name"] ?? "").trim();
      const symbol = String(row["symbol"] ?? "").trim().toUpperCase();
      if (!name || !symbol) continue;

      const slug =
        typeof row["slug"] === "string" && row["slug"].trim()
          ? row["slug"].trim()
          : slugifyProjectName(name);
      const rank =
        typeof row["cmc_rank"] === "number" ? row["cmc_rank"] : i + 1;

      const platformObj = row["platform"] as
        | Record<string, unknown>
        | null
        | undefined;
      const platformHint =
        platformObj && typeof platformObj["name"] === "string"
          ? platformObj["name"]
          : null;

      const quoteObj = row["quote"] as Record<string, unknown> | undefined;
      const usdQuote = quoteObj?.["USD"] as
        | Record<string, unknown>
        | undefined;
      const marketCapUsd =
        typeof usdQuote?.["market_cap"] === "number"
          ? usdQuote["market_cap"]
          : null;
      const priceUsd =
        typeof usdQuote?.["price"] === "number" ? usdQuote["price"] : null;
      const changePercent24h =
        typeof usdQuote?.["percent_change_24h"] === "number"
          ? usdQuote["percent_change_24h"]
          : null;

      const info = infoMap[id];
      const logoUrl =
        info && typeof info["logo"] === "string" ? info["logo"] : null;
      const description =
        info && typeof info["description"] === "string"
          ? info["description"]
          : null;

      const urls = info?.["urls"] as Record<string, unknown> | undefined;
      const websiteUrl = urls ? firstValidUrl(urls["website"]) : null;
      const twitterUrl = urls ? firstValidUrl(urls["twitter"]) : null;
      const chatUrls = Array.isArray(urls?.["chat"]) ? urls["chat"] : [];
      const messageBoards = Array.isArray(urls?.["message_board"])
        ? urls["message_board"]
        : [];
      const linkedinUrl = findUrlMatchingDomain(
        [...messageBoards, ...chatUrls],
        "linkedin.com"
      );
      const telegramUrl = findUrlMatchingDomain(chatUrls, "t.me");

      results.push({
        externalId: id,
        name,
        symbol,
        slug,
        rank,
        marketCapUsd,
        priceUsd,
        changePercent24h,
        logoUrl,
        description,
        platformHint,
        websiteUrl,
        xHandle: twitterUrl,
        linkedinUrl,
        telegramUrl,
      });
    }

    return results;
  }

  private async fetchFromLiveCoinWatch(
    apiKey: string,
    limit: number,
    fetchImpl: typeof fetch
  ): Promise<NormalizedThirdPartyProject[]> {
    const url = "https://api.livecoinwatch.com/coins/list";
    const response = await this.performProviderFetch(
      "LiveCoinWatch",
      url,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          currency: "USD",
          sort: "rank",
          order: "ascending",
          offset: 0,
          limit,
          meta: true,
        }),
      },
      fetchImpl
    );

    if (!Array.isArray(response)) {
      throw new BadGatewayException(
        "LiveCoinWatch API returned an unexpected payload format."
      );
    }

    const results: NormalizedThirdPartyProject[] = [];

    for (let i = 0; i < response.length; i++) {
      const row = response[i] as Record<string, unknown>;
      const code = String(row["code"] ?? "")
        .replace(/^_+/, "")
        .trim()
        .toUpperCase();
      const name = String(row["name"] ?? code).trim();
      if (!name || !code) continue;

      const slug = slugifyProjectName(name);
      const rank = typeof row["rank"] === "number" ? row["rank"] : i + 1;
      const marketCapUsd =
        typeof row["cap"] === "number" ? row["cap"] : null;
      const priceUsd = typeof row["rate"] === "number" ? row["rate"] : null;

      const deltaObj = row["delta"] as Record<string, unknown> | undefined;
      const changePercent24h =
        deltaObj && typeof deltaObj["day"] === "number"
          ? (deltaObj["day"] - 1) * 100
          : null;

      const logoUrl =
        typeof row["png64"] === "string"
          ? row["png64"]
          : typeof row["webp64"] === "string"
            ? row["webp64"]
            : null;

      const links = row["links"] as Record<string, unknown> | undefined;
      const websiteUrl =
        links && typeof links["website"] === "string"
          ? links["website"]
          : null;
      const xHandle =
        links && typeof links["twitter"] === "string"
          ? links["twitter"]
          : null;
      const linkedinUrl =
        links && typeof links["linkedin"] === "string"
          ? links["linkedin"]
          : null;
      const telegramUrl =
        links && typeof links["telegram"] === "string"
          ? links["telegram"]
          : null;

      results.push({
        externalId: code,
        name,
        symbol: code,
        slug,
        rank,
        marketCapUsd,
        priceUsd,
        changePercent24h,
        logoUrl,
        description: null,
        platformHint: null,
        websiteUrl,
        xHandle,
        linkedinUrl,
        telegramUrl,
      });
    }

    return results;
  }

  private async fetchFromCoinCap(
    apiKey: string,
    limit: number,
    fetchImpl: typeof fetch
  ): Promise<NormalizedThirdPartyProject[]> {
    const url = `https://rest.coincap.io/v3/assets?limit=${limit}`;
    const payload = (await this.performProviderFetch(
      "CoinCap",
      url,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      },
      fetchImpl
    )) as Record<string, unknown>;

    const dataRows = Array.isArray(payload?.["data"])
      ? (payload["data"] as Array<Record<string, unknown>>)
      : null;

    if (!dataRows) {
      throw new BadGatewayException(
        "CoinCap API returned an unexpected payload format."
      );
    }

    const results: NormalizedThirdPartyProject[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const id = String(row["id"] ?? `cc-${i}`);
      const name = String(row["name"] ?? "").trim();
      const symbol = String(row["symbol"] ?? "").trim().toUpperCase();
      if (!name || !symbol) continue;

      const slug = slugifyProjectName(id || name);
      const rankParsed = Number(row["rank"]);
      const rank = Number.isFinite(rankParsed) && rankParsed > 0 ? rankParsed : i + 1;
      const mcapParsed = Number(row["marketCapUsd"]);
      const marketCapUsd = Number.isFinite(mcapParsed) ? mcapParsed : null;
      const priceParsed = Number(row["priceUsd"]);
      const priceUsd = Number.isFinite(priceParsed) ? priceParsed : null;
      const changeParsed = Number(row["changePercent24Hr"]);
      const changePercent24h = Number.isFinite(changeParsed)
        ? changeParsed
        : null;

      const explorerUrl =
        typeof row["explorer"] === "string" && row["explorer"].trim()
          ? row["explorer"].trim()
          : null;

      results.push({
        externalId: id,
        name,
        symbol,
        slug,
        rank,
        marketCapUsd,
        priceUsd,
        changePercent24h,
        logoUrl: `https://assets.coincap.io/assets/icons/${symbol.toLowerCase()}@2x.png`,
        description: null,
        platformHint: explorerUrl,
        websiteUrl: explorerUrl,
        xHandle: null,
        linkedinUrl: null,
        telegramUrl: null,
      });
    }

    return results;
  }

  private async performProviderFetch(
    providerLabel: string,
    url: string,
    init: RequestInit,
    fetchImpl: typeof fetch
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        ...init,
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Network error";
      throw new BadGatewayException(
        `Failed to reach ${providerLabel} API: ${reason}`
      );
    }

    const text = await response.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!response.ok) {
      const apiErrMessage =
        typeof parsed === "object" && parsed !== null
          ? String(
              (parsed as Record<string, unknown>)["error"] ??
                (
                  (parsed as Record<string, unknown>)["status"] as
                    | Record<string, unknown>
                    | undefined
                )?.["error_message"] ??
                (parsed as Record<string, unknown>)["message"] ??
                `HTTP ${response.status}`
            )
          : `HTTP ${response.status}`;

      if (response.status === 401 || response.status === 403) {
        throw new BadRequestException(
          `${providerLabel} API rejected the configured API key (${apiErrMessage}). Please verify your API key in .env.`
        );
      }

      throw new BadGatewayException(
        `${providerLabel} API request failed (${response.status}): ${apiErrMessage}`
      );
    }

    return parsed;
  }
}
