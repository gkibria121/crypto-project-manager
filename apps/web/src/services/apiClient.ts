import {
  auditLogItemSchema,
  authRegisterResponseSchema,
  authSessionResponseSchema,
  authUserSchema,
  checklistItemConfigSchema,
  cryptoProjectSchema,
  promptTemplateSchema,
  scrapeJobSchema,
  syncProjectsResponseSchema,
  syncProviderStatusSchema,
  systemHealthSchema,
  type AddContextFormValues,
  type AuditLogItem,
  type AuthRegisterResponse,
  type AuthSessionResponse,
  type AuthUser,
  type ChecklistItemConfig,
  type CreateUserDto,
  type CryptoProject,
  type LoginDto,
  type NewProjectFormValues,
  type ProjectBusinessStatus,
  type PromptTemplate,
  type RegisterDto,
  type ScrapeJob,
  type SyncProjectsDto,
  type SyncProjectsResponse,
  type SyncProviderStatus,
  type SystemHealthStatus,
  type UpdateProjectFormValues,
  type UserRole,
} from "@/types/project";
import { z } from "zod";

const API_BASE = "/api/v1";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
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
    throw new ApiClientError(errMsg, response.status);
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
  }): Promise<CryptoProject> {
    return requestJson(
      `/projects/${encodeURIComponent(params.projectId)}/chat/messages`,
      {
        method: "POST",
        body: JSON.stringify({
          content: params.content,
          templateId: params.template?.id,
          template: params.template,
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
  }): Promise<{ project: CryptoProject; job: ScrapeJob }> {
    return requestJson(
      `/projects/${encodeURIComponent(params.projectId)}/contexts/${encodeURIComponent(params.contextId)}/scrape`,
      { method: "POST" },
      scrapeContextResultSchema
    );
  },

  scrapeAllContexts(params: {
    projectId: string;
  }): Promise<{ project: CryptoProject; jobs: ScrapeJob[] }> {
    return requestJson(
      `/projects/${encodeURIComponent(params.projectId)}/scrape-all`,
      { method: "POST" },
      scrapeAllResultSchema
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
};
