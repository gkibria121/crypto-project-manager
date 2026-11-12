import {
  agencyProfileSchema,
  aiConfigurationSummarySchema,
  aiProviderModelsResponseSchema,
  auditLogItemSchema,
  authRegisterResponseSchema,
  authSessionResponseSchema,
  authUserSchema,
  chatMentionSuggestionSchema,
  checklistItemConfigSchema,
  cryptoProjectSchema,
  fetchLeadsResultSchema,
  leadProviderStatusSchema,
  mcpOverviewSchema,
  mcpToolSummarySchema,
  projectScrapedDataResponseSchema,
  promptTemplateSchema,
  scrapeJobSchema,
  scraperProviderStatusSchema,
  syncJobStateSchema,
  syncProjectsResponseSchema,
  syncProviderStatusSchema,
  systemHealthSchema,
  type AddContextFormValues,
  type AgencyProfile,
  type AiConfigurationSummary,
  type AiProvider,
  type AiProviderModelsResponse,
  type AuditLogItem,
  type AuthRegisterResponse,
  type AuthSessionResponse,
  type AuthUser,
  type BulkDeleteProjectsDto,
  type BulkUpdateBusinessStatusDto,
  type ChatMentionSuggestion,
  type ChecklistItemConfig,
  type CreateMcpServerDto,
  type CreateUserDto,
  type CryptoProject,
  type FetchLeadsDto,
  type FetchLeadsResult,
  type LeadProvider,
  type LeadProviderStatus,
  type LoginDto,
  type McpOverview,
  type McpToolSummary,
  type NewProjectFormValues,
  type ProjectBusinessStatus,
  type ProjectScrapedDataResponse,
  type PromptTemplate,
  type RegisterDto,
  type ScrapeJob,
  type ScraperProviderStatus,
  type SpecializedScraperProvider,
  type SyncJobState,
  type SyncProjectsDto,
  type SyncProjectsResponse,
  type SyncProviderStatus,
  type SystemHealthStatus,
  type TriggerScrapeDto,
  type UpdateAgencyProfileDto,
  type UpdateAiProviderConfigDto,
  type UpdateMcpServerDto,
  type UpdateProjectFormValues,
  type UserRole,
} from "@/types/project";
import { z } from "zod";

const API_BASE = "/api/v1";

export function getSyncWebSocketUrl(): string {
  if (typeof window === "undefined") {
    return "ws://localhost:4000/ws/sync";
  }
  const explicitWs = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (explicitWs) {
    return explicitWs.endsWith("/ws/sync")
      ? explicitWs
      : `${explicitWs.replace(/\/$/, "")}/ws/sync`;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const hostname = window.location.hostname || "localhost";
  const currentPort = window.location.port;
  const apiPort =
    process.env.NEXT_PUBLIC_API_PORT?.trim() ||
    (currentPort === "3000" || currentPort === "" ? "4000" : currentPort);

  return `${protocol}//${hostname}:${apiPort}/ws/sync`;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function requestJson<T>(
  path: string,
  options: RequestInit = {},
  schema?: z.ZodType<T>
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const text = await response.text();
  let parsedBody: unknown = null;
  if (text) {
    try {
      parsedBody = JSON.parse(text);
    } catch {
      parsedBody = text;
    }
  }

  if (!response.ok) {
    const errMsg =
      typeof parsedBody === "object" &&
      parsedBody !== null &&
      "message" in parsedBody
        ? String(
            Array.isArray((parsedBody as { message: unknown }).message)
              ? (parsedBody as { message: unknown[] }).message.join(", ")
              : (parsedBody as { message: unknown }).message
          )
        : `Request failed with status ${response.status}`;
    const errCode =
      typeof parsedBody === "object" &&
      parsedBody !== null &&
      "code" in parsedBody &&
      typeof (parsedBody as { code: unknown }).code === "string"
        ? (parsedBody as { code: string }).code
        : undefined;
    throw new ApiClientError(errMsg, response.status, errCode);
  }

  if (schema) {
    return schema.parse(parsedBody);
  }
  return parsedBody as T;
}

const scrapeContextResultSchema = z.object({
  project: cryptoProjectSchema,
  job: scrapeJobSchema,
});

const scrapeAllResultSchema = z.object({
  project: cryptoProjectSchema,
  jobs: z.array(scrapeJobSchema),
});

export const apiClient = {
  fetchSystemHealth(): Promise<SystemHealthStatus> {
    return requestJson("/system/health", { method: "GET" }, systemHealthSchema);
  },

  fetchCurrentUser(): Promise<AuthUser> {
    return requestJson("/auth/me", { method: "GET" }, authUserSchema);
  },

  login(input: LoginDto): Promise<AuthSessionResponse> {
    return requestJson(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      authSessionResponseSchema
    );
  },

  register(input: RegisterDto): Promise<AuthRegisterResponse> {
    return requestJson(
      "/auth/register",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      authRegisterResponseSchema
    );
  },

  logout(): Promise<{ loggedOut: boolean }> {
    return requestJson("/auth/logout", { method: "POST" });
  },

  fetchUsers(): Promise<AuthUser[]> {
    return requestJson("/users", { method: "GET" }, z.array(authUserSchema));
  },

  fetchAuditLogs(): Promise<AuditLogItem[]> {
    return requestJson(
      "/users/audit-logs",
      { method: "GET" },
      z.array(auditLogItemSchema)
    );
  },

  createUser(input: CreateUserDto): Promise<AuthUser[]> {
    return requestJson(
      "/users",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      z.array(authUserSchema)
    );
  },

  updateUserRole(params: {
    userId: string;
    role: UserRole;
  }): Promise<AuthUser[]> {
    return requestJson(
      `/users/${encodeURIComponent(params.userId)}/role`,
      {
        method: "PATCH",
        body: JSON.stringify({ role: params.role }),
      },
      z.array(authUserSchema)
    );
  },

  updateUserStatus(params: {
    userId: string;
    isActive: boolean;
  }): Promise<AuthUser[]> {
    return requestJson(
      `/users/${encodeURIComponent(params.userId)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ isActive: params.isActive }),
      },
      z.array(authUserSchema)
    );
  },

  activateUser(userId: string): Promise<AuthUser[]> {
    return requestJson(
      `/users/${encodeURIComponent(userId)}/activate`,
      {
        method: "PATCH",
      },
      z.array(authUserSchema)
    );
  },

  deleteUser(userId: string): Promise<AuthUser[]> {
    return requestJson(
      `/users/${encodeURIComponent(userId)}`,
      { method: "DELETE" },
      z.array(authUserSchema)
    );
  },

  deleteProject(projectId: string): Promise<{ deleted: boolean; id: string }> {
    return requestJson(`/projects/${encodeURIComponent(projectId)}`, {
      method: "DELETE",
    });
  },

  fetchProjects(): Promise<CryptoProject[]> {
    return requestJson(
      "/projects",
      { method: "GET" },
      z.array(cryptoProjectSchema)
    );
  },

  fetchSyncProviders(): Promise<SyncProviderStatus[]> {
    return requestJson(
      "/projects/sync/providers",
      { method: "GET" },
      z.array(syncProviderStatusSchema)
    );
  },

  fetchSyncStatus(): Promise<SyncJobState> {
    return requestJson(
      "/projects/sync/status",
      { method: "GET" },
      syncJobStateSchema
    );
  },

  startAsyncProjectSync(input: SyncProjectsDto): Promise<SyncJobState> {
    return requestJson(
      "/projects/sync/start",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      syncJobStateSchema
    );
  },

  stopAsyncProjectSync(): Promise<SyncJobState> {
    return requestJson(
      "/projects/sync/stop",
      { method: "POST" },
      syncJobStateSchema
    );
  },

  triggerNextSyncPage(): Promise<SyncJobState> {
    return requestJson(
      "/projects/sync/next",
      { method: "POST" },
      syncJobStateSchema
    );
  },

  resetProjectSyncCursor(): Promise<SyncJobState> {
    return requestJson(
      "/projects/sync/reset",
      { method: "POST" },
      syncJobStateSchema
    );
  },

  clearProjectSyncLogs(): Promise<SyncJobState> {
    return requestJson(
      "/projects/sync/logs/clear",
      { method: "POST" },
      syncJobStateSchema
    );
  },

  syncProjects(input: SyncProjectsDto): Promise<SyncProjectsResponse> {
    return requestJson(
      "/projects/sync",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      syncProjectsResponseSchema
    );
  },

  fetchPromptTemplates(): Promise<PromptTemplate[]> {
    return requestJson(
      "/settings/prompt-templates",
      { method: "GET" },
      z.array(promptTemplateSchema)
    );
  },

  fetchChecklistItems(): Promise<ChecklistItemConfig[]> {
    return requestJson(
      "/settings/checklist-items",
      { method: "GET" },
      z.array(checklistItemConfigSchema)
    );
  },

  markProjectAsRead(projectId: string): Promise<CryptoProject> {
    return requestJson(
      `/projects/${encodeURIComponent(projectId)}/read`,
      { method: "PATCH" },
      cryptoProjectSchema
    );
  },

  createProject(input: NewProjectFormValues): Promise<CryptoProject> {
    return requestJson(
      "/projects",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      cryptoProjectSchema
    );
  },

  updateProject(params: {
    projectId: string;
    values: UpdateProjectFormValues;
  }): Promise<CryptoProject> {
    return requestJson(
      `/projects/${encodeURIComponent(params.projectId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(params.values),
      },
      cryptoProjectSchema
    );
  },

  updateBusinessStatus(params: {
    projectId: string;
    status: ProjectBusinessStatus;
  }): Promise<CryptoProject> {
    return requestJson(
      `/projects/${encodeURIComponent(params.projectId)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: params.status }),
      },
      cryptoProjectSchema
    );
  },

  bulkUpdateBusinessStatus(input: BulkUpdateBusinessStatusDto): Promise<{
    updatedCount: number;
    updatedIds: string[];
    status: ProjectBusinessStatus;
  }> {
    return requestJson("/projects/bulk/status", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  bulkDeleteProjects(input: BulkDeleteProjectsDto): Promise<{
    deletedCount: number;
    deletedIds: string[];
  }> {
    return requestJson("/projects/bulk/delete", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updateProjectLogo(params: {
    projectId: string;
    logoUrl: string | undefined;
  }): Promise<CryptoProject> {
    return requestJson(
      `/projects/${encodeURIComponent(params.projectId)}/logo`,
      {
        method: "PATCH",
        body: JSON.stringify({ logoUrl: params.logoUrl ?? null }),
      },
      cryptoProjectSchema
    );
  },

  sendMessage(params: {
    projectId: string;
    content: string;
    template?: PromptTemplate;
    contextIds?: string[];
    includeProjectSummary?: boolean;
  }): Promise<CryptoProject> {
    return requestJson(
      `/projects/${encodeURIComponent(params.projectId)}/chat/messages`,
      {
        method: "POST",
        body: JSON.stringify({
          content: params.content,
          templateId: params.template?.id,
          template: params.template,
          ...(params.contextIds && params.contextIds.length > 0
            ? { contextIds: params.contextIds }
            : {}),
          ...(params.includeProjectSummary
            ? { includeProjectSummary: true }
            : {}),
        }),
      },
      cryptoProjectSchema
    );
  },

  resetConversation(projectId: string): Promise<CryptoProject> {
    return requestJson(
      `/projects/${encodeURIComponent(projectId)}/chat/reset`,
      { method: "POST" },
      cryptoProjectSchema
    );
  },

  addContext(params: {
    projectId: string;
    values: AddContextFormValues;
  }): Promise<CryptoProject> {
    return requestJson(
      `/projects/${encodeURIComponent(params.projectId)}/contexts`,
      {
        method: "POST",
        body: JSON.stringify(params.values),
      },
      cryptoProjectSchema
    );
  },

  toggleContext(params: {
    projectId: string;
    contextId: string;
  }): Promise<CryptoProject> {
    return requestJson(
      `/projects/${encodeURIComponent(params.projectId)}/contexts/${encodeURIComponent(params.contextId)}/toggle`,
      { method: "PATCH" },
      cryptoProjectSchema
    );
  },

  toggleAllContexts(params: {
    projectId: string;
    enable: boolean;
  }): Promise<CryptoProject> {
    return requestJson(
      `/projects/${encodeURIComponent(params.projectId)}/contexts/toggle-all`,
      {
        method: "PATCH",
        body: JSON.stringify({ enable: params.enable }),
      },
      cryptoProjectSchema
    );
  },

  deleteContext(params: {
    projectId: string;
    contextId: string;
  }): Promise<CryptoProject> {
    return requestJson(
      `/projects/${encodeURIComponent(params.projectId)}/contexts/${encodeURIComponent(params.contextId)}`,
      { method: "DELETE" },
      cryptoProjectSchema
    );
  },

  scrapeContext(params: {
    projectId: string;
    contextId: string;
    config?: TriggerScrapeDto;
  }): Promise<{ project: CryptoProject; job: ScrapeJob }> {
    return requestJson(
      `/projects/${encodeURIComponent(params.projectId)}/contexts/${encodeURIComponent(params.contextId)}/scrape`,
      {
        method: "POST",
        body: JSON.stringify(params.config ?? {}),
      },
      scrapeContextResultSchema
    );
  },

  scrapeAllContexts(params: {
    projectId: string;
    config?: TriggerScrapeDto;
  }): Promise<{ project: CryptoProject; jobs: ScrapeJob[] }> {
    return requestJson(
      `/projects/${encodeURIComponent(params.projectId)}/scrape-all`,
      {
        method: "POST",
        body: JSON.stringify(params.config ?? {}),
      },
      scrapeAllResultSchema
    );
  },

  fetchProjectScrapedData(params: {
    projectId: string;
    contextId?: string | null;
    jobId?: string | null;
  }): Promise<ProjectScrapedDataResponse> {
    const search = new URLSearchParams();
    if (params.contextId) search.set("contextId", params.contextId);
    if (params.jobId) search.set("jobId", params.jobId);
    const qs = search.toString();
    return requestJson(
      `/projects/${encodeURIComponent(params.projectId)}/scraped-data${qs ? `?${qs}` : ""}`,
      { method: "GET" },
      projectScrapedDataResponseSchema
    );
  },

  fetchScraperProviders(): Promise<ScraperProviderStatus[]> {
    return requestJson(
      "/scraper/providers",
      { method: "GET" },
      z.array(scraperProviderStatusSchema)
    );
  },

  saveScraperProviderKey(params: {
    provider: SpecializedScraperProvider;
    apiKey: string;
  }): Promise<ScraperProviderStatus[]> {
    return requestJson(
      `/scraper/providers/${encodeURIComponent(params.provider)}`,
      {
        method: "PUT",
        body: JSON.stringify({ apiKey: params.apiKey }),
      },
      z.array(scraperProviderStatusSchema)
    );
  },

  deleteScraperProviderKey(
    provider: SpecializedScraperProvider
  ): Promise<ScraperProviderStatus[]> {
    return requestJson(
      `/scraper/providers/${encodeURIComponent(provider)}`,
      { method: "DELETE" },
      z.array(scraperProviderStatusSchema)
    );
  },

  toggleChecklistItem(params: {
    projectId: string;
    itemId: string;
  }): Promise<CryptoProject> {
    return requestJson(
      `/projects/${encodeURIComponent(params.projectId)}/checklist/${encodeURIComponent(params.itemId)}/toggle`,
      { method: "PATCH" },
      cryptoProjectSchema
    );
  },

  scanAllChecklistItems(params: {
    projectId: string;
  }): Promise<CryptoProject> {
    return requestJson(
      `/projects/${encodeURIComponent(params.projectId)}/checklist/scan-all`,
      { method: "POST" },
      cryptoProjectSchema
    );
  },

  scanSingleChecklistItem(params: {
    projectId: string;
    item: ChecklistItemConfig;
  }): Promise<CryptoProject> {
    return requestJson(
      `/projects/${encodeURIComponent(params.projectId)}/checklist/${encodeURIComponent(params.item.id)}/scan`,
      {
        method: "POST",
        body: JSON.stringify({ item: params.item }),
      },
      cryptoProjectSchema
    );
  },

  savePromptTemplate(template: PromptTemplate): Promise<PromptTemplate[]> {
    return requestJson(
      "/settings/prompt-templates",
      {
        method: "PUT",
        body: JSON.stringify(template),
      },
      z.array(promptTemplateSchema)
    );
  },

  deletePromptTemplate(id: string): Promise<PromptTemplate[]> {
    return requestJson(
      `/settings/prompt-templates/${encodeURIComponent(id)}`,
      { method: "DELETE" },
      z.array(promptTemplateSchema)
    );
  },

  saveChecklistItem(item: ChecklistItemConfig): Promise<ChecklistItemConfig[]> {
    return requestJson(
      "/settings/checklist-items",
      {
        method: "PUT",
        body: JSON.stringify(item),
      },
      z.array(checklistItemConfigSchema)
    );
  },

  deleteChecklistItem(id: string): Promise<ChecklistItemConfig[]> {
    return requestJson(
      `/settings/checklist-items/${encodeURIComponent(id)}`,
      { method: "DELETE" },
      z.array(checklistItemConfigSchema)
    );
  },

  fetchAiProviders(): Promise<AiConfigurationSummary> {
    return requestJson(
      "/settings/ai-providers",
      { method: "GET" },
      aiConfigurationSummarySchema
    );
  },

  fetchAiProviderModels(provider: AiProvider): Promise<AiProviderModelsResponse> {
    return requestJson(
      `/settings/ai-providers/${encodeURIComponent(provider)}/models`,
      { method: "GET" },
      aiProviderModelsResponseSchema
    );
  },

  saveAiProviderConfig(
    params: { provider: AiProvider } & UpdateAiProviderConfigDto
  ): Promise<AiConfigurationSummary> {
    const { provider, ...body } = params;
    return requestJson(
      `/settings/ai-providers/${encodeURIComponent(provider)}`,
      {
        method: "PUT",
        body: JSON.stringify(body),
      },
      aiConfigurationSummarySchema
    );
  },

  activateAiProvider(params: {
    provider: AiProvider;
    selectedModel?: string;
  }): Promise<AiConfigurationSummary> {
    return requestJson(
      `/settings/ai-providers/${encodeURIComponent(params.provider)}/activate`,
      {
        method: "PUT",
        body: JSON.stringify({
          ...(params.selectedModel
            ? { selectedModel: params.selectedModel }
            : {}),
        }),
      },
      aiConfigurationSummarySchema
    );
  },

  deleteAiProviderKey(provider: AiProvider): Promise<AiConfigurationSummary> {
    return requestJson(
      `/settings/ai-providers/${encodeURIComponent(provider)}`,
      { method: "DELETE" },
      aiConfigurationSummarySchema
    );
  },

  fetchChatMentions(projectId: string): Promise<ChatMentionSuggestion[]> {
    return requestJson(
      `/projects/${encodeURIComponent(projectId)}/chat/mentions`,
      { method: "GET" },
      z.array(chatMentionSuggestionSchema)
    );
  },

  fetchMcpServers(): Promise<McpOverview> {
    return requestJson("/mcp/servers", { method: "GET" }, mcpOverviewSchema);
  },

  fetchMcpTools(): Promise<McpToolSummary[]> {
    return requestJson(
      "/mcp/tools",
      { method: "GET" },
      z.array(mcpToolSummarySchema)
    );
  },

  createMcpServer(input: CreateMcpServerDto): Promise<McpOverview> {
    return requestJson(
      "/mcp/servers",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      mcpOverviewSchema
    );
  },

  updateMcpServer(params: {
    serverId: string;
    dto: UpdateMcpServerDto;
  }): Promise<McpOverview> {
    return requestJson(
      `/mcp/servers/${encodeURIComponent(params.serverId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(params.dto),
      },
      mcpOverviewSchema
    );
  },

  refreshMcpServer(serverId: string): Promise<McpOverview> {
    return requestJson(
      `/mcp/servers/${encodeURIComponent(serverId)}/refresh`,
      { method: "POST" },
      mcpOverviewSchema
    );
  },

  deleteMcpServer(serverId: string): Promise<McpOverview> {
    return requestJson(
      `/mcp/servers/${encodeURIComponent(serverId)}`,
      { method: "DELETE" },
      mcpOverviewSchema
    );
  },

  fetchAgencyProfile(): Promise<AgencyProfile> {
    return requestJson(
      "/settings/about-us",
      { method: "GET" },
      agencyProfileSchema
    );
  },

  saveAgencyProfile(input: UpdateAgencyProfileDto): Promise<AgencyProfile> {
    return requestJson(
      "/settings/about-us",
      {
        method: "PUT",
        body: JSON.stringify(input),
      },
      agencyProfileSchema
    );
  },

  fetchLeadProviders(): Promise<LeadProviderStatus[]> {
    return requestJson(
      "/leads/providers",
      { method: "GET" },
      z.array(leadProviderStatusSchema)
    );
  },

  saveLeadProviderKey(params: {
    provider: LeadProvider;
    apiKey: string;
  }): Promise<LeadProviderStatus[]> {
    return requestJson(
      `/leads/providers/${encodeURIComponent(params.provider)}`,
      {
        method: "PUT",
        body: JSON.stringify({ apiKey: params.apiKey }),
      },
      z.array(leadProviderStatusSchema)
    );
  },

  deleteLeadProviderKey(provider: LeadProvider): Promise<LeadProviderStatus[]> {
    return requestJson(
      `/leads/providers/${encodeURIComponent(provider)}`,
      { method: "DELETE" },
      z.array(leadProviderStatusSchema)
    );
  },

  fetchProjectLeads(params: {
    projectId: string;
    dto: FetchLeadsDto;
  }): Promise<FetchLeadsResult> {
    return requestJson(
      `/projects/${encodeURIComponent(params.projectId)}/leads/fetch`,
      {
        method: "POST",
        body: JSON.stringify(params.dto),
      },
      fetchLeadsResultSchema
    );
  },
};
