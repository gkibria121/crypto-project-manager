import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  projectPlatformRanksSchema,
  SOLID_AVATAR_COLORS,
  SYNC_PROVIDERS,
  SYNC_PROVIDER_META,
  type ContextType,
  type CryptoProject,
  type ProjectChain,
  type ProjectPlatformRanks,
  type ProjectStage,
  type SyncJobState,
  type SyncLogEntry,
  type SyncLogLevel,
  type SyncProjectsDto,
  type SyncProjectsResponse,
  type SyncProvider,
  type SyncProviderStatus,
} from "@repo/shared";
import { Optional } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { AuthenticatedUser } from "../auth/auth.decorators.js";
import type { AppEnv } from "../config/env.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { ProjectSyncWsService } from "./project-sync-ws.service.js";
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

function parsePlatformRanks(raw: unknown): ProjectPlatformRanks {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const parsed = projectPlatformRanksSchema.safeParse(raw);
  return parsed.success ? { ...parsed.data } : {};
}

function mergePlatformRank(
  existingRaw: unknown,
  provider: SyncProvider,
  item: NormalizedThirdPartyProject,
  updatedAtIso: string
): ProjectPlatformRanks {
  const current = parsePlatformRanks(existingRaw);
  const meta = SYNC_PROVIDER_META[provider];
  const normalizedRank =
    Number.isFinite(item.rank) && item.rank > 0 ? Math.round(item.rank) : 1;
  return {
    ...current,
    [provider]: {
      provider,
      providerName: meta.shortLabel,
      rank: normalizedRank,
      marketCapUsd: item.marketCapUsd,
      priceUsd: item.priceUsd,
      updatedAt: updatedAtIso,
    },
  };
}

function computeProviderPageSize(
  provider: SyncProvider,
  limit: number
): number {
  return provider === "coingecko" ? Math.min(limit, 250) : limit;
}

function computeStartPageForMinRank(
  minRank: number | null,
  pageSize: number
): number {
  if (minRank === null || minRank <= 1) return 1;
  return Math.floor((minRank - 1) / Math.max(pageSize, 1)) + 1;
}

function normalizeRankBounds(
  minRank?: number | null,
  maxRank?: number | null
): { minRank: number | null; maxRank: number | null } {
  const normalizedMin =
    typeof minRank === "number" && Number.isFinite(minRank)
      ? Math.max(1, Math.min(100000, Math.trunc(minRank)))
      : null;
  const normalizedMax =
    typeof maxRank === "number" && Number.isFinite(maxRank)
      ? Math.max(1, Math.min(100000, Math.trunc(maxRank)))
      : null;
  if (
    normalizedMin !== null &&
    normalizedMax !== null &&
    normalizedMin > normalizedMax
  ) {
    throw new BadRequestException(
      "Maximum rank must be greater than or equal to minimum rank."
    );
  }
  return { minRank: normalizedMin, maxRank: normalizedMax };
}

function formatRankRangeLabel(
  minRank: number | null,
  maxRank: number | null
): string | null {
  if (minRank !== null && maxRank !== null) {
    return `ranks #${minRank}–#${maxRank}`;
  }
  if (minRank !== null) {
    return `ranks #${minRank}+`;
  }
  if (maxRank !== null) {
    return `ranks #1–#${maxRank}`;
  }
  return null;
}

@Injectable()
export class ProjectSyncService {
  private jobState: Omit<SyncJobState, "logs"> = {
    isRunning: false,
    isFetchingBatch: false,
    provider: null,
    providerName: null,
    limit: 50,
    noLimit: false,
    continuous: true,
    currentPage: 1,
    minRank: null,
    maxRank: null,
    countdownSeconds: null,
    totalCreated: 0,
    totalUpdated: 0,
    pagesCompleted: 0,
    lastError: null,
  };
  private logHistory: SyncLogEntry[] = [];
  private stopRequested = false;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private wakeNextPageResolver: (() => void) | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppEnv, true>,
    @Optional() private readonly wsHub?: ProjectSyncWsService
  ) {}

  getJobState(): SyncJobState {
    return {
      ...this.jobState,
      logs: [...this.logHistory],
    };
  }

  private appendJobLog(
    level: SyncLogLevel,
    message: string,
    opts?: {
      ticker?: string;
      projectName?: string;
      projectsChanged?: boolean;
      immediate?: boolean;
    }
  ): SyncLogEntry {
    const entry: SyncLogEntry = {
      id: `log-${Date.now()}-${randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      level,
      message,
      ticker: opts?.ticker,
      projectName: opts?.projectName,
    };
    this.logHistory.push(entry);
    if (this.logHistory.length > 200) {
      this.logHistory = this.logHistory.slice(-200);
    }
    this.wsHub?.queueUpdate(
      { ...this.jobState },
      [entry],
      Boolean(opts?.projectsChanged),
      Boolean(opts?.immediate)
    );
    return entry;
  }

  private clearJobTimer(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.jobState.countdownSeconds = null;
  }

  startAsyncSync(
    dto: SyncProjectsDto,
    actor?: AuthenticatedUser
  ): SyncJobState {
    const provider = dto.provider;
    // Validate API key & rank range immediately so invalid config returns 400 synchronously
    this.requireProviderApiKey(provider);
    const { minRank, maxRank } = normalizeRankBounds(dto.minRank, dto.maxRank);

    if (this.jobState.isRunning) {
      return this.getJobState();
    }

    const noLimit = Boolean(dto.noLimit);
    const limit = noLimit
      ? 1000
      : Math.min(Math.max(dto.limit ?? 50, 1), 1000);
    const continuous = dto.continuous ?? true;
    const pageSize = computeProviderPageSize(provider, limit);
    const startPage =
      dto.page !== undefined
        ? Math.max(dto.page, 1)
        : minRank !== null
          ? computeStartPageForMinRank(minRank, pageSize)
          : Math.max(this.jobState.currentPage ?? 1, 1);
    const meta = SYNC_PROVIDER_META[provider];

    this.stopRequested = false;
    this.clearJobTimer();

    this.jobState = {
      ...this.jobState,
      isRunning: true,
      isFetchingBatch: true,
      provider,
      providerName: meta.shortLabel,
      limit,
      noLimit,
      continuous,
      currentPage: startPage,
      minRank,
      maxRank,
      countdownSeconds: null,
      lastError: null,
    };

    const rateLabel = noLimit
      ? "No Limit (unlimited speed)"
      : `${limit} projects/minute`;
    const rankRangeLabel = formatRankRangeLabel(minRank, maxRank);
    const scopeLabel = rankRangeLabel
      ? `${rankRangeLabel}, page #${startPage}`
      : `page #${startPage}`;

    this.appendJobLog(
      "info",
      continuous
        ? `Started asynchronous background sync from ${meta.shortLabel} at ${rateLabel} (${scopeLabel}).`
        : `Started single-page async sync from ${meta.shortLabel} (${rateLabel}, ${scopeLabel}).`,
      { immediate: true }
    );

    setImmediate(() => {
      void this.runBackgroundSyncLoop(actor);
    });

    return this.getJobState();
  }

  stopAsyncSync(): SyncJobState {
    this.stopRequested = true;
    this.clearJobTimer();
    if (this.wakeNextPageResolver) {
      const wake = this.wakeNextPageResolver;
      this.wakeNextPageResolver = null;
      wake();
    }
    if (this.jobState.isRunning) {
      this.jobState = {
        ...this.jobState,
        isRunning: false,
        isFetchingBatch: false,
        countdownSeconds: null,
      };
      this.appendJobLog(
        "warn",
        `Sync stopped by administrator (+${this.jobState.totalCreated} new added, ~${this.jobState.totalUpdated} existing synced across ${this.jobState.pagesCompleted} ${this.jobState.pagesCompleted === 1 ? "page" : "pages"}).`,
        { immediate: true, projectsChanged: true }
      );
    }
    return this.getJobState();
  }

  triggerNextPageNow(): SyncJobState {
    if (this.wakeNextPageResolver) {
      this.clearJobTimer();
      const wake = this.wakeNextPageResolver;
      this.wakeNextPageResolver = null;
      wake();
    }
    return this.getJobState();
  }

  resetSyncCursor(): SyncJobState {
    if (this.jobState.isRunning) {
      return this.getJobState();
    }
    this.jobState = {
      ...this.jobState,
      currentPage: 1,
      minRank: null,
      maxRank: null,
      totalCreated: 0,
      totalUpdated: 0,
      pagesCompleted: 0,
      lastError: null,
      countdownSeconds: null,
    };
    this.appendJobLog("info", "Reset pagination cursor back to page #1.", {
      immediate: true,
    });
    return this.getJobState();
  }

  clearSyncLogs(): SyncJobState {
    this.logHistory = [];
    const snapshot = this.getJobState();
    this.wsHub?.broadcastCleared(snapshot);
    return snapshot;
  }

  private async runBackgroundSyncLoop(
    actor?: AuthenticatedUser
  ): Promise<void> {
    while (!this.stopRequested && this.jobState.isRunning) {
      const provider = this.jobState.provider ?? "coingecko";
      const pageToFetch = this.jobState.currentPage;
      const limit = this.jobState.limit;
      const noLimit = this.jobState.noLimit;
      const continuous = this.jobState.continuous;
      const minRank = this.jobState.minRank;
      const maxRank = this.jobState.maxRank;
      const meta = SYNC_PROVIDER_META[provider];

      this.jobState = {
        ...this.jobState,
        isFetchingBatch: true,
        countdownSeconds: null,
        lastError: null,
      };
      this.wsHub?.queueUpdate({ ...this.jobState }, [], false, true);

      try {
        const result = await this.syncFromProvider(
          {
            provider,
            limit,
            page: pageToFetch,
            minRank,
            maxRank,
            noLimit,
            continuous,
          },
          actor,
          fetch,
          {
            skipFullProjectReload: true,
            onProgress: (entry, delta) => {
              this.jobState = {
                ...this.jobState,
                totalCreated: this.jobState.totalCreated + delta.createdDelta,
                totalUpdated: this.jobState.totalUpdated + delta.updatedDelta,
              };
              this.logHistory.push(entry);
              if (this.logHistory.length > 200) {
                this.logHistory = this.logHistory.slice(-200);
              }
              this.wsHub?.queueUpdate(
                { ...this.jobState },
                [entry],
                delta.createdDelta > 0 || delta.updatedDelta > 0
              );
            },
          }
        );

        if (this.stopRequested) {
          break;
        }

        const nextPage = pageToFetch + 1;
        this.jobState = {
          ...this.jobState,
          isFetchingBatch: false,
          currentPage: nextPage,
          pagesCompleted: this.jobState.pagesCompleted + 1,
        };
        this.wsHub?.queueUpdate({ ...this.jobState }, [], true, true);

        if (!continuous) {
          this.jobState = {
            ...this.jobState,
            isRunning: false,
            isFetchingBatch: false,
          };
          this.appendJobLog(
            "info",
            `Single-batch sync completed on page #${pageToFetch}.`,
            { immediate: true, projectsChanged: true }
          );
          break;
        }

        if (!result.hasMore) {
          this.jobState = {
            ...this.jobState,
            isRunning: false,
            isFetchingBatch: false,
          };
          const doneMsg =
            maxRank !== null
              ? `Completed target rank range (${formatRankRangeLabel(minRank, maxRank)}) from ${meta.shortLabel} at page #${pageToFetch}.`
              : `All available projects from ${meta.shortLabel} have been synced (reached end of catalog at page #${pageToFetch}).`;
          this.appendJobLog("info", doneMsg, {
            immediate: true,
            projectsChanged: true,
          });
          break;
        }

        if (noLimit) {
          this.appendJobLog(
            "info",
            `No Limit active — advancing to page #${nextPage}...`
          );
          await new Promise((r) => setTimeout(r, 80));
          continue;
        }

        const waitSeconds = 60;
        this.appendJobLog(
          "info",
          `Rate limit pacing (${limit}/min): waiting ${waitSeconds}s before syncing page #${nextPage} (or click "Sync Next Page Now")...`,
          { immediate: true }
        );
        await this.waitWithCountdown(waitSeconds);
      } catch (err) {
        if (this.stopRequested) {
          break;
        }
        const errMsg =
          err instanceof Error
            ? err.message
            : "Failed to sync projects from the selected provider.";
        const isCredentialError =
          errMsg.toLowerCase().includes("api key") ||
          errMsg.toLowerCase().includes("rejected");

        this.jobState = {
          ...this.jobState,
          isFetchingBatch: false,
          lastError: errMsg,
        };
        this.appendJobLog("error", errMsg, { immediate: true });

        if (isCredentialError || !continuous) {
          this.jobState = {
            ...this.jobState,
            isRunning: false,
            isFetchingBatch: false,
          };
          this.wsHub?.queueUpdate({ ...this.jobState }, [], false, true);
          break;
        }

        const retryWait = 60;
        this.appendJobLog(
          "warn",
          `Will retry page #${pageToFetch} in ${retryWait}s (or click "Stop Syncing" to cancel)...`,
          { immediate: true }
        );
        await this.waitWithCountdown(retryWait);
      }
    }

    this.clearJobTimer();
    if (this.jobState.isRunning) {
      this.jobState = {
        ...this.jobState,
        isRunning: false,
        isFetchingBatch: false,
        countdownSeconds: null,
      };
      this.wsHub?.queueUpdate({ ...this.jobState }, [], true, true);
    }
  }

  private waitWithCountdown(seconds: number): Promise<void> {
    this.clearJobTimer();
    this.jobState = {
      ...this.jobState,
      countdownSeconds: seconds,
    };
    this.wsHub?.queueUpdate({ ...this.jobState }, [], false, true);

    return new Promise<void>((resolve) => {
      this.wakeNextPageResolver = () => {
        this.clearJobTimer();
        resolve();
      };

      this.countdownTimer = setInterval(() => {
        if (this.stopRequested) {
          this.clearJobTimer();
          this.wakeNextPageResolver = null;
          resolve();
          return;
        }
        const current = this.jobState.countdownSeconds ?? 0;
        if (current <= 1) {
          this.clearJobTimer();
          this.wakeNextPageResolver = null;
          resolve();
          return;
        }
        this.jobState = {
          ...this.jobState,
          countdownSeconds: current - 1,
        };
        this.wsHub?.queueUpdate({ ...this.jobState }, [], false, true);
      }, 1000);
    });
  }

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
    fetchImpl: typeof fetch = fetch,
    options?: {
      skipFullProjectReload?: boolean;
      onProgress?: (
        entry: SyncLogEntry,
        delta: { createdDelta: number; updatedDelta: number }
      ) => void;
    }
  ): Promise<SyncProjectsResponse> {
    const provider = dto.provider;
    const noLimit = Boolean(dto.noLimit);
    const limit = noLimit
      ? 1000
      : Math.min(Math.max(dto.limit ?? 10, 1), 1000);
    const { minRank, maxRank } = normalizeRankBounds(dto.minRank, dto.maxRank);
    const effectivePageSize = computeProviderPageSize(provider, limit);
    const page =
      dto.page !== undefined
        ? Math.max(dto.page, 1)
        : minRank !== null
          ? computeStartPageForMinRank(minRank, effectivePageSize)
          : 1;
    const meta = SYNC_PROVIDER_META[provider];
    const apiKey = this.requireProviderApiKey(provider);
    const rankRangeLabel = formatRankRangeLabel(minRank, maxRank);

    const logs: SyncLogEntry[] = [];
    const pushLog = (
      level: SyncLogLevel,
      message: string,
      opts?: {
        ticker?: string;
        projectName?: string;
        createdDelta?: number;
        updatedDelta?: number;
      }
    ) => {
      const entry: SyncLogEntry = {
        id: `log-${Date.now()}-${randomUUID().slice(0, 8)}`,
        timestamp: new Date().toISOString(),
        level,
        message,
        ticker: opts?.ticker,
        projectName: opts?.projectName,
      };
      logs.push(entry);
      options?.onProgress?.(entry, {
        createdDelta: opts?.createdDelta ?? 0,
        updatedDelta: opts?.updatedDelta ?? 0,
      });
    };

    const rateLabel = noLimit
      ? "rate limit: No Limit (unlimited)"
      : `rate limit: ${limit} projects/min`;

    pushLog(
      "info",
      `Connecting to ${meta.label} — requesting page #${page} (${rateLabel}${rankRangeLabel ? `, ${rankRangeLabel}` : ""})...`
    );

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

    let rawCandidates: NormalizedThirdPartyProject[];
    switch (provider) {
      case "coingecko": {
        const cgPerPage = Math.min(limit, 250);
        const detailFetchQuota =
          noLimit || cgPerPage > 15 ? 0 : Math.min(cgPerPage, 5);
        rawCandidates = await this.fetchFromCoinGecko(
          apiKey,
          cgPerPage,
          page,
          detailFetchQuota,
          existingTickers,
          existingNames,
          fetchImpl,
          minRank,
          maxRank
        );
        break;
      }
      case "coinmarketcap":
        rawCandidates = await this.fetchFromCoinMarketCap(
          apiKey,
          limit,
          page,
          fetchImpl
        );
        break;
      case "livecoinwatch":
        rawCandidates = await this.fetchFromLiveCoinWatch(
          apiKey,
          limit,
          page,
          fetchImpl
        );
        break;
      case "coincap":
        rawCandidates = await this.fetchFromCoinCap(
          apiKey,
          limit,
          page,
          fetchImpl
        );
        break;
    }

    const candidates = rawCandidates.filter(
      (item) =>
        (minRank === null || item.rank >= minRank) &&
        (maxRank === null || item.rank <= maxRank)
    );
    const maxRawRank = rawCandidates.reduce(
      (highest, item) => Math.max(highest, item.rank),
      0
    );
    const hasMore =
      rawCandidates.length > 0 &&
      (maxRank === null || maxRawRank < maxRank);

    if (rawCandidates.length === 0) {
      pushLog(
        "warn",
        `Page #${page} returned 0 projects from ${meta.shortLabel}. Reached end of provider catalog.`
      );
    } else if (candidates.length === 0 && rankRangeLabel) {
      pushLog(
        "info",
        `Page #${page} returned ${rawCandidates.length} ${rawCandidates.length === 1 ? "project" : "projects"} from ${meta.shortLabel}, none within target ${rankRangeLabel}.`
      );
    } else if (candidates.length !== rawCandidates.length && rankRangeLabel) {
      pushLog(
        "info",
        `Received ${rawCandidates.length} projects from ${meta.shortLabel} on page #${page} (${candidates.length} within target ${rankRangeLabel}). Synchronizing with database...`
      );
    } else {
      pushLog(
        "info",
        `Received ${candidates.length} ${candidates.length === 1 ? "project" : "projects"} from ${meta.shortLabel} on page #${page}. Synchronizing with database...`
      );
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
    const CHUNK_SIZE = 20;

    // 1. Update existing DB projects in non-blocking chunks
    for (
      let chunkStart = 0;
      chunkStart < toUpdate.length;
      chunkStart += CHUNK_SIZE
    ) {
      if (options?.skipFullProjectReload && this.stopRequested) {
        break;
      }
      const chunk = toUpdate.slice(chunkStart, chunkStart + CHUNK_SIZE);
      await this.prisma.db.transaction(async (tx) => {
        for (let offset = 0; offset < chunk.length; offset++) {
          const idx = chunkStart + offset;
          const { existing, candidate: item } = chunk[offset]!;
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
          const nextPlatformRanks = mergePlatformRank(
            existing.platformRanks,
            provider,
            item,
            new Date(itemTime).toISOString()
          );

          await tx.orm.public.Project.where({ id: existing.id }).update({
            logoUrl: item.logoUrl || existing.logoUrl || null,
            tagline: nextTagline,
            sentimentScore,
            platformRanks: nextPlatformRanks as never,
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
          pushLog(
            "update",
            `Synced existing project ${existing.name} (${cleanTicker}) — ${meta.shortLabel} Rank #${item.rank}, Market Cap ${mcapLabel}, contexts updated.`,
            {
              ticker: cleanTicker,
              projectName: existing.name,
              updatedDelta: 1,
            }
          );
        }
      });
      await new Promise((r) => setImmediate(r));
    }

    // 2. Create missing projects in DB in non-blocking chunks and tag them "new"
    for (
      let chunkStart = 0;
      chunkStart < toCreate.length;
      chunkStart += CHUNK_SIZE
    ) {
      if (options?.skipFullProjectReload && this.stopRequested) {
        break;
      }
      const chunk = toCreate.slice(chunkStart, chunkStart + CHUNK_SIZE);
      await this.prisma.db.transaction(async (tx) => {
        for (let offset = 0; offset < chunk.length; offset++) {
          const idx = chunkStart + offset;
          const item = chunk[offset]!;
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
          const platformRanks = mergePlatformRank(
            null,
            provider,
            item,
            new Date(itemTime).toISOString()
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
            platformRanks: platformRanks as never,
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
          pushLog(
            "success",
            `Added new project ${item.name} (${cleanTicker}) tagged 'new' — ${meta.shortLabel} Rank #${item.rank}, Market Cap ${mcapLabel} [Website, X, LinkedIn linked].`,
            {
              ticker: cleanTicker,
              projectName: item.name,
              createdDelta: 1,
            }
          );
        }
      });
      await new Promise((r) => setImmediate(r));
    }

    if (
      actor &&
      (createdProjectIds.length > 0 || updatedProjectIds.length > 0)
    ) {
      await this.prisma.db.transaction(async (tx) => {
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
            minRank,
            maxRank,
            syncedCount: createdProjectIds.length,
            updatedCount: updatedProjectIds.length,
            skippedCount,
          },
          ipAddress: null,
        });
      });
    }

    let allProjects: CryptoProject[] = [];
    let createdProjects: CryptoProject[] = [];
    let updatedProjects: CryptoProject[] = [];

    if (!options?.skipFullProjectReload) {
      const updatedRows = await fullProjectQuery(this.prisma.db.orm)
        .orderBy((p) => p.createdAt.desc())
        .all();

      allProjects = [...updatedRows]
        .sort((a, b) => Number(b.isPinned) - Number(a.isPinned))
        .map(mapPrismaProjectToDomain);

      createdProjects = allProjects.filter((p) =>
        createdProjectIds.includes(p.id)
      );
      updatedProjects = allProjects.filter((p) =>
        updatedProjectIds.includes(p.id)
      );
    }

    const createdTotal = createdProjectIds.length;
    const updatedTotal = updatedProjectIds.length;

    let message: string;
    if (createdTotal > 0 && updatedTotal > 0) {
      message = `Page #${page}: Added ${createdTotal} new ${createdTotal === 1 ? "project" : "projects"} (tagged "new") and synced ${updatedTotal} existing ${updatedTotal === 1 ? "project" : "projects"} from ${meta.shortLabel}.`;
    } else if (createdTotal > 0) {
      message = `Page #${page}: Added ${createdTotal} new crypto ${createdTotal === 1 ? "project" : "projects"} from ${meta.shortLabel} into New status and tagged "new".`;
    } else if (updatedTotal > 0) {
      message = `Page #${page}: Synced latest market data and context links for ${updatedTotal} existing ${updatedTotal === 1 ? "project" : "projects"} from ${meta.shortLabel}.`;
    } else {
      message = `Page #${page}: No new or matching projects returned by ${meta.shortLabel}.`;
    }

    pushLog("info", message);

    return {
      provider,
      providerName: meta.shortLabel,
      page,
      minRank,
      maxRank,
      hasMore,
      syncedCount: createdTotal,
      updatedCount: updatedTotal,
      skippedCount,
      createdProjects,
      updatedProjects,
      projects: allProjects,
      logs,
      message,
    };
  }

  private async fetchFromCoinGecko(
    apiKey: string,
    perPage: number,
    page: number,
    targetNewLimit: number,
    existingTickers: Set<string>,
    existingNames: Set<string>,
    fetchImpl: typeof fetch,
    minRank: number | null = null,
    maxRank: number | null = null
  ): Promise<NormalizedThirdPartyProject[]> {
    const marketsUrl = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=false`;
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
    const rankOffset = (page - 1) * perPage;

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
          : rankOffset + i + 1;
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

      const inTargetRange =
        (minRank === null || rank >= minRank) &&
        (maxRank === null || rank <= maxRank);
      const isAlreadyExisting =
        existingTickers.has(symbol.slice(0, 11)) ||
        existingNames.has(name.toLowerCase());

      if (inTargetRange && !isAlreadyExisting && detailFetchCount < targetNewLimit) {
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
    page: number,
    fetchImpl: typeof fetch
  ): Promise<NormalizedThirdPartyProject[]> {
    const start = (page - 1) * limit + 1;
    const listingsUrl = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?start=${start}&limit=${limit}&convert=USD`;
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
        typeof row["cmc_rank"] === "number" ? row["cmc_rank"] : start + i;

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
    page: number,
    fetchImpl: typeof fetch
  ): Promise<NormalizedThirdPartyProject[]> {
    const offset = (page - 1) * limit;
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
          offset,
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
      const rank =
        typeof row["rank"] === "number" ? row["rank"] : offset + i + 1;
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
    page: number,
    fetchImpl: typeof fetch
  ): Promise<NormalizedThirdPartyProject[]> {
    const offset = (page - 1) * limit;
    const url = `https://rest.coincap.io/v3/assets?limit=${limit}&offset=${offset}`;
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
      const rank =
        Number.isFinite(rankParsed) && rankParsed > 0
          ? rankParsed
          : offset + i + 1;
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
