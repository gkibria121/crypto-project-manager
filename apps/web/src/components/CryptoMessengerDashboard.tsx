"use client";

import React, { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, RefreshCw } from "lucide-react";
import {
  type AddContextFormValues,
  type ChecklistItemConfig,
  hasPermission,
  type NewProjectFormValues,
  type ProjectBusinessStatus,
  type ProjectContextItem,
  type PromptTemplate,
} from "@/types/project";
import {
  useAddContextMutation,
  useAuditLogsQuery,
  useChecklistItemsQuery,
  useCreateProjectMutation,
  useCreateUserMutation,
  useCurrentUserQuery,
  useDashboardDialogs,
  useDeleteChecklistItemMutation,
  useDeleteContextMutation,
  useDeleteProjectMutation,
  useDeletePromptTemplateMutation,
  useDeleteUserMutation,
  useLoginMutation,
  useLogoutMutation,
  useMarkProjectReadMutation,
  useProjectsQuery,
  usePromptTemplatesQuery,
  useRegisterMutation,
  useResetConversationMutation,
  useSaveChecklistItemMutation,
  useSavePromptTemplateMutation,
  useScanAllChecklistItemsMutation,
  useScanSingleChecklistItemMutation,
  useScrapeAllContextsMutation,
  useScrapeContextMutation,
  useSendMessageMutation,
  useSystemHealthQuery,
  useToggleAllContextsMutation,
  useToggleChecklistItemMutation,
  useToggleContextMutation,
  useUpdateBusinessStatusMutation,
  useUpdateProjectLogoMutation,
  useUpdateProjectMutation,
  useUpdateUserRoleMutation,
  useUpdateUserStatusMutation,
  useUsersQuery,
} from "@/hooks";
import { AuthScreen } from "@/components/AuthScreen";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { AiChatPane } from "@/components/AiChatPane";
import { ContextInspector } from "@/components/ContextInspector";
import {
  AddContextDialog,
  EditProjectDialog,
  GlobalSettingsDialog,
  NewProjectDialog,
  ProjectChecklistDialog,
  TeamRbacDialog,
  UpdateProjectLogoDialog,
} from "@/components/modals";

export function CryptoMessengerDashboard() {
  const currentUserQuery = useCurrentUserQuery();
  const currentUser = currentUserQuery.data ?? null;
  const isAuthenticated = Boolean(currentUser);
  const canReadUsers = hasPermission(currentUser, "users:read");
  const canCreateProject = hasPermission(currentUser, "projects:create");

  const projectsQuery = useProjectsQuery(isAuthenticated);
  const { data: promptTemplates = [] } =
    usePromptTemplatesQuery(isAuthenticated);
  const { data: checklistItems = [] } =
    useChecklistItemsQuery(isAuthenticated);
  const { data: healthStatus } = useSystemHealthQuery();
  const { data: usersList = [] } = useUsersQuery(
    isAuthenticated && canReadUsers
  );
  const { data: auditLogs = [] } = useAuditLogsQuery(
    isAuthenticated && canReadUsers
  );

  const projects = projectsQuery.data ?? [];
  const searchParams = useSearchParams();
  const initialProjectFromUrl = searchParams.get("projectId") ?? "";

  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProjectFromUrl
  );
  const [draftPrompt, setDraftPrompt] = useState("");
  const [mobileActivePane, setMobileActivePane] = useState<"sidebar" | "chat">(
    "chat"
  );
  const [isDesktopContextOpen, setIsDesktopContextOpen] = useState(true);
  const [isMobileContextOpen, setIsMobileContextOpen] = useState(false);
  const [scrapingContextId, setScrapingContextId] = useState<string | null>(
    null
  );

  const {
    addContextDialogRef,
    newProjectDialogRef,
    editProjectDialogRef,
    editLogoDialogRef,
    checklistDialogRef,
    globalSettingsDialogRef,
    teamRbacDialogRef,
    openAddContextModal,
    openNewProjectModal,
    openEditProjectModal,
    openEditLogoModal,
    openChecklistModal,
    openGlobalSettingsModal,
    openTeamRbacModal,
  } = useDashboardDialogs();

  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();
  const logoutMutation = useLogoutMutation();
  const createUserMutation = useCreateUserMutation();
  const updateUserRoleMutation = useUpdateUserRoleMutation();
  const updateUserStatusMutation = useUpdateUserStatusMutation();
  const deleteUserMutation = useDeleteUserMutation();

  const markProjectReadMutation = useMarkProjectReadMutation();
  const createProjectMutation = useCreateProjectMutation();
  const updateProjectMutation = useUpdateProjectMutation();
  const deleteProjectMutation = useDeleteProjectMutation();
  const updateBusinessStatusMutation = useUpdateBusinessStatusMutation();
  const updateProjectLogoMutation = useUpdateProjectLogoMutation();
  const sendMessageMutation = useSendMessageMutation();
  const resetConversationMutation = useResetConversationMutation();
  const addContextMutation = useAddContextMutation();
  const toggleContextMutation = useToggleContextMutation();
  const toggleAllContextsMutation = useToggleAllContextsMutation();
  const deleteContextMutation = useDeleteContextMutation();
  const scrapeContextMutation = useScrapeContextMutation();
  const scrapeAllContextsMutation = useScrapeAllContextsMutation();
  const toggleChecklistItemMutation = useToggleChecklistItemMutation();
  const scanAllChecklistItemsMutation = useScanAllChecklistItemsMutation();
  const scanSingleChecklistItemMutation = useScanSingleChecklistItemMutation();
  const savePromptTemplateMutation = useSavePromptTemplateMutation();
  const deletePromptTemplateMutation = useDeletePromptTemplateMutation();
  const saveChecklistItemMutation = useSaveChecklistItemMutation();
  const deleteChecklistItemMutation = useDeleteChecklistItemMutation();

  const activeProject =
    projects.find((p) => p.id === selectedProjectId) ?? projects[0];

  const totalUnreadCount = projects.reduce(
    (acc, proj) => acc + (proj.unreadInsights ?? 0),
    0
  );

  if (currentUserQuery.isLoading) {
    return (
      <div className="h-dvh w-full flex bg-white dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef]">
        <div className="w-full md:w-76 lg:w-88 border-r border-[#e4e6eb] dark:border-[#222d34] p-4 space-y-3">
          <div className="h-7 w-28 rounded-lg bg-[#f0f2f5] dark:bg-[#202c33] animate-pulse" />
          <div className="h-10 w-full rounded-full bg-[#f0f2f5] dark:bg-[#202c33] animate-pulse" />
          <div className="space-y-2 pt-2">
            {[1, 2, 3, 4].map((row) => (
              <div
                key={row}
                className="h-16 w-full rounded-xl bg-[#f0f2f5] dark:bg-[#202c33] animate-pulse"
              />
            ))}
          </div>
        </div>
        <div className="hidden md:flex flex-1 items-center justify-center bg-[#f0f2f5] dark:bg-[#0b141a]">
          <div className="text-sm text-[#65676b] dark:text-[#8696a0]">
            Verifying PulseOS session & RBAC permissions...
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthScreen
        healthStatus={healthStatus}
        isSubmitting={loginMutation.isPending || registerMutation.isPending}
        onLogin={async (dto) => {
          await loginMutation.mutateAsync(dto);
        }}
        onRegister={async (dto) => {
          return registerMutation.mutateAsync(dto);
        }}
      />
    );
  }

  if (projectsQuery.isLoading) {
    return (
      <div className="h-dvh w-full flex bg-white dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef]">
        <div className="w-full md:w-76 lg:w-88 border-r border-[#e4e6eb] dark:border-[#222d34] p-4 space-y-3">
          <div className="h-7 w-28 rounded-lg bg-[#f0f2f5] dark:bg-[#202c33] animate-pulse" />
          <div className="h-10 w-full rounded-full bg-[#f0f2f5] dark:bg-[#202c33] animate-pulse" />
          <div className="space-y-2 pt-2">
            {[1, 2, 3, 4].map((row) => (
              <div
                key={row}
                className="h-16 w-full rounded-xl bg-[#f0f2f5] dark:bg-[#202c33] animate-pulse"
              />
            ))}
          </div>
        </div>
        <div className="hidden md:flex flex-1 items-center justify-center bg-[#f0f2f5] dark:bg-[#0b141a]">
          <div className="text-sm text-[#65676b] dark:text-[#8696a0]">
            Connecting to PulseOS Core API & PostgreSQL...
          </div>
        </div>
      </div>
    );
  }

  if (projectsQuery.isError) {
    return (
      <div className="h-dvh w-full flex items-center justify-center p-6 bg-[#f0f2f5] dark:bg-[#0b141a] text-[#050505] dark:text-[#e9edef]">
        <div className="max-w-md w-full rounded-2xl bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] p-6 text-center space-y-3 shadow-sm">
          <h2 className="text-base font-bold">Core Backend Unavailable</h2>
          <p className="text-xs text-[#65676b] dark:text-[#8696a0]">
            {projectsQuery.error instanceof Error
              ? projectsQuery.error.message
              : "Could not load projects from the NestJS Core API."}
          </p>
          <button
            type="button"
            onClick={() => void projectsQuery.refetch()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] text-white transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      </div>
    );
  }

  if (!activeProject) {
    return (
      <div className="h-dvh w-full flex items-center justify-center p-6 bg-[#f0f2f5] dark:bg-[#0b141a] text-[#050505] dark:text-[#e9edef]">
        <div className="max-w-md w-full rounded-2xl bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] p-6 text-center space-y-3 shadow-sm">
          <h2 className="text-base font-bold">No Crypto Projects Found</h2>
          <p className="text-xs text-[#65676b] dark:text-[#8696a0]">
            Create your first Web3 project workspace to begin orchestrating
            contexts and AI campaigns.
          </p>
          {canCreateProject && (
            <button
              type="button"
              onClick={openNewProjectModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] text-white transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>
          )}
        </div>
        <NewProjectDialog
          dialogRef={newProjectDialogRef}
          onCreateProject={async (values) => {
            const created = await createProjectMutation.mutateAsync(values);
            setSelectedProjectId(created.id);
          }}
        />
      </div>
    );
  }

  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
    setMobileActivePane("chat");
    setIsMobileContextOpen(false);
    markProjectReadMutation.mutate(id);
  };

  const handleToggleContextPanel = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1280) {
      setIsMobileContextOpen((v) => !v);
    } else {
      setIsDesktopContextOpen((v) => !v);
    }
  };

  const handleSendMessage = (content: string, template?: PromptTemplate) => {
    sendMessageMutation.mutate({
      projectId: activeProject.id,
      content,
      template,
    });
  };

  const handleToggleChecklistItem = (itemId: string) => {
    toggleChecklistItemMutation.mutate({
      projectId: activeProject.id,
      itemId,
    });
  };

  const handleScanAllChecklistItems = () => {
    scanAllChecklistItemsMutation.mutate({
      projectId: activeProject.id,
    });
  };

  const handleScanSingleItemInChat = (item: ChecklistItemConfig) => {
    setMobileActivePane("chat");
    scanSingleChecklistItemMutation.mutate({
      projectId: activeProject.id,
      item,
    });
  };

  const handleResetConversation = () => {
    resetConversationMutation.mutate(activeProject.id);
  };

  const handleToggleContext = (contextId: string) => {
    toggleContextMutation.mutate({
      projectId: activeProject.id,
      contextId,
    });
  };

  const handleToggleAllContexts = (enable: boolean) => {
    toggleAllContextsMutation.mutate({
      projectId: activeProject.id,
      enable,
    });
  };

  const handleDeleteContext = (contextId: string) => {
    deleteContextMutation.mutate({
      projectId: activeProject.id,
      contextId,
    });
  };

  const handleScrapeContext = async (contextId: string) => {
    setScrapingContextId(contextId);
    try {
      await scrapeContextMutation.mutateAsync({
        projectId: activeProject.id,
        contextId,
      });
    } finally {
      setScrapingContextId(null);
    }
  };

  const handleScrapeAllContexts = () => {
    scrapeAllContextsMutation.mutate({
      projectId: activeProject.id,
    });
  };

  const handleAddContext = (values: AddContextFormValues) => {
    addContextMutation.mutate({
      projectId: activeProject.id,
      values,
    });
  };

  const handleReferenceInPrompt = (ctx: ProjectContextItem) => {
    if (!ctx.isActive) {
      handleToggleContext(ctx.id);
    }
    setDraftPrompt((prev) =>
      prev
        ? `${prev} (${ctx.title}: ${ctx.value})`
        : `Using ${ctx.title} (${ctx.value}), `
    );
    setIsMobileContextOpen(false);
    setMobileActivePane("chat");
  };

  const handleCreateProject = async (values: NewProjectFormValues) => {
    const created = await createProjectMutation.mutateAsync(values);
    setSelectedProjectId(created.id);
    setMobileActivePane("chat");
  };

  const handleDeleteProject = () => {
    deleteProjectMutation.mutate(activeProject.id);
  };

  const handleUpdateProjectLogo = (logoUrl: string | undefined) => {
    updateProjectLogoMutation.mutate({
      projectId: activeProject.id,
      logoUrl,
    });
  };

  const handleUpdateBusinessStatus = (
    projectId: string,
    status: ProjectBusinessStatus
  ) => {
    updateBusinessStatusMutation.mutate({ projectId, status });
  };

  return (
    <div className="h-dvh w-full overflow-hidden flex relative bg-white dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef]">
      {/* Left Sidebar: Crypto Projects List */}
      <ProjectSidebar
        projects={projects}
        selectedProjectId={activeProject.id}
        onSelectProject={handleSelectProject}
        onUpdateBusinessStatus={handleUpdateBusinessStatus}
        onOpenNewProjectModal={openNewProjectModal}
        onOpenGlobalSettings={openGlobalSettingsModal}
        onOpenTeamRbacModal={openTeamRbacModal}
        onLogout={() => logoutMutation.mutate()}
        currentUser={currentUser}
        healthStatus={healthStatus}
        pendingUsersCount={usersList.filter((u) => !u.isActive).length}
        isMobileHidden={mobileActivePane !== "sidebar"}
      />

      {/* Center Section: AI Chat */}
      <AiChatPane
        project={activeProject}
        currentUser={currentUser}
        promptTemplates={promptTemplates}
        checklistItems={checklistItems}
        draftPrompt={draftPrompt}
        setDraftPrompt={setDraftPrompt}
        onSendMessage={handleSendMessage}
        onResetConversation={handleResetConversation}
        onUpdateBusinessStatus={(status) =>
          handleUpdateBusinessStatus(activeProject.id, status)
        }
        onOpenAddContextModal={openAddContextModal}
        onOpenEditLogoModal={openEditLogoModal}
        onOpenChecklistModal={openChecklistModal}
        onOpenGlobalSettings={openGlobalSettingsModal}
        isContextPanelOpen={isDesktopContextOpen || isMobileContextOpen}
        onToggleContextPanel={handleToggleContextPanel}
        isAiTyping={sendMessageMutation.isPending}
        isMobileHidden={mobileActivePane !== "chat"}
        onBackToProjects={() => setMobileActivePane("sidebar")}
        totalUnreadCount={totalUnreadCount}
      />

      {/* Right Sidebar / Mobile & Tablet Drawer: Project Contexts */}
      <ContextInspector
        project={activeProject}
        currentUser={currentUser}
        onUpdateBusinessStatus={(status) =>
          handleUpdateBusinessStatus(activeProject.id, status)
        }
        onDeleteProject={handleDeleteProject}
        onToggleContext={handleToggleContext}
        onToggleAllContexts={handleToggleAllContexts}
        onDeleteContext={handleDeleteContext}
        onScrapeContext={handleScrapeContext}
        onScrapeAllContexts={handleScrapeAllContexts}
        scrapingContextId={scrapingContextId}
        isScrapingAll={scrapeAllContextsMutation.isPending}
        onReferenceInPrompt={handleReferenceInPrompt}
        onOpenAddContextModal={openAddContextModal}
        onOpenEditLogoModal={openEditLogoModal}
        onOpenEditProjectModal={openEditProjectModal}
        isDesktopOpen={isDesktopContextOpen}
        isMobileOpen={isMobileContextOpen}
        onCloseMobile={() => setIsMobileContextOpen(false)}
      />

      {/* Modals */}
      <AddContextDialog
        dialogRef={addContextDialogRef}
        projectName={activeProject.name}
        onAddContext={handleAddContext}
      />

      <NewProjectDialog
        dialogRef={newProjectDialogRef}
        onCreateProject={handleCreateProject}
      />

      <EditProjectDialog
        dialogRef={editProjectDialogRef}
        project={activeProject}
        onUpdateProject={async (projectId, values) => {
          await updateProjectMutation.mutateAsync({ projectId, values });
        }}
      />

      <UpdateProjectLogoDialog
        dialogRef={editLogoDialogRef}
        project={activeProject}
        onUpdateLogo={handleUpdateProjectLogo}
      />

      <ProjectChecklistDialog
        dialogRef={checklistDialogRef}
        project={activeProject}
        checklistItems={checklistItems}
        onToggleChecklistItem={handleToggleChecklistItem}
        onScanAllChecklistItems={handleScanAllChecklistItems}
        onScanSingleItemInChat={handleScanSingleItemInChat}
        onOpenGlobalSettings={openGlobalSettingsModal}
        canWriteChecklist={hasPermission(currentUser, "checklist:write")}
        canWriteSettings={hasPermission(currentUser, "settings:write")}
      />

      <GlobalSettingsDialog
        dialogRef={globalSettingsDialogRef}
        promptTemplates={promptTemplates}
        onSavePromptTemplate={(tpl) => savePromptTemplateMutation.mutate(tpl)}
        onDeletePromptTemplate={(id) => deletePromptTemplateMutation.mutate(id)}
        checklistItems={checklistItems}
        onSaveChecklistItem={(item) => saveChecklistItemMutation.mutate(item)}
        onDeleteChecklistItem={(id) => deleteChecklistItemMutation.mutate(id)}
      />

      <TeamRbacDialog
        dialogRef={teamRbacDialogRef}
        currentUser={currentUser}
        users={usersList}
        auditLogs={auditLogs}
        onCreateUser={async (dto) => {
          await createUserMutation.mutateAsync(dto);
        }}
        onUpdateUserRole={async (params) => {
          await updateUserRoleMutation.mutateAsync(params);
        }}
        onUpdateUserStatus={async (params) => {
          await updateUserStatusMutation.mutateAsync(params);
        }}
        onDeleteUser={async (userId) => {
          await deleteUserMutation.mutateAsync(userId);
        }}
      />
    </div>
  );
}
