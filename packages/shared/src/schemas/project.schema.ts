import { z } from "zod";

/**
 * Domain Enums & Literals
 */
export const contextTypeSchema = z.enum([
  "website",
  "x_handle",
  "linkedin",
  "telegram",
  "message",
]);

export const projectStageSchema = z.enum([
  "Pre-TGE",
  "Mainnet Live",
  "IDO / Launchpad",
  "Ecosystem Growth",
  "Stealth",
]);

export const projectBusinessStatusSchema = z.enum([
  "new",
  "active",
  "contacted",
  "collaborated",
  "completed",
  "unresponsive",
  "archived",
]);

export const projectChainSchema = z.enum([
  "Solana",
  "Ethereum L2",
  "Base",
  "Arbitrum",
  "Sui",
  "Monad / EVM",
]);

export const messageSenderSchema = z.enum(["admin", "ai"]);

export const scrapeStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "unreachable",
  "failed",
  "api_key_required",
]);

export const specializedScraperProviderSchema = z.enum([
  "x",
  "linkedin",
  "telegram",
]);

export const aiProviderSchema = z.enum([
  "google",
  "openai",
  "anthropic",
  "groq",
  "openrouter",
]);

export const scrapeWaitUntilSchema = z.enum([
  "domcontentloaded",
  "load",
  "networkidle",
]);

export const syncProviderSchema = z.enum([
  "coingecko",
  "coinmarketcap",
  "livecoinwatch",
  "coincap",
]);

/**
 * RBAC Roles & Permissions Enums
 */
export const userRoleSchema = z.enum([
  "admin",
  "manager",
  "analyst",
  "viewer",
]);

export const permissionSchema = z.enum([
  "projects:read",
  "projects:create",
  "projects:update",
  "projects:delete",
  "contexts:write",
  "scraper:trigger",
  "chat:write",
  "checklist:write",
  "settings:read",
  "settings:write",
  "users:read",
  "users:write",
]);

/**
 * Scraper & Enrichment Schemas
 */
export const scrapeConfigSchema = z.object({
  levels: z.coerce.number().int().min(1).max(5).default(2),
  maxPages: z.coerce.number().int().min(1).max(50).default(10),
  renderJs: z.boolean().default(true),
  waitUntil: scrapeWaitUntilSchema.default("networkidle"),
  waitForMs: z.coerce.number().int().min(0).max(10000).default(1200),
  scrollToBottom: z.boolean().default(true),
  sameDomainOnly: z.boolean().default(true),
  includeSubdomains: z.boolean().default(true),
  respectRobotsTxt: z.boolean().default(true),
  extractStructuredData: z.boolean().default(true),
  extractContacts: z.boolean().default(true),
  blockMedia: z.boolean().default(true),
  timeoutSeconds: z.coerce.number().int().min(5).max(60).default(15),
  includePatterns: z.array(z.string().trim().min(1)).max(20).default([]),
  excludePatterns: z.array(z.string().trim().min(1)).max(20).default([]),
  xPostsLimit: z.coerce.number().int().min(1).max(100).default(10),
  linkedinPostsLimit: z.coerce.number().int().min(1).max(100).default(10),
  specializedMaxItems: z.coerce.number().int().min(1).max(100).default(10),
});

export const triggerScrapeDtoSchema = scrapeConfigSchema.partial();

export const scrapedHeadingSchema = z.object({
  level: z.string(),
  text: z.string(),
});

export const scrapedLinkSchema = z.object({
  url: z.string(),
  text: z.string().default(""),
  isInternal: z.boolean().default(false),
  category: z.string().nullable().optional(),
});

export const scraperServicePageSchema = z.object({
  url: z.string(),
  canonicalUrl: z.string().nullable().optional(),
  parentUrl: z.string().nullable().optional(),
  depth: z.number().int().min(1),
  httpStatus: z.number().int().nullable().optional(),
  contentType: z.string().nullable().optional(),
  renderMode: z.string().default("playwright_js"),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  headings: z.array(scrapedHeadingSchema).default([]),
  textContent: z.string().nullable().optional(),
  wordCount: z.number().int().nonnegative().default(0),
  links: z.array(scrapedLinkSchema).default([]),
  socialLinks: z.record(z.string(), z.string()).default({}),
  contacts: z.array(z.string()).default([]),
  signals: z.array(z.string()).default([]),
  metaTags: z.record(z.string(), z.string()).default({}),
  structuredData: z.array(z.unknown()).default([]),
  platformData: z.record(z.string(), z.unknown()).nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  durationMs: z.number().int().nonnegative().nullable().optional(),
});

export const scrapedPageSchema = scraperServicePageSchema.extend({
  id: z.string().min(1),
  projectId: z.string().min(1),
  contextId: z.string().min(1),
  scrapeJobId: z.string().min(1),
  scrapedAt: z.string(),
});

export const scrapedMetadataSchema = z.object({
  normalizedUrl: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  reachable: z.boolean().default(false),
  httpStatus: z.number().int().optional(),
  headings: z.array(z.string()).default([]),
  socialLinks: z.record(z.string(), z.string()).default({}),
  signals: z.array(z.string()).default([]),
  rawPreview: z.string().optional(),
  summary: z.string().optional(),
  errorReason: z.string().optional(),
  providerUsed: z.string().optional(),
  specializedProvider: specializedScraperProviderSchema.nullable().optional(),
  requiresApiKey: z.boolean().optional(),
  apiKeyConfigured: z.boolean().optional(),
  levelsScraped: z.number().int().nonnegative().optional(),
  pagesCount: z.number().int().nonnegative().optional(),
  contacts: z.array(z.string()).default([]),
  lastJobId: z.string().optional(),
  configUsed: scrapeConfigSchema.partial().optional(),
  platformData: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const scrapeJobSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  contextId: z.string().optional(),
  targetType: contextTypeSchema,
  targetValue: z.string().min(1),
  normalizedUrl: z.string().optional(),
  status: scrapeStatusSchema,
  httpStatus: z.number().int().nullable().optional(),
  extractedTitle: z.string().optional(),
  extractedDescription: z.string().optional(),
  detectedSocials: z.record(z.string(), z.string()).optional(),
  detectedSignals: z.array(z.string()).default([]),
  rawPreview: z.string().optional(),
  errorMessage: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  config: scrapeConfigSchema.partial().optional(),
  providerUsed: z.string().optional(),
  requiresApiKey: z.boolean().default(false),
  levelsScraped: z.number().int().nonnegative().default(0),
  pagesScraped: z.number().int().nonnegative().default(0),
  platformData: z.record(z.string(), z.unknown()).nullable().optional(),
  pages: z.array(scrapedPageSchema).optional(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
});

export const scraperServiceResponseSchema = z.object({
  targetType: contextTypeSchema,
  targetValue: z.string(),
  normalizedUrl: z.string().nullable().optional(),
  status: scrapeStatusSchema,
  reachable: z.boolean(),
  httpStatus: z.number().int().nullable().optional(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  headings: z.array(z.string()).default([]),
  socialLinks: z.record(z.string(), z.string()).default({}),
  signals: z.array(z.string()).default([]),
  rawPreview: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  errorReason: z.string().nullable().optional(),
  durationMs: z.number().int().nonnegative().default(0),
  providerUsed: z.string().optional(),
  specializedProvider: specializedScraperProviderSchema.nullable().optional(),
  requiresApiKey: z.boolean().default(false),
  apiKeyConfigured: z.boolean().default(false),
  levelsScraped: z.number().int().nonnegative().default(0),
  pagesScraped: z.number().int().nonnegative().default(0),
  contacts: z.array(z.string()).default([]),
  structuredData: z.array(z.unknown()).default([]),
  platformData: z.record(z.string(), z.unknown()).nullable().optional(),
  pages: z.array(scraperServicePageSchema).default([]),
  configUsed: scrapeConfigSchema.optional(),
});

export const scraperProviderStatusSchema = z.object({
  provider: specializedScraperProviderSchema,
  label: z.string(),
  shortLabel: z.string(),
  envVar: z.string(),
  preferredMethod: z.string(),
  docsUrl: z.string(),
  requiredNotice: z.string(),
  configured: z.boolean(),
  source: z.enum(["workspace", "env", "none"]),
  maskedKey: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});

export const updateScraperProviderKeyDtoSchema = z.object({
  apiKey: z.string().trim().min(1, "API key or token is required").max(4000),
});

export const aiProviderStatusSchema = z.object({
  provider: aiProviderSchema,
  label: z.string(),
  shortLabel: z.string(),
  envVar: z.string(),
  docsUrl: z.string(),
  defaultModel: z.string(),
  recommendedModels: z.array(z.string()),
  configured: z.boolean(),
  source: z.enum(["workspace", "env", "none"]),
  maskedKey: z.string().nullable().optional(),
  selectedModel: z.string(),
  isActive: z.boolean(),
  updatedAt: z.string().nullable().optional(),
});

export const aiConfigurationSummarySchema = z.object({
  activeProvider: aiProviderSchema.nullable(),
  activeModel: z.string().nullable(),
  hasConfiguredProvider: z.boolean(),
  providers: z.array(aiProviderStatusSchema),
});

export const updateAiProviderConfigDtoSchema = z
  .object({
    apiKey: z.string().trim().max(4000).optional(),
    selectedModel: z.string().trim().min(1).max(200).optional(),
    activate: z.boolean().optional(),
  })
  .refine(
    (val) =>
      Boolean(val.apiKey) ||
      Boolean(val.selectedModel) ||
      val.activate !== undefined,
    {
      message: "Provide an API key, a selected model, or an activation flag.",
    }
  );

export const activateAiProviderDtoSchema = z.object({
  selectedModel: z.string().trim().min(1).max(200).optional(),
});

export const aiProviderModelsResponseSchema = z.object({
  provider: aiProviderSchema,
  models: z.array(z.string()),
  source: z.enum(["live", "curated"]),
});

export const projectScrapedDataResponseSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  contextId: z.string().nullable().optional(),
  jobs: z.array(scrapeJobSchema),
  pages: z.array(scrapedPageSchema),
});

/**
 * Domain Entity Schemas
 */
export const projectContextItemSchema = z.object({
  id: z.string().min(1),
  type: contextTypeSchema,
  title: z.string().min(1, "Context title is required"),
  value: z.string().min(1, "Context value is required"),
  url: z.string().optional(),
  summary: z.string().optional(),
  isActive: z.boolean(),
  updatedAt: z.string(),
  scrapeStatus: scrapeStatusSchema.optional(),
  lastScrapedAt: z.string().optional(),
  scrapedMetadata: scrapedMetadataSchema.optional(),
});

export const chatMessageSchema = z.object({
  id: z.string().min(1),
  sender: messageSenderSchema,
  content: z.string().min(1),
  timestamp: z.string(),
  usedContextIds: z.array(z.string()).optional(),
  suggestedActions: z.array(z.string()).optional(),
  appliedSystemPromptTitle: z.string().optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
});

export const promptTemplateSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1, "Button title is required"),
  systemPrompt: z.string().min(1, "System prompt instructions are required"),
});

export const checklistItemConfigSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1, "Feature name is required"),
  scanPrompt: z.string().min(1, "Scan prompt question is required"),
});

export const projectChecklistItemStateSchema = z.object({
  checked: z.boolean(),
  scanResultNote: z.string().optional(),
  scannedAt: z.string().optional(),
});

export const projectPlatformRankSchema = z.object({
  provider: syncProviderSchema,
  providerName: z.string(),
  rank: z.number().int().positive(),
  marketCapUsd: z.number().nullable().optional(),
  priceUsd: z.number().nullable().optional(),
  updatedAt: z.string(),
});

export const projectPlatformRanksSchema = z.partialRecord(
  syncProviderSchema,
  projectPlatformRankSchema
);

export const cryptoProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Project name is required"),
  ticker: z.string().min(1, "Ticker is required"),
  chain: z.string().min(1, "Chain is required"),
  stage: projectStageSchema,
  businessStatus: projectBusinessStatusSchema,
  avatarBg: z.string().min(1),
  logoUrl: z.string().optional(),
  tagline: z.string(),
  campaignBudget: z.string(),
  sentimentScore: z.number().min(0).max(100),
  platformRanks: projectPlatformRanksSchema.optional(),
  tags: z.array(z.string()).optional(),
  isPinned: z.boolean().optional(),
  unreadInsights: z.number().int().nonnegative().optional(),
  lastActivityTime: z.string(),
  contexts: z.array(projectContextItemSchema),
  messages: z.array(chatMessageSchema),
  checklistState: z
    .record(z.string(), projectChecklistItemStateSchema)
    .optional(),
});

/**
 * Form & API Request Validation Schemas
 */
export const addContextFormSchema = z.object({
  type: contextTypeSchema,
  title: z.string().trim().min(1, "Title is required"),
  value: z.string().trim().min(1, "Link, handle, or note is required"),
  summary: z.string().trim().optional(),
});

export const updateProjectLogoFormSchema = z.object({
  logoUrl: z.string().trim(),
});

export const newProjectFormSchema = z.object({
  name: z.string().trim().min(1, "Project name is required"),
  ticker: z
    .string()
    .trim()
    .min(1, "Ticker symbol is required")
    .max(12, "Ticker must be 12 characters or fewer"),
  chain: z.string().trim().min(1, "Chain is required"),
  stage: projectStageSchema,
  businessStatus: projectBusinessStatusSchema.superRefine((status, ctx) => {
    if (status === "active") {
      ctx.addIssue({
        code: "custom",
        message:
          "New projects cannot be added directly to the Active state. They start in New and become Active automatically when interacted with.",
      });
    }
  }),
  tagline: z.string().trim(),
  logoUrl: z.string().trim(),
  website: z.string().trim(),
  xHandle: z.string().trim(),
  linkedin: z.string().trim(),
});

export const updateProjectFormSchema = z.object({
  name: z.string().trim().min(1, "Project name is required"),
  ticker: z
    .string()
    .trim()
    .min(1, "Ticker symbol is required")
    .max(12, "Ticker must be 12 characters or fewer"),
  chain: z.string().trim().min(1, "Chain is required"),
  stage: projectStageSchema,
  businessStatus: projectBusinessStatusSchema,
  tagline: z.string().trim(),
  campaignBudget: z.string().trim().min(1, "Campaign budget is required"),
  sentimentScore: z
    .number()
    .int()
    .min(0, "Sentiment score must be at least 0")
    .max(100, "Sentiment score must be 100 or lower"),
  isPinned: z.boolean().optional(),
  avatarBg: z.string().trim().min(1, "Avatar color is required"),
  logoUrl: z.string().trim(),
  website: z.string().trim(),
  xHandle: z.string().trim(),
  linkedin: z.string().trim(),
  telegram: z.string().trim().optional(),
});

export const promptTemplateFormSchema = z.object({
  label: z.string().trim().min(1, "Prompt button label is required"),
  systemPrompt: z
    .string()
    .trim()
    .min(1, "System prompt instructions are required"),
});

export const checklistItemFormSchema = z.object({
  label: z.string().trim().min(1, "Feature label is required"),
  scanPrompt: z.string().trim().min(1, "Scan prompt question is required"),
});

export const chatComposerFormSchema = z.object({
  content: z.string().trim().min(1, "Please enter a message"),
});

export const updateBusinessStatusDtoSchema = z.object({
  status: projectBusinessStatusSchema,
});

export const bulkUpdateBusinessStatusDtoSchema = z.object({
  projectIds: z
    .array(z.string().min(1))
    .min(1, "Select at least one project")
    .max(500, "Cannot update more than 500 projects at once"),
  status: projectBusinessStatusSchema,
});

export const bulkDeleteProjectsDtoSchema = z.object({
  projectIds: z
    .array(z.string().min(1))
    .min(1, "Select at least one project")
    .max(1000, "Cannot delete more than 1000 projects at once"),
});

export const updateProjectLogoDtoSchema = z.object({
  logoUrl: z.string().trim().nullable().optional(),
});

export const sendMessageDtoSchema = z.object({
  content: z.string().trim().min(1, "Message content is required"),
  templateId: z.string().optional(),
  template: promptTemplateSchema.optional(),
  contextIds: z.array(z.string().min(1)).max(50).optional(),
  includeProjectSummary: z.boolean().optional(),
});

export const toggleAllContextsDtoSchema = z.object({
  enable: z.boolean(),
});

export const scanSingleChecklistDtoSchema = z.object({
  item: checklistItemConfigSchema.optional(),
});

export const syncLogLevelSchema = z.enum([
  "info",
  "success",
  "update",
  "warn",
  "error",
]);

export const syncLogEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  level: syncLogLevelSchema,
  message: z.string(),
  ticker: z.string().optional(),
  projectName: z.string().optional(),
});

export const syncProjectsDtoSchema = z
  .object({
    provider: syncProviderSchema,
    limit: z.coerce
      .number()
      .int()
      .min(1, "Sync limit must be at least 1 per minute")
      .max(1000, "Sync limit must be 1000 or fewer per minute")
      .default(10),
    page: z.coerce
      .number()
      .int()
      .min(1, "Page must be at least 1")
      .max(10000, "Page must be 10000 or fewer")
      .optional(),
    minRank: z.coerce
      .number()
      .int()
      .min(1, "Minimum rank must be at least 1")
      .max(100000, "Minimum rank must be 100000 or fewer")
      .nullable()
      .optional(),
    maxRank: z.coerce
      .number()
      .int()
      .min(1, "Maximum rank must be at least 1")
      .max(100000, "Maximum rank must be 100000 or fewer")
      .nullable()
      .optional(),
    noLimit: z.boolean().optional().default(false),
    continuous: z.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    if (
      data.minRank !== null &&
      data.minRank !== undefined &&
      data.maxRank !== null &&
      data.maxRank !== undefined &&
      data.minRank > data.maxRank
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["maxRank"],
        message:
          "Maximum rank must be greater than or equal to minimum rank.",
      });
    }
  });

export const syncProviderStatusSchema = z.object({
  id: syncProviderSchema,
  name: z.string(),
  envVar: z.string(),
  apiBaseUrl: z.string(),
  configured: z.boolean(),
});

export const syncJobStateSchema = z.object({
  isRunning: z.boolean(),
  isFetchingBatch: z.boolean(),
  provider: syncProviderSchema.nullable(),
  providerName: z.string().nullable(),
  limit: z.number().int().positive(),
  noLimit: z.boolean(),
  continuous: z.boolean(),
  currentPage: z.number().int().positive(),
  minRank: z.number().int().positive().nullable().default(null),
  maxRank: z.number().int().positive().nullable().default(null),
  countdownSeconds: z.number().int().nonnegative().nullable(),
  totalCreated: z.number().int().nonnegative(),
  totalUpdated: z.number().int().nonnegative(),
  pagesCompleted: z.number().int().nonnegative(),
  lastError: z.string().nullable(),
  logs: z.array(syncLogEntrySchema).default([]),
});

export const syncProjectsResponseSchema = z.object({
  provider: syncProviderSchema,
  providerName: z.string(),
  page: z.number().int().positive().default(1),
  minRank: z.number().int().positive().nullable().optional(),
  maxRank: z.number().int().positive().nullable().optional(),
  hasMore: z.boolean().default(false),
  syncedCount: z.number().int().nonnegative(),
  updatedCount: z.number().int().nonnegative().default(0),
  skippedCount: z.number().int().nonnegative(),
  createdProjects: z.array(cryptoProjectSchema).default([]),
  updatedProjects: z.array(cryptoProjectSchema).default([]),
  projects: z.array(cryptoProjectSchema).default([]),
  logs: z.array(syncLogEntrySchema).default([]),
  message: z.string(),
});

export const systemHealthSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  service: z.string(),
  timestamp: z.string(),
  dependencies: z.object({
    database: z.enum(["up", "down"]),
    scraper: z.enum(["up", "down"]),
  }),
});

/**
 * Authentication & RBAC Schemas
 */
export const authUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  role: userRoleSchema,
  title: z.string(),
  avatarColor: z.string(),
  isActive: z.boolean(),
  permissions: z.array(permissionSchema),
  lastLoginAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});

export const authSessionResponseSchema = z.object({
  user: authUserSchema,
  accessToken: z.string().min(1),
  expiresAt: z.string(),
});

export const authRegisterResponseSchema = z.object({
  user: authUserSchema,
  requiresActivation: z.boolean(),
  message: z.string(),
});

export const loginDtoSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const registerDtoSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must be 100 characters or fewer"),
  email: z.string().trim().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be 128 characters or fewer"),
  title: z.string().trim().max(80).optional(),
});

export const createUserDtoSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must be 100 characters or fewer"),
  email: z.string().trim().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be 128 characters or fewer"),
  role: userRoleSchema,
  title: z.string().trim().max(80).optional(),
});

export const updateUserRoleDtoSchema = z.object({
  role: userRoleSchema,
});

export const updateUserStatusDtoSchema = z.object({
  isActive: z.boolean(),
});

export const auditLogItemSchema = z.object({
  id: z.string(),
  actorId: z.string().nullable().optional(),
  actorEmail: z.string(),
  actorRole: userRoleSchema,
  action: z.string(),
  resource: z.string(),
  resourceId: z.string().nullable().optional(),
  details: z.record(z.string(), z.unknown()).nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  createdAt: z.string(),
});

/**
 * Inferred TypeScript Types
 */
export type ContextType = z.infer<typeof contextTypeSchema>;
export type ProjectStage = z.infer<typeof projectStageSchema>;
export type ProjectBusinessStatus = z.infer<typeof projectBusinessStatusSchema>;
export type ProjectChain = z.infer<typeof projectChainSchema>;
export type MessageSender = z.infer<typeof messageSenderSchema>;
export type ScrapeStatus = z.infer<typeof scrapeStatusSchema>;
export type SpecializedScraperProvider = z.infer<
  typeof specializedScraperProviderSchema
>;
export type AiProvider = z.infer<typeof aiProviderSchema>;
export type AiProviderStatus = z.infer<typeof aiProviderStatusSchema>;
export type AiConfigurationSummary = z.infer<typeof aiConfigurationSummarySchema>;
export type UpdateAiProviderConfigDto = z.infer<
  typeof updateAiProviderConfigDtoSchema
>;
export type ActivateAiProviderDto = z.infer<typeof activateAiProviderDtoSchema>;
export type AiProviderModelsResponse = z.infer<
  typeof aiProviderModelsResponseSchema
>;
export type ScrapeWaitUntil = z.infer<typeof scrapeWaitUntilSchema>;
export type ScrapeConfig = z.infer<typeof scrapeConfigSchema>;
export type TriggerScrapeDto = z.infer<typeof triggerScrapeDtoSchema>;
export type ScrapedHeading = z.infer<typeof scrapedHeadingSchema>;
export type ScrapedLink = z.infer<typeof scrapedLinkSchema>;
export type ScraperServicePage = z.infer<typeof scraperServicePageSchema>;
export type ScrapedPage = z.infer<typeof scrapedPageSchema>;
export type ScraperProviderStatus = z.infer<typeof scraperProviderStatusSchema>;
export type UpdateScraperProviderKeyDto = z.infer<
  typeof updateScraperProviderKeyDtoSchema
>;
export type ProjectScrapedDataResponse = z.infer<
  typeof projectScrapedDataResponseSchema
>;
export type SyncProvider = z.infer<typeof syncProviderSchema>;
export type SyncLogLevel = z.infer<typeof syncLogLevelSchema>;
export type SyncLogEntry = z.infer<typeof syncLogEntrySchema>;
export type SyncProjectsDto = z.infer<typeof syncProjectsDtoSchema>;
export type SyncProviderStatus = z.infer<typeof syncProviderStatusSchema>;
export type SyncJobState = z.infer<typeof syncJobStateSchema>;
export type SyncProjectsResponse = z.infer<typeof syncProjectsResponseSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
export type Permission = z.infer<typeof permissionSchema>;
export type ScrapedMetadata = z.infer<typeof scrapedMetadataSchema>;
export type ScrapeJob = z.infer<typeof scrapeJobSchema>;
export type ScraperServiceResponse = z.infer<typeof scraperServiceResponseSchema>;
export type ProjectContextItem = z.infer<typeof projectContextItemSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type PromptTemplate = z.infer<typeof promptTemplateSchema>;
export type ChecklistItemConfig = z.infer<typeof checklistItemConfigSchema>;
export type ProjectChecklistItemState = z.infer<
  typeof projectChecklistItemStateSchema
>;
export type ProjectPlatformRank = z.infer<typeof projectPlatformRankSchema>;
export type ProjectPlatformRanks = z.infer<typeof projectPlatformRanksSchema>;
export type CryptoProject = z.infer<typeof cryptoProjectSchema>;

export type AddContextFormValues = z.infer<typeof addContextFormSchema>;
export type UpdateProjectLogoFormValues = z.infer<
  typeof updateProjectLogoFormSchema
>;
export type NewProjectFormValues = z.infer<typeof newProjectFormSchema>;
export type UpdateProjectFormValues = z.infer<typeof updateProjectFormSchema>;
export type PromptTemplateFormValues = z.infer<typeof promptTemplateFormSchema>;
export type ChecklistItemFormValues = z.infer<typeof checklistItemFormSchema>;
export type ChatComposerFormValues = z.infer<typeof chatComposerFormSchema>;

export type UpdateBusinessStatusDto = z.infer<typeof updateBusinessStatusDtoSchema>;
export type BulkUpdateBusinessStatusDto = z.infer<
  typeof bulkUpdateBusinessStatusDtoSchema
>;
export type BulkDeleteProjectsDto = z.infer<typeof bulkDeleteProjectsDtoSchema>;
export type UpdateProjectLogoDto = z.infer<typeof updateProjectLogoDtoSchema>;
export type SendMessageDto = z.infer<typeof sendMessageDtoSchema>;
export type ToggleAllContextsDto = z.infer<typeof toggleAllContextsDtoSchema>;
export type ScanSingleChecklistDto = z.infer<typeof scanSingleChecklistDtoSchema>;
export type SystemHealthStatus = z.infer<typeof systemHealthSchema>;

export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;
export type AuthRegisterResponse = z.infer<typeof authRegisterResponseSchema>;
export type LoginDto = z.infer<typeof loginDtoSchema>;
export type RegisterDto = z.infer<typeof registerDtoSchema>;
export type CreateUserDto = z.infer<typeof createUserDtoSchema>;
export type UpdateUserRoleDto = z.infer<typeof updateUserRoleDtoSchema>;
export type UpdateUserStatusDto = z.infer<typeof updateUserStatusDtoSchema>;
export type AuditLogItem = z.infer<typeof auditLogItemSchema>;
