"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { formatCurrentTimestamp } from "@/lib/ai-engine";
import { apiClient } from "@/services/apiClient";
import type {
  AddContextFormValues,
  AiConfigurationSummary,
  AiProvider,
  AuthUser,
  BulkDeleteProjectsDto,
  BulkUpdateBusinessStatusDto,
  ChecklistItemConfig,
  CreateUserDto,
  CryptoProject,
  LoginDto,
  NewProjectFormValues,
  ProjectBusinessStatus,
  PromptTemplate,
  RegisterDto,
  ScraperProviderStatus,
  SpecializedScraperProvider,
  SyncProjectsDto,
  SyncProjectsResponse,
  TriggerScrapeDto,
  UpdateAiProviderConfigDto,
  UpdateProjectFormValues,
  UserRole,
} from "@/types/project";

export const queryKeys = {
  health: {
    all: ["system-health"] as const,
  },
  auth: {
    me: ["auth", "me"] as const,
  },
  users: {
    all: ["users"] as const,
    auditLogs: ["users", "audit-logs"] as const,
  },
  projects: {
    all: ["projects"] as const,
    detail: (id: string) => ["projects", id] as const,
    syncProviders: ["projects", "sync-providers"] as const,
    scrapedData: (projectId: string, contextId?: string | null) =>
      ["projects", projectId, "scraped-data", contextId ?? "all"] as const,
  },
  scraper: {
    providers: ["scraper", "providers"] as const,
  },
  ai: {
    providers: ["settings", "ai-providers"] as const,
    models: (provider: AiProvider) =>
      ["settings", "ai-providers", provider, "models"] as const,
  },
  promptTemplates: {
    all: ["prompt-templates"] as const,
  },
  checklistItems: {
    all: ["checklist-items"] as const,
  },
} as const;

function syncUpdatedProjectInCache(
  queryClient: QueryClient,
  updatedProject: CryptoProject
) {
  queryClient.setQueryData<CryptoProject[]>(
    queryKeys.projects.all,
    (prev = []) => {
      const exists = prev.some((p) => p.id === updatedProject.id);
      if (!exists) return [updatedProject, ...prev];
      return prev.map((p) =>
        p.id === updatedProject.id ? updatedProject : p
      );
    }
  );
}

/**
 * Query Hooks (Live PostgreSQL State via NestJS Core API)
 */
export function useSystemHealthQuery() {
  return useQuery({
    queryKey: queryKeys.health.all,
    queryFn: () => apiClient.fetchSystemHealth(),
    refetchInterval: 30_000,
    retry: false,
  });
}

export function useCurrentUserQuery() {
  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: () => apiClient.fetchCurrentUser(),
    retry: false,
    staleTime: 60_000,
  });
}

export function useUsersQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.users.all,
    queryFn: () => apiClient.fetchUsers(),
    enabled,
  });
}

export function useAuditLogsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.users.auditLogs,
    queryFn: () => apiClient.fetchAuditLogs(),
    enabled,
  });
}

export function useProjectsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.projects.all,
    queryFn: () => apiClient.fetchProjects(),
    enabled,
  });
}

export function useSyncProvidersQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.projects.syncProviders,
    queryFn: () => apiClient.fetchSyncProviders(),
    enabled,
  });
}

export function usePromptTemplatesQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.promptTemplates.all,
    queryFn: () => apiClient.fetchPromptTemplates(),
    enabled,
  });
}

export function useChecklistItemsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.checklistItems.all,
    queryFn: () => apiClient.fetchChecklistItems(),
    enabled,
  });
}

export function useScraperProvidersQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.scraper.providers,
    queryFn: () => apiClient.fetchScraperProviders(),
    enabled,
  });
}

export function useAiProvidersQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.ai.providers,
    queryFn: () => apiClient.fetchAiProviders(),
    enabled,
  });
}

export function useProjectScrapedDataQuery(
  projectId: string | null | undefined,
  contextId?: string | null,
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.projects.scrapedData(projectId ?? "", contextId),
    queryFn: () =>
      apiClient.fetchProjectScrapedData({
        projectId: projectId ?? "",
        contextId: contextId ?? undefined,
      }),
    enabled: Boolean(projectId) && enabled,
  });
}

/**
 * Auth & RBAC Mutations
 */
export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LoginDto) => apiClient.login(input),
    onSuccess: (session) => {
      queryClient.setQueryData(queryKeys.auth.me, session.user);
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.promptTemplates.all,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.checklistItems.all,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useRegisterMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RegisterDto) => apiClient.register(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.users.auditLogs,
      });
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.logout(),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.auth.me, null);
      queryClient.removeQueries({ queryKey: queryKeys.projects.all });
      queryClient.removeQueries({ queryKey: queryKeys.users.all });
      queryClient.removeQueries({ queryKey: queryKeys.users.auditLogs });
    },
  });
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateUserDto) => apiClient.createUser(input),
    onSuccess: (users) => {
      queryClient.setQueryData<AuthUser[]>(queryKeys.users.all, users);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.users.auditLogs,
      });
    },
  });
}

export function useUpdateUserRoleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { userId: string; role: UserRole }) =>
      apiClient.updateUserRole(params),
    onSuccess: (users) => {
      queryClient.setQueryData<AuthUser[]>(queryKeys.users.all, users);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.users.auditLogs,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
    },
  });
}

export function useUpdateUserStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { userId: string; isActive: boolean }) =>
      apiClient.updateUserStatus(params),
    onSuccess: (users) => {
      queryClient.setQueryData<AuthUser[]>(queryKeys.users.all, users);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.users.auditLogs,
      });
    },
  });
}

export function useDeleteUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => apiClient.deleteUser(userId),
    onSuccess: (users) => {
      queryClient.setQueryData<AuthUser[]>(queryKeys.users.all, users);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.users.auditLogs,
      });
    },
  });
}

export function useDeleteProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => apiClient.deleteProject(projectId),
    onSuccess: ({ id }) => {
      queryClient.setQueryData<CryptoProject[]>(
        queryKeys.projects.all,
        (prev = []) => prev.filter((p) => p.id !== id)
      );
    },
  });
}

export function useBulkDeleteProjectsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BulkDeleteProjectsDto) =>
      apiClient.bulkDeleteProjects(input),
    onSuccess: ({ deletedIds }) => {
      const deletedSet = new Set(deletedIds);
      queryClient.setQueryData<CryptoProject[]>(
        queryKeys.projects.all,
        (prev = []) => prev.filter((p) => !deletedSet.has(p.id))
      );
    },
  });
}

/**
 * Project, Context, & Scraper Mutation Hooks
 */
export function useMarkProjectReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => apiClient.markProjectAsRead(projectId),
    onMutate: async (projectId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.all });
      const previousProjects = queryClient.getQueryData<CryptoProject[]>(
        queryKeys.projects.all
      );

      queryClient.setQueryData<CryptoProject[]>(
        queryKeys.projects.all,
        (prev = []) =>
          prev.map((p) =>
            p.id === projectId ? { ...p, unreadInsights: 0 } : p
          )
      );

      return { previousProjects };
    },
    onError: (_err, _projectId, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(
          queryKeys.projects.all,
          context.previousProjects
        );
      }
    },
    onSuccess: (updatedProject) => {
      syncUpdatedProjectInCache(queryClient, updatedProject);
    },
  });
}

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: NewProjectFormValues) =>
      apiClient.createProject(values),
    onSuccess: (createdProject) => {
      syncUpdatedProjectInCache(queryClient, createdProject);
    },
  });
}

export function useSyncProjectsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SyncProjectsDto) => apiClient.syncProjects(input),
    onSuccess: (response: SyncProjectsResponse) => {
      queryClient.setQueryData<CryptoProject[]>(
        queryKeys.projects.all,
        response.projects
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.users.auditLogs,
      });
    },
  });
}

export function useUpdateProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      projectId: string;
      values: UpdateProjectFormValues;
    }) => apiClient.updateProject(params),
    onSuccess: (updatedProject) => {
      syncUpdatedProjectInCache(queryClient, updatedProject);
    },
  });
}

export function useUpdateBusinessStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      projectId: string;
      status: ProjectBusinessStatus;
    }) => apiClient.updateBusinessStatus(params),
    onMutate: async ({ projectId, status }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.all });
      const previousProjects = queryClient.getQueryData<CryptoProject[]>(
        queryKeys.projects.all
      );

      queryClient.setQueryData<CryptoProject[]>(
        queryKeys.projects.all,
        (prev = []) =>
          prev.map((p) => {
            if (p.id !== projectId) return p;
            const baseTags = (p.tags ?? []).filter((t) => t !== "new");
            return {
              ...p,
              businessStatus: status,
              tags: status === "new" ? ["new", ...baseTags] : baseTags,
              lastActivityTime: "Now",
            };
          })
      );

      return { previousProjects };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(
          queryKeys.projects.all,
          context.previousProjects
        );
      }
    },
    onSuccess: (updatedProject) => {
      syncUpdatedProjectInCache(queryClient, updatedProject);
    },
  });
}

export function useBulkUpdateBusinessStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BulkUpdateBusinessStatusDto) =>
      apiClient.bulkUpdateBusinessStatus(input),
    onMutate: async ({ projectIds, status }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.all });
      const previousProjects = queryClient.getQueryData<CryptoProject[]>(
        queryKeys.projects.all
      );
      const idSet = new Set(projectIds);

      queryClient.setQueryData<CryptoProject[]>(
        queryKeys.projects.all,
        (prev = []) =>
          prev.map((p) => {
            if (!idSet.has(p.id)) return p;
            const baseTags = (p.tags ?? []).filter((t) => t !== "new");
            return {
              ...p,
              businessStatus: status,
              tags: status === "new" ? ["new", ...baseTags] : baseTags,
              lastActivityTime: "Now",
            };
          })
      );

      return { previousProjects };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(
          queryKeys.projects.all,
          context.previousProjects
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

export function useUpdateProjectLogoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { projectId: string; logoUrl: string | undefined }) =>
      apiClient.updateProjectLogo(params),
    onMutate: async ({ projectId, logoUrl }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.all });
      const previousProjects = queryClient.getQueryData<CryptoProject[]>(
        queryKeys.projects.all
      );

      queryClient.setQueryData<CryptoProject[]>(
        queryKeys.projects.all,
        (prev = []) =>
          prev.map((p) => (p.id === projectId ? { ...p, logoUrl } : p))
      );

      return { previousProjects };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(
          queryKeys.projects.all,
          context.previousProjects
        );
      }
    },
    onSuccess: (updatedProject) => {
      syncUpdatedProjectInCache(queryClient, updatedProject);
    },
  });
}

export function useSendMessageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      projectId: string;
      content: string;
      template?: PromptTemplate;
      contextIds?: string[];
      includeProjectSummary?: boolean;
    }) => apiClient.sendMessage(params),
    onMutate: async ({ projectId, content, contextIds }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.all });
      const previousProjects = queryClient.getQueryData<CryptoProject[]>(
        queryKeys.projects.all
      );

      const optimisticAdminMsg = {
        id: `msg-optimistic-${Date.now()}`,
        sender: "admin" as const,
        content: content.trim(),
        timestamp: formatCurrentTimestamp(),
        ...(contextIds && contextIds.length > 0
          ? { usedContextIds: contextIds }
          : {}),
      };

      queryClient.setQueryData<CryptoProject[]>(
        queryKeys.projects.all,
        (prev = []) =>
          prev.map((proj) =>
            proj.id === projectId
              ? {
                  ...proj,
                  lastActivityTime: "Just now",
                  messages: [...proj.messages, optimisticAdminMsg],
                }
              : proj
          )
      );

      return { previousProjects };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(
          queryKeys.projects.all,
          context.previousProjects
        );
      }
    },
    onSuccess: (updatedProject) => {
      syncUpdatedProjectInCache(queryClient, updatedProject);
    },
  });
}

export function useResetConversationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => apiClient.resetConversation(projectId),
    onSuccess: (updatedProject) => {
      syncUpdatedProjectInCache(queryClient, updatedProject);
    },
  });
}

export function useAddContextMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { projectId: string; values: AddContextFormValues }) =>
      apiClient.addContext(params),
    onSuccess: (updatedProject) => {
      syncUpdatedProjectInCache(queryClient, updatedProject);
    },
  });
}

export function useToggleContextMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { projectId: string; contextId: string }) =>
      apiClient.toggleContext(params),
    onMutate: async ({ projectId, contextId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.all });
      const previousProjects = queryClient.getQueryData<CryptoProject[]>(
        queryKeys.projects.all
      );

      queryClient.setQueryData<CryptoProject[]>(
        queryKeys.projects.all,
        (prev = []) =>
          prev.map((proj) =>
            proj.id === projectId
              ? {
                  ...proj,
                  contexts: proj.contexts.map((c) =>
                    c.id === contextId ? { ...c, isActive: !c.isActive } : c
                  ),
                }
              : proj
          )
      );

      return { previousProjects };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(
          queryKeys.projects.all,
          context.previousProjects
        );
      }
    },
    onSuccess: (updatedProject) => {
      syncUpdatedProjectInCache(queryClient, updatedProject);
    },
  });
}

export function useToggleAllContextsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { projectId: string; enable: boolean }) =>
      apiClient.toggleAllContexts(params),
    onMutate: async ({ projectId, enable }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.all });
      const previousProjects = queryClient.getQueryData<CryptoProject[]>(
        queryKeys.projects.all
      );

      queryClient.setQueryData<CryptoProject[]>(
        queryKeys.projects.all,
        (prev = []) =>
          prev.map((proj) =>
            proj.id === projectId
              ? {
                  ...proj,
                  contexts: proj.contexts.map((c) => ({
                    ...c,
                    isActive: enable,
                  })),
                }
              : proj
          )
      );

      return { previousProjects };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(
          queryKeys.projects.all,
          context.previousProjects
        );
      }
    },
    onSuccess: (updatedProject) => {
      syncUpdatedProjectInCache(queryClient, updatedProject);
    },
  });
}

export function useDeleteContextMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { projectId: string; contextId: string }) =>
      apiClient.deleteContext(params),
    onMutate: async ({ projectId, contextId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.all });
      const previousProjects = queryClient.getQueryData<CryptoProject[]>(
        queryKeys.projects.all
      );

      queryClient.setQueryData<CryptoProject[]>(
        queryKeys.projects.all,
        (prev = []) =>
          prev.map((proj) =>
            proj.id === projectId
              ? {
                  ...proj,
                  contexts: proj.contexts.filter((c) => c.id !== contextId),
                }
              : proj
          )
      );

      return { previousProjects };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(
          queryKeys.projects.all,
          context.previousProjects
        );
      }
    },
    onSuccess: (updatedProject) => {
      syncUpdatedProjectInCache(queryClient, updatedProject);
    },
  });
}

export function useScrapeContextMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      projectId: string;
      contextId: string;
      config?: TriggerScrapeDto;
    }) => apiClient.scrapeContext(params),
    onSuccess: ({ project }) => {
      syncUpdatedProjectInCache(queryClient, project);
      void queryClient.invalidateQueries({
        queryKey: ["projects", project.id, "scraped-data"],
      });
    },
  });
}

export function useScrapeAllContextsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { projectId: string; config?: TriggerScrapeDto }) =>
      apiClient.scrapeAllContexts(params),
    onSuccess: ({ project }) => {
      syncUpdatedProjectInCache(queryClient, project);
      void queryClient.invalidateQueries({
        queryKey: ["projects", project.id, "scraped-data"],
      });
    },
  });
}

export function useSaveScraperProviderKeyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      provider: SpecializedScraperProvider;
      apiKey: string;
    }) => apiClient.saveScraperProviderKey(params),
    onSuccess: (statuses) => {
      queryClient.setQueryData<ScraperProviderStatus[]>(
        queryKeys.scraper.providers,
        statuses
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.users.auditLogs,
      });
    },
  });
}

export function useDeleteScraperProviderKeyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (provider: SpecializedScraperProvider) =>
      apiClient.deleteScraperProviderKey(provider),
    onSuccess: (statuses) => {
      queryClient.setQueryData<ScraperProviderStatus[]>(
        queryKeys.scraper.providers,
        statuses
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.users.auditLogs,
      });
    },
  });
}

export function useToggleChecklistItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { projectId: string; itemId: string }) =>
      apiClient.toggleChecklistItem(params),
    onMutate: async ({ projectId, itemId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.all });
      const previousProjects = queryClient.getQueryData<CryptoProject[]>(
        queryKeys.projects.all
      );

      queryClient.setQueryData<CryptoProject[]>(
        queryKeys.projects.all,
        (prev = []) =>
          prev.map((proj) => {
            if (proj.id !== projectId) return proj;
            const prevMap = proj.checklistState ?? {};
            const prevItem = prevMap[itemId];
            return {
              ...proj,
              checklistState: {
                ...prevMap,
                [itemId]: {
                  ...prevItem,
                  checked: !prevItem?.checked,
                },
              },
            };
          })
      );

      return { previousProjects };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(
          queryKeys.projects.all,
          context.previousProjects
        );
      }
    },
    onSuccess: (updatedProject) => {
      syncUpdatedProjectInCache(queryClient, updatedProject);
    },
  });
}

export function useScanAllChecklistItemsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { projectId: string }) =>
      apiClient.scanAllChecklistItems(params),
    onSuccess: (updatedProject) => {
      syncUpdatedProjectInCache(queryClient, updatedProject);
    },
  });
}

export function useScanSingleChecklistItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { projectId: string; item: ChecklistItemConfig }) =>
      apiClient.scanSingleChecklistItem(params),
    onSuccess: (updatedProject) => {
      syncUpdatedProjectInCache(queryClient, updatedProject);
    },
  });
}

/**
 * Global Settings (Prompt Templates & Checklist Items) Mutations
 */
export function useSavePromptTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (template: PromptTemplate) =>
      apiClient.savePromptTemplate(template),
    onMutate: async (updated) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.promptTemplates.all,
      });
      const previous = queryClient.getQueryData<PromptTemplate[]>(
        queryKeys.promptTemplates.all
      );

      queryClient.setQueryData<PromptTemplate[]>(
        queryKeys.promptTemplates.all,
        (prev = []) => {
          const exists = prev.some((t) => t.id === updated.id);
          return exists
            ? prev.map((t) => (t.id === updated.id ? updated : t))
            : [...prev, updated];
        }
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.promptTemplates.all,
          context.previous
        );
      }
    },
    onSuccess: (nextList) => {
      queryClient.setQueryData(queryKeys.promptTemplates.all, nextList);
    },
  });
}

export function useDeletePromptTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deletePromptTemplate(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.promptTemplates.all,
      });
      const previous = queryClient.getQueryData<PromptTemplate[]>(
        queryKeys.promptTemplates.all
      );

      queryClient.setQueryData<PromptTemplate[]>(
        queryKeys.promptTemplates.all,
        (prev = []) => prev.filter((t) => t.id !== id)
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.promptTemplates.all,
          context.previous
        );
      }
    },
    onSuccess: (nextList) => {
      queryClient.setQueryData(queryKeys.promptTemplates.all, nextList);
    },
  });
}

export function useSaveChecklistItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (item: ChecklistItemConfig) => apiClient.saveChecklistItem(item),
    onMutate: async (updated) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.checklistItems.all,
      });
      const previous = queryClient.getQueryData<ChecklistItemConfig[]>(
        queryKeys.checklistItems.all
      );

      queryClient.setQueryData<ChecklistItemConfig[]>(
        queryKeys.checklistItems.all,
        (prev = []) => {
          const exists = prev.some((i) => i.id === updated.id);
          return exists
            ? prev.map((i) => (i.id === updated.id ? updated : i))
            : [...prev, updated];
        }
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.checklistItems.all,
          context.previous
        );
      }
    },
    onSuccess: (nextList) => {
      queryClient.setQueryData(queryKeys.checklistItems.all, nextList);
    },
  });
}

export function useDeleteChecklistItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteChecklistItem(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.checklistItems.all,
      });
      const previous = queryClient.getQueryData<ChecklistItemConfig[]>(
        queryKeys.checklistItems.all
      );

      queryClient.setQueryData<ChecklistItemConfig[]>(
        queryKeys.checklistItems.all,
        (prev = []) => prev.filter((i) => i.id !== id)
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.checklistItems.all,
          context.previous
        );
      }
    },
    onSuccess: (nextList) => {
      queryClient.setQueryData(queryKeys.checklistItems.all, nextList);
    },
  });
}

/**
 * Multi-Provider AI Configuration Mutations
 */
export function useSaveAiProviderConfigMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { provider: AiProvider } & UpdateAiProviderConfigDto) =>
      apiClient.saveAiProviderConfig(params),
    onSuccess: (summary) => {
      queryClient.setQueryData<AiConfigurationSummary>(
        queryKeys.ai.providers,
        summary
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.users.auditLogs,
      });
    },
  });
}

export function useActivateAiProviderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { provider: AiProvider; selectedModel?: string }) =>
      apiClient.activateAiProvider(params),
    onSuccess: (summary) => {
      queryClient.setQueryData<AiConfigurationSummary>(
        queryKeys.ai.providers,
        summary
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.users.auditLogs,
      });
    },
  });
}

export function useDeleteAiProviderKeyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (provider: AiProvider) =>
      apiClient.deleteAiProviderKey(provider),
    onSuccess: (summary) => {
      queryClient.setQueryData<AiConfigurationSummary>(
        queryKeys.ai.providers,
        summary
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.users.auditLogs,
      });
    },
  });
}
