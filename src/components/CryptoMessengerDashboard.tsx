"use client";

import React, { useState } from "react";
import { INITIAL_PROJECTS } from "@/data/mockProjects";
import type {
  AddContextFormValues,
  ChecklistItemConfig,
  NewProjectFormValues,
  ProjectBusinessStatus,
  ProjectContextItem,
  PromptTemplate,
} from "@/types/project";
import {
  useAddContextMutation,
  useChecklistItemsQuery,
  useCreateProjectMutation,
  useDashboardDialogs,
  useDeleteChecklistItemMutation,
  useDeleteContextMutation,
  useDeletePromptTemplateMutation,
  useMarkProjectReadMutation,
  useProjectsQuery,
  usePromptTemplatesQuery,
  useResetConversationMutation,
  useSaveChecklistItemMutation,
  useSavePromptTemplateMutation,
  useScanAllChecklistItemsMutation,
  useScanSingleChecklistItemMutation,
  useSendMessageMutation,
  useToggleAllContextsMutation,
  useToggleChecklistItemMutation,
  useToggleContextMutation,
  useUpdateBusinessStatusMutation,
  useUpdateProjectLogoMutation,
} from "@/hooks";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { AiChatPane } from "@/components/AiChatPane";
import { ContextInspector } from "@/components/ContextInspector";
import {
  AddContextDialog,
  GlobalSettingsDialog,
  NewProjectDialog,
  ProjectChecklistDialog,
  UpdateProjectLogoDialog,
} from "@/components/modals";

export function CryptoMessengerDashboard() {
  const { data: projects = INITIAL_PROJECTS } = useProjectsQuery();
  const { data: promptTemplates = [] } = usePromptTemplatesQuery();
  const { data: checklistItems = [] } = useChecklistItemsQuery();

  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    INITIAL_PROJECTS[0].id
  );
  const [draftPrompt, setDraftPrompt] = useState("");
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(true);

  const {
    addContextDialogRef,
    newProjectDialogRef,
    editLogoDialogRef,
    checklistDialogRef,
    globalSettingsDialogRef,
    openAddContextModal,
    openNewProjectModal,
    openEditLogoModal,
    openChecklistModal,
    openGlobalSettingsModal,
  } = useDashboardDialogs();

  const markProjectReadMutation = useMarkProjectReadMutation();
  const createProjectMutation = useCreateProjectMutation();
  const updateBusinessStatusMutation = useUpdateBusinessStatusMutation();
  const updateProjectLogoMutation = useUpdateProjectLogoMutation();
  const sendMessageMutation = useSendMessageMutation();
  const resetConversationMutation = useResetConversationMutation();
  const addContextMutation = useAddContextMutation();
  const toggleContextMutation = useToggleContextMutation();
  const toggleAllContextsMutation = useToggleAllContextsMutation();
  const deleteContextMutation = useDeleteContextMutation();
  const toggleChecklistItemMutation = useToggleChecklistItemMutation();
  const scanAllChecklistItemsMutation = useScanAllChecklistItemsMutation();
  const scanSingleChecklistItemMutation = useScanSingleChecklistItemMutation();
  const savePromptTemplateMutation = useSavePromptTemplateMutation();
  const deletePromptTemplateMutation = useDeletePromptTemplateMutation();
  const saveChecklistItemMutation = useSaveChecklistItemMutation();
  const deleteChecklistItemMutation = useDeleteChecklistItemMutation();

  const activeProject =
    projects.find((p) => p.id === selectedProjectId) ?? projects[0];

  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
    markProjectReadMutation.mutate(id);
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
  };

  const handleCreateProject = async (values: NewProjectFormValues) => {
    const created = await createProjectMutation.mutateAsync(values);
    setSelectedProjectId(created.id);
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
    <div className="h-dvh w-full overflow-hidden flex bg-white dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef]">
      {/* Left Sidebar: Crypto Projects List */}
      <ProjectSidebar
        projects={projects}
        selectedProjectId={activeProject.id}
        onSelectProject={handleSelectProject}
        onUpdateBusinessStatus={handleUpdateBusinessStatus}
        onOpenNewProjectModal={openNewProjectModal}
        onOpenGlobalSettings={openGlobalSettingsModal}
      />

      {/* Center Section: AI Chat */}
      <AiChatPane
        project={activeProject}
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
        isContextPanelOpen={isContextPanelOpen}
        onToggleContextPanel={() => setIsContextPanelOpen((v) => !v)}
        isAiTyping={sendMessageMutation.isPending}
      />

      {/* Right Sidebar: Project Contexts */}
      {isContextPanelOpen && (
        <ContextInspector
          project={activeProject}
          onUpdateBusinessStatus={(status) =>
            handleUpdateBusinessStatus(activeProject.id, status)
          }
          onToggleContext={handleToggleContext}
          onToggleAllContexts={handleToggleAllContexts}
          onDeleteContext={handleDeleteContext}
          onReferenceInPrompt={handleReferenceInPrompt}
          onOpenAddContextModal={openAddContextModal}
          onOpenEditLogoModal={openEditLogoModal}
        />
      )}

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
    </div>
  );
}
