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
  ChecklistItemConfig,
  CryptoProject,
  NewProjectFormValues,
  ProjectBusinessStatus,
  PromptTemplate,
} from "@/types/project";

export const queryKeys = {
  health: {
    all: ["system-health"] as const,
  },
  projects: {
    all: ["projects"] as const,
    detail: (id: string) => ["projects", id] as const,
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

export function useProjectsQuery() {
  return useQuery({
    queryKey: queryKeys.projects.all,
    queryFn: () => apiClient.fetchProjects(),
  });
}

export function usePromptTemplatesQuery() {
  return useQuery({
    queryKey: queryKeys.promptTemplates.all,
    queryFn: () => apiClient.fetchPromptTemplates(),
  });
}

export function useChecklistItemsQuery() {
  return useQuery({
    queryKey: queryKeys.checklistItems.all,
    queryFn: () => apiClient.fetchChecklistItems(),
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
          prev.map((p) =>
            p.id === projectId
              ? { ...p, businessStatus: status, lastActivityTime: "Now" }
              : p
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
    }) => apiClient.sendMessage(params),
    onMutate: async ({ projectId, content }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.all });
      const previousProjects = queryClient.getQueryData<CryptoProject[]>(
        queryKeys.projects.all
      );

      const optimisticAdminMsg = {
        id: `msg-optimistic-${Date.now()}`,
        sender: "admin" as const,
        content: content.trim(),
        timestamp: formatCurrentTimestamp(),
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
    mutationFn: (params: { projectId: string; contextId: string }) =>
      apiClient.scrapeContext(params),
    onSuccess: ({ project }) => {
      syncUpdatedProjectInCache(queryClient, project);
    },
  });
}

export function useScrapeAllContextsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { projectId: string }) =>
      apiClient.scrapeAllContexts(params),
    onSuccess: ({ project }) => {
      syncUpdatedProjectInCache(queryClient, project);
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
