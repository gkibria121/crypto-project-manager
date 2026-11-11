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
]);

/**
 * Scraper & Enrichment Schemas
 */
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
});

export const scrapeJobSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  contextId: z.string().optional(),
  targetType: contextTypeSchema,
  targetValue: z.string().min(1),
  normalizedUrl: z.string().optional(),
  status: scrapeStatusSchema,
  extractedTitle: z.string().optional(),
  extractedDescription: z.string().optional(),
  detectedSocials: z.record(z.string(), z.string()).optional(),
  detectedSignals: z.array(z.string()).default([]),
  rawPreview: z.string().optional(),
  errorMessage: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
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
  businessStatus: projectBusinessStatusSchema,
  tagline: z.string().trim(),
  logoUrl: z.string().trim(),
  website: z.string().trim(),
  xHandle: z.string().trim(),
  linkedin: z.string().trim(),
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

export const updateProjectLogoDtoSchema = z.object({
  logoUrl: z.string().trim().nullable().optional(),
});

export const sendMessageDtoSchema = z.object({
  content: z.string().trim().min(1, "Message content is required"),
  templateId: z.string().optional(),
  template: promptTemplateSchema.optional(),
});

export const toggleAllContextsDtoSchema = z.object({
  enable: z.boolean(),
});

export const scanSingleChecklistDtoSchema = z.object({
  item: checklistItemConfigSchema.optional(),
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
 * Inferred TypeScript Types
 */
export type ContextType = z.infer<typeof contextTypeSchema>;
export type ProjectStage = z.infer<typeof projectStageSchema>;
export type ProjectBusinessStatus = z.infer<typeof projectBusinessStatusSchema>;
export type ProjectChain = z.infer<typeof projectChainSchema>;
export type MessageSender = z.infer<typeof messageSenderSchema>;
export type ScrapeStatus = z.infer<typeof scrapeStatusSchema>;
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
export type CryptoProject = z.infer<typeof cryptoProjectSchema>;

export type AddContextFormValues = z.infer<typeof addContextFormSchema>;
export type UpdateProjectLogoFormValues = z.infer<
  typeof updateProjectLogoFormSchema
>;
export type NewProjectFormValues = z.infer<typeof newProjectFormSchema>;
export type PromptTemplateFormValues = z.infer<typeof promptTemplateFormSchema>;
export type ChecklistItemFormValues = z.infer<typeof checklistItemFormSchema>;
export type ChatComposerFormValues = z.infer<typeof chatComposerFormSchema>;

export type UpdateBusinessStatusDto = z.infer<typeof updateBusinessStatusDtoSchema>;
export type UpdateProjectLogoDto = z.infer<typeof updateProjectLogoDtoSchema>;
export type SendMessageDto = z.infer<typeof sendMessageDtoSchema>;
export type ToggleAllContextsDto = z.infer<typeof toggleAllContextsDtoSchema>;
export type ScanSingleChecklistDto = z.infer<typeof scanSingleChecklistDtoSchema>;
export type SystemHealthStatus = z.infer<typeof systemHealthSchema>;
