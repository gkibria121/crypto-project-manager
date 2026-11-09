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
 * Form Validation Schemas (React Hook Form + Zod)
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

/**
 * Inferred TypeScript Types
 */
export type ContextType = z.infer<typeof contextTypeSchema>;
export type ProjectStage = z.infer<typeof projectStageSchema>;
export type ProjectBusinessStatus = z.infer<typeof projectBusinessStatusSchema>;
export type ProjectChain = z.infer<typeof projectChainSchema>;
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
