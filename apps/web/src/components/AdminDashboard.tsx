"use client";

import React, { useId, useRef, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Activity,
  Archive,
  ArchiveRestore,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  CloudDownload,
  Database,
  FolderKanban,
  Globe,
  History,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X as XIcon,
} from "lucide-react";
import {
  ALL_PERMISSIONS,
  BUSINESS_STATUS_META,
  BUSINESS_STATUS_ORDER,
  COMPACT_PAGE_SIZE_OPTIONS,
  DEFAULT_PAGE_SIZE_OPTIONS,
  PERMISSION_LABELS,
  ROLE_PERMISSIONS,
  USER_ROLES,
  USER_ROLE_META,
  checklistItemFormSchema,
  createUserDtoSchema,
  hasPermission,
  promptTemplateFormSchema,
  type AuthUser,
  type ChecklistItemFormValues,
  type CreateUserDto,
  type CryptoProject,
  type NewProjectFormValues,
  type ProjectBusinessStatus,
  type PromptTemplateFormValues,
  type SyncProjectsDto,
  type UpdateProjectFormValues,
  type UserRole,
} from "@/types/project";
import {
  useAuditLogsQuery,
  useBulkDeleteProjectsMutation,
  useBulkUpdateBusinessStatusMutation,
  useChecklistItemsQuery,
  useCreateProjectMutation,
  useCreateUserMutation,
  useCurrentUserQuery,
  useDashboardDialogs,
  useDeleteChecklistItemMutation,
  useDeleteProjectMutation,
  useDeletePromptTemplateMutation,
  useDeleteUserMutation,
  useLoginMutation,
  useLogoutMutation,
  usePagination,
  useProjectSyncSocket,
  useProjectsQuery,
  usePromptTemplatesQuery,
  useRegisterMutation,
  useSaveChecklistItemMutation,
  useSavePromptTemplateMutation,
  useSyncProvidersQuery,
  useSystemHealthQuery,
  useUpdateBusinessStatusMutation,
  useUpdateProjectMutation,
  useUpdateUserRoleMutation,
  useUpdateUserStatusMutation,
  useUsersQuery,
} from "@/hooks";
import { AuthScreen } from "@/components/AuthScreen";
import { ProjectAvatar } from "@/components/ProjectAvatar";
import {
  EditProjectDialog,
  NewProjectDialog,
  SyncProjectsDialog,
} from "@/components/modals";
import { FilterChip, FormField, ModalDialog, PaginationBar } from "@/components/ui";

type AdminSectionId =
  | "overview"
  | "users"
  | "projects"
  | "rbac"
  | "settings"
  | "audit";

type UserFilterStatus = "all" | "pending" | "active";
type ProjectFilterStatus = "all" | ProjectBusinessStatus;
type AuditRoleFilter = "all" | UserRole;

const SECTION_META: Record<
  AdminSectionId,
  { title: string; subtitle: string }
> = {
  overview: {
    title: "Admin Overview",
    subtitle:
      "Executive metrics, pending user activations, system health, and recent workspace activity.",
  },
  users: {
    title: "Users & Approvals",
    subtitle:
      "Approve newly registered accounts, provision active team members, and manage RBAC role assignments.",
  },
  projects: {
    title: "Crypto Projects Governance",
    subtitle:
      "Oversee all Web3 project workspaces, edit project profiles and photos, and manage pipeline stages.",
  },
  rbac: {
    title: "Roles & Permissions Matrix",
    subtitle:
      "Inspect role-based access control policies and permission grants enforced across the platform.",
  },
  settings: {
    title: "AI Prompts & Global Checklist",
    subtitle:
      "Configure global AI system prompt templates and due-diligence checklist items shared across projects.",
  },
  audit: {
    title: "Security & Activation Audit Log",
    subtitle:
      "Review chronological authentication, user activation, and RBAC governance events.",
  },
};

export function AdminDashboard() {
  const currentUserQuery = useCurrentUserQuery();
  const currentUser = currentUserQuery.data ?? null;
  const isAuthenticated = Boolean(currentUser);
  const isAdmin =
    currentUser?.role === "admin" ||
    hasPermission(currentUser, "users:write");

  const { data: healthStatus, refetch: refetchHealth } = useSystemHealthQuery();
  const usersQuery = useUsersQuery(isAuthenticated && isAdmin);
  const projectsQuery = useProjectsQuery(isAuthenticated && isAdmin);
  const auditLogsQuery = useAuditLogsQuery(isAuthenticated && isAdmin);
  const promptTemplatesQuery = usePromptTemplatesQuery(
    isAuthenticated && isAdmin
  );
  const checklistItemsQuery = useChecklistItemsQuery(
    isAuthenticated && isAdmin
  );
  const syncProvidersQuery = useSyncProvidersQuery(
    isAuthenticated && isAdmin
  );

  const users = usersQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const auditLogs = auditLogsQuery.data ?? [];
  const promptTemplates = promptTemplatesQuery.data ?? [];
  const checklistItems = checklistItemsQuery.data ?? [];
  const syncProviders = syncProvidersQuery.data ?? [];

  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();
  const logoutMutation = useLogoutMutation();
  const createUserMutation = useCreateUserMutation();
  const updateUserRoleMutation = useUpdateUserRoleMutation();
  const updateUserStatusMutation = useUpdateUserStatusMutation();
  const deleteUserMutation = useDeleteUserMutation();

  const createProjectMutation = useCreateProjectMutation();
  const updateProjectMutation = useUpdateProjectMutation();
  const updateBusinessStatusMutation = useUpdateBusinessStatusMutation();
  const bulkUpdateBusinessStatusMutation =
    useBulkUpdateBusinessStatusMutation();
  const bulkDeleteProjectsMutation = useBulkDeleteProjectsMutation();
  const deleteProjectMutation = useDeleteProjectMutation();

  const {
    jobState: syncJobState,
    wsConnected: syncWsConnected,
    startSync: startAsyncSync,
    stopSync: stopAsyncSync,
    triggerNextPage: triggerNextSyncPage,
    resetCursor: resetSyncCursor,
    clearLogs: clearSyncLogs,
  } = useProjectSyncSocket(isAuthenticated && isAdmin);

  const savePromptTemplateMutation = useSavePromptTemplateMutation();
  const deletePromptTemplateMutation = useDeletePromptTemplateMutation();
  const saveChecklistItemMutation = useSaveChecklistItemMutation();
  const deleteChecklistItemMutation = useDeleteChecklistItemMutation();

  const {
    newProjectDialogRef,
    editProjectDialogRef,
    syncProjectsDialogRef,
    bulkDeleteProjectsDialogRef,
    openNewProjectModal,
    openEditProjectModal,
    openSyncProjectsModal,
    openBulkDeleteProjectsModal,
  } = useDashboardDialogs();

  const mainHeadingRef = useRef<HTMLHeadingElement | null>(null);

  const [activeSection, setActiveSection] =
    useState<AdminSectionId>("overview");
  const [editingProject, setEditingProject] = useState<CryptoProject | null>(
    null
  );

  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userFilter, setUserFilter] = useState<UserFilterStatus>("all");
  const [showCreateUserForm, setShowCreateUserForm] = useState(false);

  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] =
    useState<ProjectFilterStatus>("all");
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [bulkStatusTarget, setBulkStatusTarget] =
    useState<ProjectBusinessStatus>("contacted");

  const [auditSearchQuery, setAuditSearchQuery] = useState("");
  const [auditRoleFilter, setAuditRoleFilter] =
    useState<AuditRoleFilter>("all");

  const [statusAnnouncement, setStatusAnnouncement] = useState<string | null>(
    null
  );
  const [actionError, setActionError] = useState<string | null>(null);

  const usersCaptionId = useId();
  const projectsCaptionId = useId();
  const rbacCaptionId = useId();
  const userSearchInputId = useId();
  const projectSearchInputId = useId();
  const bulkStatusSelectId = useId();
  const auditSearchInputId = useId();
  const createNameId = useId();
  const createEmailId = useId();
  const createPasswordId = useId();
  const createTitleId = useId();
  const createRolePrefixId = useId();

  const createForm = useForm<CreateUserDto>({
    resolver: zodResolver(createUserDtoSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "analyst",
      title: "",
    },
  });

  const promptForm = useForm<PromptTemplateFormValues>({
    resolver: zodResolver(promptTemplateFormSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      label: "",
      systemPrompt: "",
    },
  });

  const checklistForm = useForm<ChecklistItemFormValues>({
    resolver: zodResolver(checklistItemFormSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      label: "",
      scanPrompt: "",
    },
  });

  const inactiveUsers = users.filter((u) => !u.isActive);
  const activeUsers = users.filter((u) => u.isActive);
  const newProjectsCount = projects.filter(
    (p) => p.businessStatus === "new"
  ).length;
  const activeStateProjectsCount = projects.filter(
    (p) => p.businessStatus === "active"
  ).length;
  const nonArchivedProjectsCount = projects.filter(
    (p) => p.businessStatus !== "archived"
  ).length;
  const totalContextsCount = projects.reduce(
    (acc, p) => acc + p.contexts.length,
    0
  );
  const totalMessagesCount = projects.reduce(
    (acc, p) => acc + p.messages.length,
    0
  );

  const filteredUsers = users.filter((user) => {
    const query = userSearchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.title.toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query);

    if (!matchesSearch) return false;
    if (userFilter === "pending") return !user.isActive;
    if (userFilter === "active") return user.isActive;
    return true;
  });

  const filteredProjects = projects.filter((project) => {
    const query = projectSearchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      project.name.toLowerCase().includes(query) ||
      project.ticker.toLowerCase().includes(query) ||
      project.chain.toLowerCase().includes(query) ||
      project.tagline.toLowerCase().includes(query) ||
      (project.tags ?? []).some((tag) => tag.toLowerCase().includes(query));

    if (!matchesSearch) return false;
    if (projectFilter === "all") return true;
    return project.businessStatus === projectFilter;
  });

  const filteredAuditLogs = auditLogs.filter((log) => {
    if (auditRoleFilter !== "all" && log.actorRole !== auditRoleFilter) {
      return false;
    }
    const query = auditSearchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      log.actorEmail.toLowerCase().includes(query) ||
      log.action.toLowerCase().includes(query) ||
      log.resource.toLowerCase().includes(query) ||
      JSON.stringify(log.details ?? {})
        .toLowerCase()
        .includes(query)
    );
  });

  // Shared pagination hooks across all Admin Dashboard lists & tables
  const overviewProjectsPagination = usePagination(projects, {
    initialPageSize: 5,
    pageSizeOptions: COMPACT_PAGE_SIZE_OPTIONS,
  });
  const overviewAuditPagination = usePagination(auditLogs, {
    initialPageSize: 4,
    pageSizeOptions: [4, 8, 15],
  });
  const pendingUsersPagination = usePagination(inactiveUsers, {
    initialPageSize: 6,
    pageSizeOptions: [4, 6, 12, 24],
  });
  const usersPagination = usePagination(filteredUsers, {
    initialPageSize: 10,
    pageSizeOptions: DEFAULT_PAGE_SIZE_OPTIONS,
    resetKey: `${userFilter}:${userSearchQuery}`,
  });
  const projectsPagination = usePagination(filteredProjects, {
    initialPageSize: 100,
    pageSizeOptions: DEFAULT_PAGE_SIZE_OPTIONS,
    resetKey: `${projectFilter}:${projectSearchQuery}`,
  });
  const rbacPermissionsPagination = usePagination(ALL_PERMISSIONS, {
    initialPageSize: 8,
    pageSizeOptions: [8, 12, 25],
  });
  const settingsPromptsPagination = usePagination(promptTemplates, {
    initialPageSize: 5,
    pageSizeOptions: COMPACT_PAGE_SIZE_OPTIONS,
  });
  const settingsChecklistPagination = usePagination(checklistItems, {
    initialPageSize: 5,
    pageSizeOptions: COMPACT_PAGE_SIZE_OPTIONS,
  });
  const auditLogsPagination = usePagination(filteredAuditLogs, {
    initialPageSize: 12,
    pageSizeOptions: [12, 24, 50, 100],
    resetKey: `${auditRoleFilter}:${auditSearchQuery}`,
  });

  if (currentUserQuery.isLoading) {
    return (
      <div className="h-dvh w-full flex items-center justify-center bg-[#f0f2f5] dark:bg-[#0b141a] text-[#050505] dark:text-[#e9edef]">
        <div className="text-sm text-[#65676b] dark:text-[#8696a0]">
          Verifying administrator session & RBAC credentials...
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

  if (!isAdmin) {
    return (
      <div className="h-dvh w-full flex items-center justify-center p-6 bg-[#f0f2f5] dark:bg-[#0b141a] text-[#050505] dark:text-[#e9edef]">
        <div className="max-w-md w-full rounded-2xl bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] p-6 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/12 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-bold">Administrator Access Required</h1>
            <p className="text-xs text-[#65676b] dark:text-[#8696a0]">
              You are currently signed in as <strong>{currentUser.name}</strong>{" "}
              with the{" "}
              <strong>{USER_ROLE_META[currentUser.role].label}</strong> role.
              Only workspace administrators can access the Admin Dashboard.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] text-white transition"
            >
              <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Return to Workspace</span>
            </Link>
            <button
              type="button"
              onClick={() => logoutMutation.mutate()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#f0f2f5] hover:bg-[#e4e6eb] dark:bg-[#2a3942] dark:hover:bg-[#374248] text-[#050505] dark:text-[#e9edef] transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSelectSection = (
    sectionId: AdminSectionId,
    focusHeading = false
  ) => {
    setActiveSection(sectionId);
    if (focusHeading) {
      requestAnimationFrame(() => {
        mainHeadingRef.current?.focus();
      });
    }
  };

  const handleActivateOrDeactivateUser = async (
    targetUser: AuthUser,
    nextActive: boolean
  ) => {
    setActionError(null);
    setStatusAnnouncement(null);
    try {
      await updateUserStatusMutation.mutateAsync({
        userId: targetUser.id,
        isActive: nextActive,
      });
      setStatusAnnouncement(
        nextActive
          ? `Activated account for ${targetUser.name} (${targetUser.email}).`
          : `Deactivated account for ${targetUser.name} (${targetUser.email}).`
      );
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update user status."
      );
    }
  };

  const handleActivateAllPending = async () => {
    if (inactiveUsers.length === 0) return;
    setActionError(null);
    setStatusAnnouncement(null);
    try {
      for (const pendingUser of inactiveUsers) {
        await updateUserStatusMutation.mutateAsync({
          userId: pendingUser.id,
          isActive: true,
        });
      }
      setStatusAnnouncement(
        `Activated all ${inactiveUsers.length} pending user accounts.`
      );
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to activate all pending users."
      );
    }
  };

  const handleRoleChange = async (targetUser: AuthUser, role: UserRole) => {
    setActionError(null);
    setStatusAnnouncement(null);
    try {
      await updateUserRoleMutation.mutateAsync({
        userId: targetUser.id,
        role,
      });
      setStatusAnnouncement(
        `Updated role for ${targetUser.name} to ${USER_ROLE_META[role].label}.`
      );
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update user role."
      );
    }
  };

  const handleDeleteUser = async (targetUser: AuthUser) => {
    setActionError(null);
    setStatusAnnouncement(null);
    try {
      await deleteUserMutation.mutateAsync(targetUser.id);
      setStatusAnnouncement(`Removed user ${targetUser.name}.`);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to delete user."
      );
    }
  };

  const handleCreateUserSubmit = createForm.handleSubmit(async (values) => {
    setActionError(null);
    setStatusAnnouncement(null);
    try {
      await createUserMutation.mutateAsync(values);
      createForm.reset({
        name: "",
        email: "",
        password: "",
        role: "analyst",
        title: "",
      });
      setShowCreateUserForm(false);
      setStatusAnnouncement(
        `Provisioned active account for ${values.name} (${values.email}).`
      );
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to create user."
      );
    }
  });

  const handleUpdateProjectStatus = async (
    projectId: string,
    projectName: string,
    status: ProjectBusinessStatus
  ) => {
    setActionError(null);
    setStatusAnnouncement(null);
    try {
      await updateBusinessStatusMutation.mutateAsync({ projectId, status });
      setStatusAnnouncement(
        `Updated ${projectName} status to ${BUSINESS_STATUS_META[status].label}.`
      );
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update project status."
      );
    }
  };

  const existingProjectIdSet = new Set(projects.map((p) => p.id));
  const activeSelectedProjectIds = selectedProjectIds.filter((id) =>
    existingProjectIdSet.has(id)
  );
  const selectedProjectIdSet = new Set(activeSelectedProjectIds);
  const selectedProjects = projects.filter((p) =>
    selectedProjectIdSet.has(p.id)
  );
  const canDeleteProjects = hasPermission(currentUser, "projects:delete");

  const handleBulkUpdateProjectStatus = async () => {
    if (activeSelectedProjectIds.length === 0) return;
    setActionError(null);
    setStatusAnnouncement(null);
    try {
      const result = await bulkUpdateBusinessStatusMutation.mutateAsync({
        projectIds: activeSelectedProjectIds,
        status: bulkStatusTarget,
      });
      setSelectedProjectIds([]);
      setStatusAnnouncement(
        `Updated ${result.updatedCount} selected ${result.updatedCount === 1 ? "project" : "projects"} to ${BUSINESS_STATUS_META[result.status].label}.`
      );
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to bulk-update project statuses."
      );
    }
  };

  const handleConfirmBulkDeleteProjects = async () => {
    if (activeSelectedProjectIds.length === 0) return;
    setActionError(null);
    setStatusAnnouncement(null);
    try {
      const result = await bulkDeleteProjectsMutation.mutateAsync({
        projectIds: activeSelectedProjectIds,
      });
      const deletedSet = new Set(result.deletedIds);
      setSelectedProjectIds((prev) =>
        prev.filter((id) => !deletedSet.has(id))
      );
      if (editingProject && deletedSet.has(editingProject.id)) {
        setEditingProject(null);
      }
      bulkDeleteProjectsDialogRef.current?.close();
      setStatusAnnouncement(
        `Deleted ${result.deletedCount} selected ${result.deletedCount === 1 ? "project" : "projects"}.`
      );
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to delete selected projects."
      );
    }
  };

  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    );
  };

  const currentPageProjectIds = projectsPagination.items.map((p) => p.id);
  const allCurrentPageSelected =
    currentPageProjectIds.length > 0 &&
    currentPageProjectIds.every((id) => selectedProjectIdSet.has(id));

  const handleToggleSelectCurrentPage = () => {
    if (allCurrentPageSelected) {
      const pageSet = new Set(currentPageProjectIds);
      setSelectedProjectIds((prev) => prev.filter((id) => !pageSet.has(id)));
    } else {
      setSelectedProjectIds((prev) =>
        Array.from(new Set([...prev, ...currentPageProjectIds]))
      );
    }
  };

  const handleDeleteProject = async (
    projectId: string,
    projectName: string
  ) => {
    setActionError(null);
    setStatusAnnouncement(null);
    try {
      await deleteProjectMutation.mutateAsync(projectId);
      setSelectedProjectIds((prev) => prev.filter((id) => id !== projectId));
      setStatusAnnouncement(`Deleted project ${projectName}.`);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to delete project."
      );
    }
  };

  const handleCreateProject = async (values: NewProjectFormValues) => {
    setActionError(null);
    setStatusAnnouncement(null);
    try {
      const created = await createProjectMutation.mutateAsync(values);
      setStatusAnnouncement(
        `Created new project ${created.name} (${created.ticker}).`
      );
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to create project."
      );
    }
  };

  const handleStartProjectSync = async (dto: SyncProjectsDto) => {
    setActionError(null);
    setStatusAnnouncement(null);
    const snapshot = await startAsyncSync(dto);
    setStatusAnnouncement(
      `Started background sync from ${dto.provider} (Page #${snapshot.currentPage}).`
    );
    return snapshot;
  };

  const handleOpenEditProject = (project: CryptoProject) => {
    setActionError(null);
    setEditingProject(project);
    openEditProjectModal();
  };

  const handleUpdateProject = async (
    projectId: string,
    values: UpdateProjectFormValues
  ) => {
    setActionError(null);
    setStatusAnnouncement(null);
    try {
      const updated = await updateProjectMutation.mutateAsync({
        projectId,
        values,
      });
      setEditingProject(updated);
      setStatusAnnouncement(
        `Updated project info and profile for ${updated.name} (${updated.ticker}).`
      );
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update project."
      );
      throw err;
    }
  };

  const handleAddPromptSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    void promptForm.handleSubmit((values) => {
      savePromptTemplateMutation.mutate({
        id: `tpl-${Date.now()}`,
        label: values.label,
        systemPrompt: values.systemPrompt,
      });
      promptForm.reset();
      setStatusAnnouncement(`Added prompt template "${values.label}".`);
    })(e);
  };

  const handleAddChecklistSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    void checklistForm.handleSubmit((values) => {
      saveChecklistItemMutation.mutate({
        id: `chk-${Date.now()}`,
        label: values.label,
        scanPrompt: values.scanPrompt,
      });
      checklistForm.reset();
      setStatusAnnouncement(`Added checklist item "${values.label}".`);
    })(e);
  };

  const isMutatingUsers =
    createUserMutation.isPending ||
    updateUserRoleMutation.isPending ||
    updateUserStatusMutation.isPending ||
    deleteUserMutation.isPending;

  const navItems: Array<{
    id: AdminSectionId;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
    badge?: string | number;
    badgeTone?: "amber" | "neutral";
  }> = [
    {
      id: "overview",
      label: "Overview",
      description: "KPIs, health & alerts",
      icon: LayoutDashboard,
      badge: inactiveUsers.length > 0 ? `${inactiveUsers.length} new` : undefined,
      badgeTone: "amber",
    },
    {
      id: "users",
      label: "Users & Approvals",
      description: "Activation & RBAC directory",
      icon: Users,
      badge:
        inactiveUsers.length > 0
          ? `${inactiveUsers.length} pending`
          : users.length,
      badgeTone: inactiveUsers.length > 0 ? "amber" : "neutral",
    },
    {
      id: "projects",
      label: "Crypto Projects",
      description: "Workspaces, logos & pipeline",
      icon: FolderKanban,
      badge: projects.length,
      badgeTone: "neutral",
    },
    {
      id: "rbac",
      label: "Roles & Permissions",
      description: "Access control matrix",
      icon: ShieldCheck,
      badge: `${USER_ROLES.length} roles`,
      badgeTone: "neutral",
    },
    {
      id: "settings",
      label: "AI & Checklists",
      description: "Prompts & due diligence",
      icon: Settings,
      badge: promptTemplates.length + checklistItems.length,
      badgeTone: "neutral",
    },
    {
      id: "audit",
      label: "Security Audit Log",
      description: "Activity & session trail",
      icon: History,
      badge: auditLogs.length,
      badgeTone: "neutral",
    },
  ];

  const activeSectionMeta = SECTION_META[activeSection];
  const isProjectsSection = activeSection === "projects";

  const pendingApprovalsCallout = inactiveUsers.length > 0 && (
    <section
      aria-labelledby="pending-approvals-heading"
      className="rounded-2xl bg-white dark:bg-[#202c33] border-2 border-amber-500/40 p-4 sm:p-5 shadow-xs space-y-3.5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <h2
              id="pending-approvals-heading"
              className="text-sm sm:text-base font-bold"
            >
              Pending User Registrations ({inactiveUsers.length})
            </h2>
            <p className="text-xs text-[#65676b] dark:text-[#8696a0]">
              Newly registered users are inactive by default and cannot sign in
              until activated below.
            </p>
          </div>
        </div>

        {inactiveUsers.length > 1 && (
          <button
            type="button"
            disabled={isMutatingUsers}
            onClick={() => void handleActivateAllPending()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-50 text-white transition cursor-pointer shrink-0"
          >
            <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Activate All ({inactiveUsers.length})</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {pendingUsersPagination.items.map((pendingUser) => (
          <div
            key={pendingUser.id}
            className="rounded-xl bg-[#f0f2f5] dark:bg-[#111b21] border border-[#e4e6eb] dark:border-[#2a3942] p-3.5 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-full ${pendingUser.avatarColor} text-white font-bold text-xs flex items-center justify-center shrink-0`}
              >
                {pendingUser.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-bold truncate">
                    {pendingUser.name}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    Inactive · Pending
                  </span>
                </div>
                <p className="text-xs text-[#65676b] dark:text-[#8696a0] truncate">
                  {pendingUser.email} · {pendingUser.title}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isMutatingUsers}
              onClick={() =>
                void handleActivateOrDeactivateUser(pendingUser, true)
              }
              aria-label={`Activate ${pendingUser.name}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-50 text-white transition cursor-pointer shrink-0"
            >
              <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Activate</span>
            </button>
          </div>
        ))}
      </div>

      <PaginationBar
        variant="compact"
        meta={pendingUsersPagination.meta}
        pageSizeOptions={pendingUsersPagination.pageSizeOptions}
        onPageChange={pendingUsersPagination.setPage}
        onPageSizeChange={pendingUsersPagination.setPageSize}
        itemLabel="pending users"
        ariaLabel="Pending registrations pagination"
        hideWhenSinglePage
      />
    </section>
  );

  return (
    <div className="h-dvh w-full flex flex-col md:flex-row overflow-hidden bg-[#f0f2f5] dark:bg-[#0b141a] text-[#050505] dark:text-[#e9edef]">
      {/* Skip link per modern-web-guidance (accessibility) */}
      <a
        href="#admin-main-heading"
        className="skip-link focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-xl focus:bg-[#0084ff] focus:text-white focus:text-xs focus:font-semibold focus:shadow-md"
      >
        Skip to main content
      </a>

      {/* LEFT-HAND SIDEBAR: Brand, Navigation Menu & Admin Session Footer */}
      <aside
        aria-label="Admin control center navigation"
        className="w-full md:w-68 lg:w-76 shrink-0 bg-white dark:bg-[#111b21] border-b md:border-b-0 md:border-r border-[#e4e6eb] dark:border-[#222d34] flex flex-col min-w-0"
      >
        {/* Brand & Service Status Header */}
        <div className="px-4 py-3.5 border-b border-[#e4e6eb] dark:border-[#222d34] flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#0084ff] text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight truncate">
                  PulseOS Admin
                </span>
                {healthStatus && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${
                      healthStatus.status === "ok"
                        ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
                        : "bg-amber-500/12 text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        healthStatus.status === "ok"
                          ? "bg-[#00a884]"
                          : "bg-amber-500"
                      }`}
                    />
                    <span>
                      {healthStatus.status === "ok" ? "Live" : "Degraded"}
                    </span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#65676b] dark:text-[#8696a0] truncate">
                Workspace Control Center
              </p>
            </div>
          </div>

          <Link
            href="/"
            className="md:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#f0f2f5] dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef]"
          >
            <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Workspace</span>
          </Link>
        </div>

        {/* Left-Hand Menu Navigation Landmark */}
        <nav
          aria-label="Admin sections"
          className="flex-1 overflow-x-auto md:overflow-y-auto scroller px-2.5 py-2 md:py-3"
        >
          <div className="hidden md:block px-2.5 pb-2 text-[10px] font-bold uppercase tracking-wider text-[#65676b] dark:text-[#8696a0]">
            Management Menu
          </div>
          <ul
            role="list"
            className="flex md:flex-col gap-1 min-w-max md:min-w-0"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <li key={item.id} className="min-w-0">
                  <button
                    type="button"
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => handleSelectSection(item.id, true)}
                    className={`admin-nav-button w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-left transition cursor-pointer ${
                      isActive
                        ? "bg-[#e7f3ff]/80 dark:bg-[#0084ff]/15 text-[#0084ff] dark:text-[#4599ff] font-semibold"
                        : "text-[#050505] dark:text-[#e9edef] hover:bg-[#f0f2f5] dark:hover:bg-[#202c33]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive
                            ? "text-[#0084ff] dark:text-[#4599ff]"
                            : "text-[#65676b] dark:text-[#8696a0]"
                        }`}
                        aria-hidden={true}
                      />
                      <div className="min-w-0">
                        <div className="text-xs sm:text-[13px] leading-tight truncate">
                          {item.label}
                        </div>
                        <div className="hidden md:block text-[11px] font-normal text-[#65676b] dark:text-[#8696a0] truncate mt-0.5">
                          {item.description}
                        </div>
                      </div>
                    </div>

                    {item.badge !== undefined && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          item.badgeTone === "amber"
                            ? "bg-amber-500 text-white"
                            : isActive
                              ? "bg-[#0084ff]/15 text-[#0084ff] dark:bg-[#0084ff]/25 dark:text-[#4599ff]"
                              : "bg-[#f0f2f5] dark:bg-[#202c33] text-[#65676b] dark:text-[#8696a0]"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Left Sidebar Bottom Footer: Return to Workspace & Current Admin Profile */}
        <div className="hidden md:flex flex-col gap-2.5 p-3 border-t border-[#e4e6eb] dark:border-[#222d34] bg-[#f0f2f5]/40 dark:bg-[#202c33]/40">
          <Link
            href="/"
            className="w-full inline-flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] transition shadow-2xs"
          >
            <span className="inline-flex items-center gap-2">
              <MessageSquare
                className="w-3.5 h-3.5 text-[#0084ff]"
                aria-hidden="true"
              />
              <span>Messenger Workspace</span>
            </span>
            <ArrowUpRight
              className="w-3.5 h-3.5 text-[#65676b] dark:text-[#8696a0]"
              aria-hidden="true"
            />
          </Link>

          <div className="flex items-center justify-between gap-2 px-1.5 py-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-full ${currentUser.avatarColor} text-white font-bold text-[11px] flex items-center justify-center shrink-0`}
              >
                {currentUser.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold truncate">
                    {currentUser.name}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold shrink-0 ${
                      USER_ROLE_META[currentUser.role].badgeClass
                    }`}
                  >
                    {USER_ROLE_META[currentUser.role].shortLabel}
                  </span>
                </div>
                <p className="text-[11px] text-[#65676b] dark:text-[#8696a0] truncate">
                  {currentUser.email}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => logoutMutation.mutate()}
              aria-label="Sign out"
              title="Sign out"
              className="p-2 rounded-xl text-[#65676b] hover:text-rose-600 dark:text-[#8696a0] dark:hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      {/* RIGHT-HAND CONTENT PANE: Contextual Header + Active Section View */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        {/* Right-Pane Sticky Header */}
        <header className="shrink-0 bg-white dark:bg-[#111b21] border-b border-[#e4e6eb] dark:border-[#222d34] px-4 sm:px-6 py-3.5">
          <div
            className={`${isProjectsSection ? "w-full" : "max-w-6xl mx-auto"} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
          >
            <div className="min-w-0">
              <h1
                ref={mainHeadingRef}
                id="admin-main-heading"
                tabIndex={-1}
                className="text-lg sm:text-xl font-bold tracking-tight outline-none truncate"
              >
                {activeSectionMeta.title}
              </h1>
              <p className="text-xs text-[#65676b] dark:text-[#8696a0] truncate">
                {activeSectionMeta.subtitle}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (activeSection !== "users") {
                    setActiveSection("users");
                    setShowCreateUserForm(true);
                  } else {
                    setShowCreateUserForm((prev) => !prev);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#f0f2f5] dark:bg-[#202c33] hover:bg-[#e4e6eb] dark:hover:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] transition cursor-pointer"
              >
                <UserPlus
                  className="w-3.5 h-3.5 text-[#0084ff]"
                  aria-hidden="true"
                />
                <span>
                  {activeSection === "users" && showCreateUserForm
                    ? "Close User Form"
                    : "Provision User"}
                </span>
              </button>

              <button
                type="button"
                onClick={openSyncProjectsModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#00a884] hover:bg-[#008f6f] text-white transition cursor-pointer"
              >
                <CloudDownload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Sync</span>
              </button>

              <button
                type="button"
                onClick={openNewProjectModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] text-white transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>New Project</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  void refetchHealth();
                  void usersQuery.refetch();
                  void projectsQuery.refetch();
                  void syncProvidersQuery.refetch();
                  void auditLogsQuery.refetch();
                  void promptTemplatesQuery.refetch();
                  void checklistItemsQuery.refetch();
                }}
                aria-label="Refresh admin dashboard data"
                title="Refresh data"
                className="p-2 rounded-xl bg-[#f0f2f5] hover:bg-[#e4e6eb] dark:bg-[#202c33] dark:hover:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        {/* Scrollable Main Content Landmark */}
        <main
          className={
            isProjectsSection
              ? "flex-1 min-h-0 flex flex-col overflow-y-auto md:overflow-hidden p-3 sm:p-4"
              : "flex-1 overflow-y-auto scroller p-4 sm:p-6"
          }
        >
          <div
            className={
              isProjectsSection
                ? "w-full flex-1 min-h-0 flex flex-col gap-3"
                : "max-w-6xl mx-auto space-y-6 pb-8"
            }
          >
            {/* Centralized Live Regions for Announcements & Errors */}
            <div
              aria-live="polite"
              role="status"
              className={statusAnnouncement ? "shrink-0" : "visually-hidden"}
            >
              {statusAnnouncement && (
                <div className="rounded-xl bg-emerald-500/12 border border-emerald-500/30 px-4 py-2.5 text-xs text-emerald-800 dark:text-emerald-300 font-medium flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className="w-4 h-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{statusAnnouncement}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStatusAnnouncement(null)}
                    className="text-[11px] underline cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>

            <div
              aria-live="polite"
              className={actionError ? "shrink-0" : "visually-hidden"}
            >
              {actionError && (
                <div
                  role="alert"
                  className="rounded-xl bg-rose-500/12 border border-rose-500/30 px-4 py-2.5 text-xs text-rose-700 dark:text-rose-300 font-medium"
                >
                  {actionError}
                </div>
              )}
            </div>

            {/* ========================================================= */}
            {/* VIEW 1: OVERVIEW                                          */}
            {/* ========================================================= */}
            {activeSection === "overview" && (
              <div className="space-y-6">
                {/* KPI Summary Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <button
                    type="button"
                    onClick={() => handleSelectSection("users", true)}
                    className="text-left rounded-2xl bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] hover:border-[#0084ff] p-4 shadow-2xs transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs text-[#65676b] dark:text-[#8696a0] mb-1">
                      <span className="font-semibold">
                        Total Registered Users
                      </span>
                      <Users
                        className="w-4 h-4 text-[#0084ff]"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="text-2xl font-bold">{users.length}</div>
                    <div className="text-[11px] text-[#65676b] dark:text-[#8696a0] mt-1">
                      {activeUsers.length} active · {inactiveUsers.length}{" "}
                      inactive
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUserFilter(
                        inactiveUsers.length > 0 ? "pending" : "all"
                      );
                      handleSelectSection("users", true);
                    }}
                    className={`text-left rounded-2xl border p-4 shadow-2xs transition cursor-pointer ${
                      inactiveUsers.length > 0
                        ? "bg-amber-500/8 dark:bg-amber-500/10 border-amber-500/40 hover:border-amber-500"
                        : "bg-white dark:bg-[#202c33] border-[#e4e6eb] dark:border-[#2a3942] hover:border-[#0084ff]"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-[#65676b] dark:text-[#8696a0] mb-1">
                      <span className="font-semibold">
                        Pending User Activations
                      </span>
                      <Clock
                        className={`w-4 h-4 ${
                          inactiveUsers.length > 0
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="text-2xl font-bold">
                      {inactiveUsers.length}
                    </div>
                    <div className="text-[11px] text-[#65676b] dark:text-[#8696a0] mt-1">
                      {inactiveUsers.length > 0
                        ? "Awaiting administrator activation"
                        : "All registered users are active"}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectSection("projects", true)}
                    className="text-left rounded-2xl bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] hover:border-[#0084ff] p-4 shadow-2xs transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs text-[#65676b] dark:text-[#8696a0] mb-1">
                      <span className="font-semibold">
                        Total Crypto Projects
                      </span>
                      <FolderKanban
                        className="w-4 h-4 text-[#00a884]"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="text-2xl font-bold">{projects.length}</div>
                    <div className="text-[11px] text-[#65676b] dark:text-[#8696a0] mt-1">
                      {newProjectsCount} new · {activeStateProjectsCount} active
                      {" · "}
                      {nonArchivedProjectsCount -
                        newProjectsCount -
                        activeStateProjectsCount}{" "}
                      pipeline
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectSection("settings", true)}
                    className="text-left rounded-2xl bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] hover:border-[#0084ff] p-4 shadow-2xs transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs text-[#65676b] dark:text-[#8696a0] mb-1">
                      <span className="font-semibold">
                        Intelligence & AI Output
                      </span>
                      <Activity
                        className="w-4 h-4 text-purple-600 dark:text-purple-400"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="text-2xl font-bold">
                      {totalContextsCount}
                    </div>
                    <div className="text-[11px] text-[#65676b] dark:text-[#8696a0] mt-1">
                      Tracked contexts · {totalMessagesCount} AI chat messages
                    </div>
                  </button>
                </div>

                {/* Pending User Approvals Callout (when inactive users exist) */}
                {pendingApprovalsCallout}

                {/* Two-Column Executive Overview: Recent Projects + System Health & Audit */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Recent Crypto Projects Card */}
                  <section
                    aria-labelledby="overview-projects-heading"
                    className="rounded-2xl bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] p-4 sm:p-5 shadow-2xs flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h2
                            id="overview-projects-heading"
                            className="text-sm sm:text-base font-bold"
                          >
                            Active Project Workspaces
                          </h2>
                          <p className="text-xs text-[#65676b] dark:text-[#8696a0]">
                            Quickly edit project profiles, upload logos, or jump
                            into a workspace.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSelectSection("projects", true)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#0084ff] hover:underline cursor-pointer shrink-0"
                        >
                          <span>View all ({projects.length})</span>
                          <ArrowRight
                            className="w-3.5 h-3.5"
                            aria-hidden="true"
                          />
                        </button>
                      </div>

                      <div className="divide-y divide-[#e4e6eb] dark:divide-[#2a3942] rounded-xl border border-[#e4e6eb] dark:border-[#2a3942] overflow-hidden">
                        {overviewProjectsPagination.items.map((project) => {
                          const statusMeta =
                            BUSINESS_STATUS_META[project.businessStatus];
                          return (
                            <div
                              key={project.id}
                              className="p-3 bg-white dark:bg-[#202c33] hover:bg-[#f0f2f5]/50 dark:hover:bg-[#2a3942]/40 flex items-center justify-between gap-3 transition"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <ProjectAvatar
                                  project={project}
                                  size="sm"
                                  onEditClick={() =>
                                    handleOpenEditProject(project)
                                  }
                                  decorative={false}
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-semibold truncate">
                                      {project.name}
                                    </span>
                                    <span className="font-mono text-[11px] text-[#0084ff] font-semibold">
                                      {project.ticker}
                                    </span>
                                    <span
                                      className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${statusMeta.badgeClass}`}
                                    >
                                      {statusMeta.shortLabel}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-[#65676b] dark:text-[#8696a0] truncate">
                                    {project.chain} · {project.stage} ·{" "}
                                    {project.campaignBudget}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditProject(project)}
                                  aria-label={`Edit ${project.name}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#f0f2f5] hover:bg-[#e4e6eb] dark:bg-[#2a3942] dark:hover:bg-[#374248] text-[#050505] dark:text-[#e9edef] transition cursor-pointer"
                                >
                                  <Pencil
                                    className="w-3.5 h-3.5"
                                    aria-hidden="true"
                                  />
                                  <span>Edit</span>
                                </button>
                                <Link
                                  href={`/?projectId=${encodeURIComponent(project.id)}`}
                                  aria-label={`Open ${project.name} in workspace`}
                                  className="p-1.5 rounded-lg bg-[#e7f3ff] hover:bg-[#d0e7ff] text-[#0084ff] dark:bg-[#0084ff]/20 dark:text-[#4599ff] transition"
                                >
                                  <ArrowUpRight
                                    className="w-3.5 h-3.5"
                                    aria-hidden="true"
                                  />
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <PaginationBar
                        variant="compact"
                        meta={overviewProjectsPagination.meta}
                        pageSizeOptions={
                          overviewProjectsPagination.pageSizeOptions
                        }
                        onPageChange={overviewProjectsPagination.setPage}
                        onPageSizeChange={
                          overviewProjectsPagination.setPageSize
                        }
                        itemLabel="projects"
                        ariaLabel="Overview projects pagination"
                        hideWhenSinglePage={
                          projects.length <= COMPACT_PAGE_SIZE_OPTIONS[0]
                        }
                      />
                    </div>
                  </section>

                  {/* System Health & Recent Security Activity Card */}
                  <section
                    aria-labelledby="overview-health-heading"
                    className="rounded-2xl bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] p-4 sm:p-5 shadow-2xs space-y-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h2
                          id="overview-health-heading"
                          className="text-sm sm:text-base font-bold"
                        >
                          Platform Health & Security Feed
                        </h2>
                        <p className="text-xs text-[#65676b] dark:text-[#8696a0]">
                          Live microservice dependencies and latest audit trail.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectSection("audit", true)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0084ff] hover:underline cursor-pointer shrink-0"
                      >
                        <span>Audit log ({auditLogs.length})</span>
                        <ArrowRight
                          className="w-3.5 h-3.5"
                          aria-hidden="true"
                        />
                      </button>
                    </div>

                    {/* Microservice Status Strip */}
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="rounded-xl bg-[#f0f2f5] dark:bg-[#111b21] p-2.5 border border-[#e4e6eb] dark:border-[#2a3942]">
                        <div className="flex items-center gap-1.5 text-[11px] text-[#65676b] dark:text-[#8696a0]">
                          <Server
                            className="w-3.5 h-3.5 text-[#0084ff]"
                            aria-hidden="true"
                          />
                          <span>Core API</span>
                        </div>
                        <div className="mt-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {healthStatus ? "Online" : "Checking..."}
                        </div>
                      </div>

                      <div className="rounded-xl bg-[#f0f2f5] dark:bg-[#111b21] p-2.5 border border-[#e4e6eb] dark:border-[#2a3942]">
                        <div className="flex items-center gap-1.5 text-[11px] text-[#65676b] dark:text-[#8696a0]">
                          <Database
                            className="w-3.5 h-3.5 text-[#00a884]"
                            aria-hidden="true"
                          />
                          <span>PostgreSQL</span>
                        </div>
                        <div className="mt-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {healthStatus?.dependencies.database === "up"
                            ? "Connected"
                            : "Degraded"}
                        </div>
                      </div>

                      <div className="rounded-xl bg-[#f0f2f5] dark:bg-[#111b21] p-2.5 border border-[#e4e6eb] dark:border-[#2a3942]">
                        <div className="flex items-center gap-1.5 text-[11px] text-[#65676b] dark:text-[#8696a0]">
                          <Globe
                            className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400"
                            aria-hidden="true"
                          />
                          <span>Scraper</span>
                        </div>
                        <div className="mt-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {healthStatus?.dependencies.scraper === "up"
                            ? "Ready"
                            : "Standby"}
                        </div>
                      </div>
                    </div>

                    {/* Recent Audit Log Preview */}
                    <div className="space-y-2">
                      {overviewAuditPagination.items.map((log) => (
                        <div
                          key={log.id}
                          className="rounded-xl border border-[#e4e6eb] dark:border-[#2a3942] bg-[#f0f2f5]/50 dark:bg-[#111b21] px-3 py-2 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-semibold text-[#0084ff]">
                                {log.action}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  USER_ROLE_META[log.actorRole].badgeClass
                                }`}
                              >
                                {log.actorRole}
                              </span>
                              <span className="text-[#65676b] dark:text-[#8696a0] truncate">
                                {log.actorEmail}
                              </span>
                            </div>
                          </div>
                          <span className="text-[11px] text-[#65676b] dark:text-[#8696a0] shrink-0">
                            {new Date(log.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      ))}
                    </div>

                    <PaginationBar
                      variant="compact"
                      meta={overviewAuditPagination.meta}
                      pageSizeOptions={overviewAuditPagination.pageSizeOptions}
                      onPageChange={overviewAuditPagination.setPage}
                      onPageSizeChange={overviewAuditPagination.setPageSize}
                      itemLabel="events"
                      ariaLabel="Overview audit log pagination"
                      hideWhenSinglePage
                    />
                  </section>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* VIEW 2: USERS & APPROVALS                                 */}
            {/* ========================================================= */}
            {activeSection === "users" && (
              <div className="space-y-6">
                {pendingApprovalsCallout}

                <section
                  aria-labelledby="users-directory-heading"
                  className="rounded-2xl bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] p-4 sm:p-5 shadow-2xs space-y-4"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div>
                      <h2
                        id="users-directory-heading"
                        className="text-base sm:text-lg font-bold"
                      >
                        All Registered Users ({users.length})
                      </h2>
                      <p className="text-xs text-[#65676b] dark:text-[#8696a0]">
                        View all workspace accounts, activate newly registered
                        users, or adjust RBAC role assignments.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                      <div className="flex items-center gap-1.5 overflow-x-auto scroller">
                        <FilterChip
                          active={userFilter === "all"}
                          onClick={() => setUserFilter("all")}
                          count={users.length}
                        >
                          All Users
                        </FilterChip>
                        <FilterChip
                          active={userFilter === "pending"}
                          onClick={() => setUserFilter("pending")}
                          count={inactiveUsers.length}
                        >
                          Inactive / Pending
                        </FilterChip>
                        <FilterChip
                          active={userFilter === "active"}
                          onClick={() => setUserFilter("active")}
                          count={activeUsers.length}
                        >
                          Active
                        </FilterChip>
                      </div>

                      <search className="relative min-w-56">
                        <label
                          htmlFor={userSearchInputId}
                          className="visually-hidden"
                        >
                          Search users
                        </label>
                        <Search
                          className="w-3.5 h-3.5 text-[#65676b] dark:text-[#8696a0] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                          aria-hidden="true"
                        />
                        <input
                          id={userSearchInputId}
                          type="search"
                          autoCorrect="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          value={userSearchQuery}
                          onChange={(e) => setUserSearchQuery(e.target.value)}
                          placeholder="Search name, email, role..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-full bg-[#f0f2f5] dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef] border border-transparent focus:border-[#0084ff] outline-none"
                        />
                      </search>
                    </div>
                  </div>

                  {/* Collapsible Provision New User Form */}
                  {showCreateUserForm && (
                    <form
                      method="post"
                      onSubmit={(e) => void handleCreateUserSubmit(e)}
                      noValidate
                      className="rounded-xl bg-[#f0f2f5] dark:bg-[#111b21] p-4 border border-[#e4e6eb] dark:border-[#2a3942] space-y-3"
                    >
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#65676b] dark:text-[#8696a0]">
                        Provision Active Workspace User
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="flex flex-col gap-1">
                          <label
                            htmlFor={createNameId}
                            className="text-xs font-semibold"
                          >
                            Full name <span aria-hidden="true">*</span>
                          </label>
                          <input
                            id={createNameId}
                            type="text"
                            autoComplete="name"
                            required
                            {...createForm.register("name")}
                            placeholder="Devon Brooks"
                            className="w-full rounded-lg bg-white dark:bg-[#202c33] px-3 py-2 text-xs border border-[#e4e6eb] dark:border-[#2a3942] outline-none"
                          />
                          {createForm.formState.errors.name && (
                            <span className="text-[11px] text-rose-600 dark:text-rose-400">
                              {createForm.formState.errors.name.message}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col gap-1">
                          <label
                            htmlFor={createEmailId}
                            className="text-xs font-semibold"
                          >
                            Email address <span aria-hidden="true">*</span>
                          </label>
                          <input
                            id={createEmailId}
                            type="email"
                            autoComplete="username"
                            autoCorrect="off"
                            autoCapitalize="none"
                            spellCheck={false}
                            required
                            {...createForm.register("email")}
                            placeholder="devon@pulseos.xyz"
                            className="w-full rounded-lg bg-white dark:bg-[#202c33] px-3 py-2 text-xs border border-[#e4e6eb] dark:border-[#2a3942] outline-none"
                          />
                          {createForm.formState.errors.email && (
                            <span className="text-[11px] text-rose-600 dark:text-rose-400">
                              {createForm.formState.errors.email.message}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col gap-1">
                          <label
                            htmlFor={createPasswordId}
                            className="text-xs font-semibold"
                          >
                            Password (8+ chars) <span aria-hidden="true">*</span>
                          </label>
                          <input
                            id={createPasswordId}
                            type="password"
                            autoComplete="new-password"
                            minLength={8}
                            required
                            {...createForm.register("password")}
                            placeholder="••••••••"
                            className="w-full rounded-lg bg-white dark:bg-[#202c33] px-3 py-2 text-xs border border-[#e4e6eb] dark:border-[#2a3942] outline-none"
                          />
                          {createForm.formState.errors.password && (
                            <span className="text-[11px] text-rose-600 dark:text-rose-400">
                              {createForm.formState.errors.password.message}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col gap-1">
                          <label
                            htmlFor={createTitleId}
                            className="text-xs font-semibold"
                          >
                            Job title
                          </label>
                          <input
                            id={createTitleId}
                            type="text"
                            autoComplete="organization-title"
                            {...createForm.register("title")}
                            placeholder="Tokenomics Strategist"
                            className="w-full rounded-lg bg-white dark:bg-[#202c33] px-3 py-2 text-xs border border-[#e4e6eb] dark:border-[#2a3942] outline-none"
                          />
                        </div>
                      </div>

                      <fieldset className="pt-1">
                        <legend className="text-xs font-semibold mb-1.5">
                          Assigned RBAC Role <span aria-hidden="true">*</span>
                        </legend>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {USER_ROLES.map((roleKey) => {
                            const radioId = `${createRolePrefixId}-${roleKey}`;
                            const meta = USER_ROLE_META[roleKey];
                            return (
                              <div
                                key={roleKey}
                                className="flex items-center gap-2 rounded-lg bg-white dark:bg-[#202c33] px-2.5 py-2 border border-[#e4e6eb] dark:border-[#2a3942]"
                              >
                                <input
                                  id={radioId}
                                  type="radio"
                                  value={roleKey}
                                  {...createForm.register("role")}
                                  className="checkbox-native"
                                />
                                <label
                                  htmlFor={radioId}
                                  className="text-xs font-medium cursor-pointer"
                                >
                                  {meta.label}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </fieldset>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowCreateUserForm(false)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#65676b] dark:text-[#8696a0] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isMutatingUsers}
                          className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] disabled:opacity-50 text-white transition cursor-pointer"
                        >
                          Create Active User
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Semantic Responsive Data Table for Users */}
                  <div
                    tabIndex={0}
                    role="region"
                    aria-labelledby={usersCaptionId}
                    className="table-wrapper scroller rounded-xl border border-[#e4e6eb] dark:border-[#2a3942]"
                  >
                    <table
                      className="responsive-data-table text-left text-xs"
                      style={
                        {
                          "--label-2": '"Status"',
                          "--label-3": '"Role"',
                          "--label-4": '"Title & Access"',
                          "--label-5": '"Activity"',
                          "--label-6": '"Actions"',
                        } as React.CSSProperties
                      }
                    >
                      <caption id={usersCaptionId} className="visually-hidden">
                        Workspace users directory and activation controls
                      </caption>
                      <thead>
                        <tr className="bg-[#f0f2f5] dark:bg-[#111b21] border-b border-[#e4e6eb] dark:border-[#2a3942] text-[#65676b] dark:text-[#8696a0]">
                          <th scope="col" className="py-3 px-3.5 font-semibold">
                            User
                          </th>
                          <th scope="col" className="py-3 px-3.5 font-semibold">
                            Status
                          </th>
                          <th scope="col" className="py-3 px-3.5 font-semibold">
                            RBAC Role
                          </th>
                          <th scope="col" className="py-3 px-3.5 font-semibold">
                            Title & Permissions
                          </th>
                          <th scope="col" className="py-3 px-3.5 font-semibold">
                            Last Login
                          </th>
                          <th
                            scope="col"
                            className="py-3 px-3.5 font-semibold text-right"
                          >
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e4e6eb] dark:divide-[#2a3942]">
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="py-8 text-center text-[#65676b] dark:text-[#8696a0]"
                            >
                              No users match the current filter.
                            </td>
                          </tr>
                        ) : (
                          usersPagination.items.map((member) => {
                            const isSelf = member.id === currentUser.id;
                            const roleMeta = USER_ROLE_META[member.role];

                            return (
                              <tr
                                key={member.id}
                                className="bg-white dark:bg-[#202c33] hover:bg-[#f0f2f5]/50 dark:hover:bg-[#2a3942]/40 transition"
                              >
                                <th
                                  scope="row"
                                  className="py-3 px-3.5 font-normal text-left"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div
                                      className={`w-8 h-8 rounded-full ${member.avatarColor} text-white font-bold text-[11px] flex items-center justify-center shrink-0`}
                                    >
                                      {member.name
                                        .split(" ")
                                        .map((n) => n[0])
                                        .join("")
                                        .slice(0, 2)}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-semibold text-[#050505] dark:text-[#e9edef] truncate">
                                          {member.name}
                                        </span>
                                        {isSelf && (
                                          <span className="px-1.5 py-0.5 rounded bg-[#f0f2f5] dark:bg-[#2a3942] text-[10px] font-medium text-[#65676b] dark:text-[#d1d7db]">
                                            You
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[11px] text-[#65676b] dark:text-[#8696a0] truncate">
                                        {member.email}
                                      </div>
                                    </div>
                                  </div>
                                </th>

                                <td className="py-3 px-3.5">
                                  {member.isActive ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/12 text-emerald-700 dark:text-emerald-400">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#00a884]" />
                                      <span>Active</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                      <span>Inactive (Pending)</span>
                                    </span>
                                  )}
                                </td>

                                <td className="py-3 px-3.5">
                                  <div className="flex items-center gap-2">
                                    <label
                                      htmlFor={`admin-role-${member.id}`}
                                      className="visually-hidden"
                                    >
                                      Role for {member.name}
                                    </label>
                                    <select
                                      id={`admin-role-${member.id}`}
                                      value={member.role}
                                      disabled={isSelf || isMutatingUsers}
                                      onChange={(e) =>
                                        void handleRoleChange(
                                          member,
                                          e.target.value as UserRole
                                        )
                                      }
                                      className="rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] px-2.5 py-1.5 text-xs font-semibold text-[#050505] dark:text-[#e9edef] outline-none disabled:opacity-55 cursor-pointer"
                                    >
                                      {USER_ROLES.map((r) => (
                                        <option key={r} value={r}>
                                          {USER_ROLE_META[r].label}
                                        </option>
                                      ))}
                                    </select>
                                    <span
                                      className={`hidden xl:inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${roleMeta.badgeClass}`}
                                    >
                                      {roleMeta.shortLabel}
                                    </span>
                                  </div>
                                </td>

                                <td className="py-3 px-3.5">
                                  <div className="font-medium text-[#050505] dark:text-[#e9edef]">
                                    {member.title}
                                  </div>
                                  <div className="text-[11px] text-[#65676b] dark:text-[#8696a0]">
                                    {member.permissions.length} granted
                                    permissions
                                  </div>
                                </td>

                                <td className="py-3 px-3.5 text-[#65676b] dark:text-[#8696a0]">
                                  {member.lastLoginAt
                                    ? new Date(
                                        member.lastLoginAt
                                      ).toLocaleDateString(undefined, {
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    : "Never signed in"}
                                </td>

                                <td className="py-3 px-3.5 text-right">
                                  {isSelf ? (
                                    <span className="text-[11px] text-[#65676b] dark:text-[#8696a0]">
                                      Current Admin
                                    </span>
                                  ) : (
                                    <div className="inline-flex items-center justify-end gap-2">
                                      {member.isActive ? (
                                        <button
                                          type="button"
                                          disabled={isMutatingUsers}
                                          onClick={() =>
                                            void handleActivateOrDeactivateUser(
                                              member,
                                              false
                                            )
                                          }
                                          aria-label={`Deactivate ${member.name}`}
                                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/12 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 transition cursor-pointer"
                                        >
                                          <UserMinus
                                            className="w-3.5 h-3.5"
                                            aria-hidden="true"
                                          />
                                          <span>Deactivate</span>
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          disabled={isMutatingUsers}
                                          onClick={() =>
                                            void handleActivateOrDeactivateUser(
                                              member,
                                              true
                                            )
                                          }
                                          aria-label={`Activate ${member.name}`}
                                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#00a884] hover:bg-[#008f6f] text-white transition cursor-pointer shadow-2xs"
                                        >
                                          <UserCheck
                                            className="w-3.5 h-3.5"
                                            aria-hidden="true"
                                          />
                                          <span>Activate User</span>
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        disabled={isMutatingUsers}
                                        onClick={() =>
                                          void handleDeleteUser(member)
                                        }
                                        aria-label={`Delete user ${member.name}`}
                                        title={`Delete ${member.name}`}
                                        className="p-1.5 rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] text-[#65676b] hover:text-rose-600 dark:text-[#8696a0] dark:hover:text-rose-400 transition cursor-pointer"
                                      >
                                        <Trash2
                                          className="w-3.5 h-3.5"
                                          aria-hidden="true"
                                        />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <PaginationBar
                    meta={usersPagination.meta}
                    pageNumbers={usersPagination.pageNumbers}
                    pageSizeOptions={usersPagination.pageSizeOptions}
                    onPageChange={usersPagination.setPage}
                    onPageSizeChange={usersPagination.setPageSize}
                    itemLabel="users"
                    ariaLabel="Users directory pagination"
                  />
                </section>
              </div>
            )}

            {/* ========================================================= */}
            {/* VIEW 3: CRYPTO PROJECTS GOVERNANCE                        */}
            {/* ========================================================= */}
            {activeSection === "projects" && (
              <section
                aria-labelledby="projects-directory-heading"
                className="md:flex-1 md:min-h-0 flex flex-col rounded-2xl bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] p-3 sm:p-4 shadow-2xs gap-3"
              >
                <div className="shrink-0 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <h2
                        id="projects-directory-heading"
                        className="text-base sm:text-lg font-bold"
                      >
                        All Crypto Projects ({projects.length})
                      </h2>
                      <p className="text-xs text-[#65676b] dark:text-[#8696a0]">
                        New projects enter Active automatically on admin/user
                        interaction (chat, scrape, contexts, checklist, or edit),
                        or can be moved manually across pipeline states.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <search className="relative min-w-56 flex-1 sm:w-64 sm:flex-none">
                        <label
                          htmlFor={projectSearchInputId}
                          className="visually-hidden"
                        >
                          Search projects
                        </label>
                        <Search
                          className="w-3.5 h-3.5 text-[#65676b] dark:text-[#8696a0] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                          aria-hidden="true"
                        />
                        <input
                          id={projectSearchInputId}
                          type="search"
                          autoCorrect="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          value={projectSearchQuery}
                          onChange={(e) => setProjectSearchQuery(e.target.value)}
                          placeholder="Search project, ticker, chain..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-full bg-[#f0f2f5] dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef] border border-transparent focus:border-[#0084ff] outline-none"
                        />
                      </search>

                      <button
                        type="button"
                        onClick={openSyncProjectsModal}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#00a884] hover:bg-[#008f6f] text-white transition cursor-pointer shrink-0"
                      >
                        {syncJobState.isRunning ? (
                          <>
                            <RefreshCw
                              className="w-3.5 h-3.5 animate-spin"
                              aria-hidden="true"
                            />
                            <span>
                              Syncing Page #{syncJobState.currentPage} (+
                              {syncJobState.totalCreated} new)
                            </span>
                          </>
                        ) : (
                          <>
                            <CloudDownload
                              className="w-3.5 h-3.5"
                              aria-hidden="true"
                            />
                            <span>Sync</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <FilterChip
                      active={projectFilter === "all"}
                      onClick={() => setProjectFilter("all")}
                      count={projects.length}
                    >
                      All
                    </FilterChip>
                    {BUSINESS_STATUS_ORDER.map((statusKey) => (
                      <FilterChip
                        key={statusKey}
                        active={projectFilter === statusKey}
                        onClick={() => setProjectFilter(statusKey)}
                        count={
                          projects.filter(
                            (p) => p.businessStatus === statusKey
                          ).length
                        }
                      >
                        {BUSINESS_STATUS_META[statusKey].shortLabel}
                      </FilterChip>
                    ))}
                  </div>
                </div>

                {/* Bulk State & Delete Management Toolbar */}
                {activeSelectedProjectIds.length > 0 && (
                  <div className="shrink-0 rounded-xl bg-[#e7f3ff]/70 dark:bg-[#0084ff]/15 border border-[#0084ff]/35 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="text-xs font-semibold text-[#050505] dark:text-[#e9edef]">
                      {activeSelectedProjectIds.length}{" "}
                      {activeSelectedProjectIds.length === 1
                        ? "project"
                        : "projects"}{" "}
                      selected
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label
                        htmlFor={bulkStatusSelectId}
                        className="text-xs text-[#65676b] dark:text-[#d1d7db] font-medium"
                      >
                        Set pipeline state:
                      </label>
                      <select
                        id={bulkStatusSelectId}
                        value={bulkStatusTarget}
                        onChange={(e) =>
                          setBulkStatusTarget(
                            e.target.value as ProjectBusinessStatus
                          )
                        }
                        className="rounded-lg bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] px-2.5 py-1.5 text-xs font-semibold text-[#050505] dark:text-[#e9edef] outline-none cursor-pointer"
                      >
                        {BUSINESS_STATUS_ORDER.map((st) => (
                          <option key={st} value={st}>
                            {BUSINESS_STATUS_META[st].label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={
                          bulkUpdateBusinessStatusMutation.isPending ||
                          bulkDeleteProjectsMutation.isPending
                        }
                        onClick={() => void handleBulkUpdateProjectStatus()}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] disabled:opacity-50 text-white transition cursor-pointer"
                      >
                        {bulkUpdateBusinessStatusMutation.isPending
                          ? "Updating..."
                          : "Apply State"}
                      </button>
                      {canDeleteProjects && (
                        <button
                          type="button"
                          disabled={
                            bulkDeleteProjectsMutation.isPending ||
                            bulkUpdateBusinessStatusMutation.isPending
                          }
                          onClick={openBulkDeleteProjectsModal}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>
                            Delete Selected ({activeSelectedProjectIds.length})
                          </span>
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={bulkDeleteProjectsMutation.isPending}
                        onClick={() => setSelectedProjectIds([])}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#65676b] dark:text-[#8696a0] hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50 transition cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}

                {/* Semantic Responsive Data Table for Projects */}
                <div
                  tabIndex={0}
                  role="region"
                  aria-labelledby={projectsCaptionId}
                  className="table-wrapper table-wrapper--full scroller md:flex-1 md:min-h-0 rounded-xl border border-[#e4e6eb] dark:border-[#2a3942]"
                >
                  <table
                    className="responsive-data-table text-left text-xs"
                    style={
                      {
                        "--label-2": '"Chain & Stage"',
                        "--label-3": '"Pipeline Status"',
                        "--label-4": '"Intelligence"',
                        "--label-5": '"Budget & Sentiment"',
                        "--label-6": '"Actions"',
                      } as React.CSSProperties
                    }
                  >
                    <caption id={projectsCaptionId} className="visually-hidden">
                      All crypto projects across the workspace
                    </caption>
                    <thead>
                      <tr className="bg-[#f0f2f5] dark:bg-[#111b21] border-b border-[#e4e6eb] dark:border-[#2a3942] text-[#65676b] dark:text-[#8696a0]">
                        <th scope="col" className="py-3 px-3.5 font-semibold">
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={allCurrentPageSelected}
                              disabled={currentPageProjectIds.length === 0}
                              onChange={handleToggleSelectCurrentPage}
                              aria-label="Select all projects on this page"
                              className="checkbox-native"
                            />
                            <span>Project</span>
                          </div>
                        </th>
                        <th scope="col" className="py-3 px-3.5 font-semibold">
                          Chain & Stage
                        </th>
                        <th scope="col" className="py-3 px-3.5 font-semibold">
                          Pipeline Status
                        </th>
                        <th scope="col" className="py-3 px-3.5 font-semibold">
                          Contexts & Messages
                        </th>
                        <th scope="col" className="py-3 px-3.5 font-semibold">
                          Budget & Sentiment
                        </th>
                        <th
                          scope="col"
                          className="py-3 px-3.5 font-semibold text-right"
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e4e6eb] dark:divide-[#2a3942]">
                      {filteredProjects.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-8 text-center text-[#65676b] dark:text-[#8696a0]"
                          >
                            No projects match the current filter.
                          </td>
                        </tr>
                      ) : (
                        projectsPagination.items.map((project) => {
                          const statusMeta =
                            BUSINESS_STATUS_META[project.businessStatus];
                          const activeContextsCount = project.contexts.filter(
                            (c) => c.isActive
                          ).length;
                          const isArchived =
                            project.businessStatus === "archived";
                          const isSelectedRow = selectedProjectIdSet.has(
                            project.id
                          );

                          return (
                            <tr
                              key={project.id}
                              className="bg-white dark:bg-[#202c33] hover:bg-[#f0f2f5]/50 dark:hover:bg-[#2a3942]/40 transition"
                            >
                              <th
                                scope="row"
                                className="py-3 px-3.5 font-normal text-left"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={isSelectedRow}
                                    onChange={() =>
                                      toggleProjectSelection(project.id)
                                    }
                                    aria-label={`Select ${project.name}`}
                                    className="checkbox-native shrink-0"
                                  />
                                  <ProjectAvatar
                                    project={project}
                                    size="sm"
                                    onEditClick={() =>
                                      handleOpenEditProject(project)
                                    }
                                    decorative={false}
                                  />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-semibold text-[#050505] dark:text-[#e9edef] truncate">
                                        {project.name}
                                      </span>
                                      <span className="font-mono text-[11px] text-[#0084ff] font-semibold">
                                        {project.ticker}
                                      </span>
                                      {(project.tags?.includes("new") ||
                                        project.businessStatus === "new") && (
                                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-500/30 font-mono text-[9px] font-bold uppercase tracking-wider">
                                          new
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-[#65676b] dark:text-[#8696a0] truncate max-w-xs xl:max-w-md">
                                      {project.tagline}
                                    </div>
                                  </div>
                                </div>
                              </th>

                              <td className="py-3 px-3.5">
                                <div className="font-semibold text-[#050505] dark:text-[#e9edef]">
                                  {project.chain}
                                </div>
                                <div className="text-[11px] text-[#65676b] dark:text-[#8696a0]">
                                  {project.stage}
                                </div>
                              </td>

                              <td className="py-3 px-3.5">
                                <div className="flex items-center gap-2">
                                  <label
                                    htmlFor={`proj-status-${project.id}`}
                                    className="visually-hidden"
                                  >
                                    Pipeline status for {project.name}
                                  </label>
                                  <select
                                    id={`proj-status-${project.id}`}
                                    value={project.businessStatus}
                                    onChange={(e) =>
                                      void handleUpdateProjectStatus(
                                        project.id,
                                        project.name,
                                        e.target.value as ProjectBusinessStatus
                                      )
                                    }
                                    className="rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] px-2.5 py-1.5 text-xs font-semibold text-[#050505] dark:text-[#e9edef] outline-none cursor-pointer"
                                  >
                                    {BUSINESS_STATUS_ORDER.map((st) => (
                                      <option key={st} value={st}>
                                        {BUSINESS_STATUS_META[st].label}
                                      </option>
                                    ))}
                                  </select>
                                  <span
                                    className={`hidden xl:inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusMeta.badgeClass}`}
                                  >
                                    {statusMeta.shortLabel}
                                  </span>
                                </div>
                              </td>

                              <td className="py-3 px-3.5">
                                <div className="font-medium text-[#050505] dark:text-[#e9edef]">
                                  {activeContextsCount}/
                                  {project.contexts.length} active contexts
                                </div>
                                <div className="text-[11px] text-[#65676b] dark:text-[#8696a0]">
                                  {project.messages.length} messages · Active{" "}
                                  {project.lastActivityTime}
                                </div>
                              </td>

                              <td className="py-3 px-3.5">
                                <div className="font-semibold text-[#050505] dark:text-[#e9edef]">
                                  {project.campaignBudget}
                                </div>
                                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                  Sentiment: {project.sentimentScore}/100
                                </div>
                              </td>

                              <td className="py-3 px-3.5 text-right">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <Link
                                    href={`/?projectId=${encodeURIComponent(project.id)}`}
                                    aria-label={`Open ${project.name} in workspace`}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#e7f3ff] hover:bg-[#d0e7ff] text-[#0084ff] dark:bg-[#0084ff]/20 dark:text-[#4599ff] transition"
                                  >
                                    <span>Open</span>
                                    <ArrowUpRight
                                      className="w-3.5 h-3.5"
                                      aria-hidden="true"
                                    />
                                  </Link>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenEditProject(project)
                                    }
                                    aria-label={`Edit ${project.name}`}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#f0f2f5] hover:bg-[#e4e6eb] dark:bg-[#2a3942] dark:hover:bg-[#374248] text-[#050505] dark:text-[#e9edef] transition cursor-pointer"
                                  >
                                    <Pencil
                                      className="w-3.5 h-3.5"
                                      aria-hidden="true"
                                    />
                                    <span>Edit</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleUpdateProjectStatus(
                                        project.id,
                                        project.name,
                                        isArchived ? "active" : "archived"
                                      )
                                    }
                                    aria-label={
                                      isArchived
                                        ? `Restore project ${project.name}`
                                        : `Archive project ${project.name}`
                                    }
                                    title={
                                      isArchived
                                        ? "Restore project"
                                        : "Archive project"
                                    }
                                    className="p-1.5 rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] text-[#65676b] dark:text-[#8696a0] hover:text-[#050505] dark:hover:text-white transition cursor-pointer"
                                  >
                                    {isArchived ? (
                                      <ArchiveRestore
                                        className="w-3.5 h-3.5"
                                        aria-hidden="true"
                                      />
                                    ) : (
                                      <Archive
                                        className="w-3.5 h-3.5"
                                        aria-hidden="true"
                                      />
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleDeleteProject(
                                        project.id,
                                        project.name
                                      )
                                    }
                                    aria-label={`Delete project ${project.name}`}
                                    title={`Delete ${project.name}`}
                                    className="p-1.5 rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] text-[#65676b] hover:text-rose-600 dark:text-[#8696a0] dark:hover:text-rose-400 transition cursor-pointer"
                                  >
                                    <Trash2
                                      className="w-3.5 h-3.5"
                                      aria-hidden="true"
                                    />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <PaginationBar
                  meta={projectsPagination.meta}
                  pageNumbers={projectsPagination.pageNumbers}
                  pageSizeOptions={projectsPagination.pageSizeOptions}
                  onPageChange={projectsPagination.setPage}
                  onPageSizeChange={projectsPagination.setPageSize}
                  itemLabel="projects"
                  ariaLabel="Crypto projects pagination"
                  className="shrink-0 pt-1"
                />
              </section>
            )}

            {/* ========================================================= */}
            {/* VIEW 4: ROLES & PERMISSIONS (RBAC MATRIX)                 */}
            {/* ========================================================= */}
            {activeSection === "rbac" && (
              <div className="space-y-6">
                {/* Role Breakdown Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {USER_ROLES.map((roleKey) => {
                    const meta = USER_ROLE_META[roleKey];
                    const count = users.filter(
                      (u) => u.role === roleKey
                    ).length;
                    return (
                      <div
                        key={roleKey}
                        className="rounded-2xl bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] p-4 shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${meta.badgeClass}`}
                          >
                            {meta.label}
                          </span>
                          <span className="text-xs font-bold text-[#65676b] dark:text-[#8696a0]">
                            {count} {count === 1 ? "user" : "users"}
                          </span>
                        </div>
                        <p className="text-xs text-[#65676b] dark:text-[#8696a0] leading-relaxed">
                          {meta.description}
                        </p>
                        <div className="text-[11px] font-mono text-[#0084ff]">
                          {ROLE_PERMISSIONS[roleKey].length} /{" "}
                          {ALL_PERMISSIONS.length} permissions granted
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Permission Matrix Table */}
                <section
                  aria-labelledby="rbac-matrix-heading"
                  className="rounded-2xl bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] p-4 sm:p-5 shadow-2xs space-y-4"
                >
                  <div>
                    <h2
                      id="rbac-matrix-heading"
                      className="text-base sm:text-lg font-bold"
                    >
                      RBAC Permission Matrix
                    </h2>
                    <p className="text-xs text-[#65676b] dark:text-[#8696a0]">
                      Fine-grained permission matrix enforced by NestJS{" "}
                      <code className="font-mono">@RequirePermissions()</code>{" "}
                      guards and mirrored in client UI controls.
                    </p>
                  </div>

                  <div
                    tabIndex={0}
                    role="region"
                    aria-labelledby={rbacCaptionId}
                    className="overflow-x-auto scroller rounded-xl border border-[#e4e6eb] dark:border-[#2a3942]"
                  >
                    <table className="w-full text-left border-collapse text-xs">
                      <caption id={rbacCaptionId} className="visually-hidden">
                        Role-based access control permission matrix
                      </caption>
                      <thead>
                        <tr className="bg-[#f0f2f5] dark:bg-[#111b21] border-b border-[#e4e6eb] dark:border-[#2a3942]">
                          <th scope="col" className="py-3 px-3.5 font-semibold">
                            Permission
                          </th>
                          {USER_ROLES.map((role) => (
                            <th
                              key={role}
                              scope="col"
                              className="py-3 px-3.5 font-semibold text-center"
                            >
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] ${USER_ROLE_META[role].badgeClass}`}
                              >
                                {USER_ROLE_META[role].shortLabel}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e4e6eb] dark:divide-[#2a3942]">
                        {rbacPermissionsPagination.items.map((perm) => {
                          const meta = PERMISSION_LABELS[perm];
                          return (
                            <tr
                              key={perm}
                              className="bg-white dark:bg-[#202c33] hover:bg-[#f0f2f5]/40 dark:hover:bg-[#2a3942]/40"
                            >
                              <th
                                scope="row"
                                className="py-2.5 px-3.5 font-normal text-left"
                              >
                                <div className="font-medium text-[#050505] dark:text-[#e9edef]">
                                  {meta.label}
                                </div>
                                <div className="text-[10px] font-mono text-[#65676b] dark:text-[#8696a0]">
                                  {perm} · {meta.category}
                                </div>
                              </th>
                              {USER_ROLES.map((role) => {
                                const granted =
                                  ROLE_PERMISSIONS[role].includes(perm);
                                return (
                                  <td
                                    key={role}
                                    className="py-2.5 px-3.5 text-center"
                                  >
                                    {granted ? (
                                      <span
                                        aria-label={`Granted for ${role}`}
                                        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                      >
                                        <Check
                                          className="w-3.5 h-3.5"
                                          aria-hidden="true"
                                        />
                                      </span>
                                    ) : (
                                      <span
                                        aria-label={`Not granted for ${role}`}
                                        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[#65676b]/40 dark:text-[#8696a0]/40"
                                      >
                                        <XIcon
                                          className="w-3.5 h-3.5"
                                          aria-hidden="true"
                                        />
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <PaginationBar
                    meta={rbacPermissionsPagination.meta}
                    pageNumbers={rbacPermissionsPagination.pageNumbers}
                    pageSizeOptions={rbacPermissionsPagination.pageSizeOptions}
                    onPageChange={rbacPermissionsPagination.setPage}
                    onPageSizeChange={rbacPermissionsPagination.setPageSize}
                    itemLabel="permissions"
                    ariaLabel="RBAC permissions matrix pagination"
                    hideWhenSinglePage
                  />
                </section>
              </div>
            )}

            {/* ========================================================= */}
            {/* VIEW 5: AI PROMPTS & GLOBAL CHECKLIST SETTINGS            */}
            {/* ========================================================= */}
            {activeSection === "settings" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* System Prompts Column */}
                <section
                  aria-labelledby="admin-prompts-heading"
                  className="rounded-2xl bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] p-4 sm:p-5 shadow-2xs space-y-4"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#0084ff]/12 text-[#0084ff] flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div>
                      <h2
                        id="admin-prompts-heading"
                        className="text-base font-bold"
                      >
                        System Prompt Templates ({promptTemplates.length})
                      </h2>
                      <p className="text-xs text-[#65676b] dark:text-[#8696a0]">
                        One-click AI campaign and analysis buttons available in
                        every project chat.
                      </p>
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto scroller space-y-2.5 pr-1">
                    {settingsPromptsPagination.items.map((tpl) => (
                      <div
                        key={tpl.id}
                        className="p-3 rounded-xl bg-[#f0f2f5] dark:bg-[#111b21] border border-[#e4e6eb] dark:border-[#2a3942] space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            aria-label="Prompt action title"
                            value={tpl.label}
                            onChange={(e) =>
                              savePromptTemplateMutation.mutate({
                                ...tpl,
                                label: e.target.value,
                              })
                            }
                            className="flex-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] outline-none"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              deletePromptTemplateMutation.mutate(tpl.id)
                            }
                            aria-label={`Remove ${tpl.label}`}
                            title="Delete prompt template"
                            className="p-1.5 rounded-lg text-[#65676b] hover:text-rose-600 dark:text-[#8696a0] dark:hover:text-rose-400 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          aria-label={`System prompt for ${tpl.label}`}
                          value={tpl.systemPrompt}
                          onChange={(e) =>
                            savePromptTemplateMutation.mutate({
                              ...tpl,
                              systemPrompt: e.target.value,
                            })
                          }
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-[#202c33] text-[#65676b] dark:text-[#d1d7db] outline-none resize-none"
                        />
                      </div>
                    ))}
                  </div>

                  <PaginationBar
                    variant="compact"
                    meta={settingsPromptsPagination.meta}
                    pageSizeOptions={settingsPromptsPagination.pageSizeOptions}
                    onPageChange={settingsPromptsPagination.setPage}
                    onPageSizeChange={settingsPromptsPagination.setPageSize}
                    itemLabel="prompts"
                    ariaLabel="Admin system prompts pagination"
                    hideWhenSinglePage
                  />

                  <form
                    onSubmit={handleAddPromptSubmit}
                    noValidate
                    className="p-3.5 rounded-xl border border-[#e4e6eb] dark:border-[#2a3942] space-y-2.5"
                  >
                    <span className="block text-xs font-semibold text-[#050505] dark:text-[#e9edef]">
                      Add New Prompt Action
                    </span>
                    <FormField
                      label="Button label"
                      srOnlyLabel
                      required
                      error={promptForm.formState.errors.label}
                    >
                      {(a11yProps) => (
                        <input
                          {...a11yProps}
                          {...promptForm.register("label")}
                          type="text"
                          required
                          placeholder="Button title (e.g., Draft Tokenomics Summary Thread)"
                          className="w-full px-3 py-1.5 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
                        />
                      )}
                    </FormField>

                    <FormField
                      label="System prompt instructions"
                      srOnlyLabel
                      required
                      error={promptForm.formState.errors.systemPrompt}
                    >
                      {(a11yProps) => (
                        <textarea
                          {...a11yProps}
                          {...promptForm.register("systemPrompt")}
                          rows={2}
                          required
                          placeholder="System prompt instructions sent to AI when clicked..."
                          className="w-full px-3 py-1.5 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none resize-none"
                        />
                      )}
                    </FormField>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={promptForm.formState.isSubmitting}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] disabled:opacity-50 text-white transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Add Prompt</span>
                      </button>
                    </div>
                  </form>
                </section>

                {/* Global Checklist Column */}
                <section
                  aria-labelledby="admin-checklist-heading"
                  className="rounded-2xl bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] p-4 sm:p-5 shadow-2xs space-y-4"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#00a884]/12 text-[#00a884] flex items-center justify-center shrink-0">
                      <ListChecks className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div>
                      <h2
                        id="admin-checklist-heading"
                        className="text-base font-bold"
                      >
                        Global Due-Diligence Checklist ({checklistItems.length})
                      </h2>
                      <p className="text-xs text-[#65676b] dark:text-[#8696a0]">
                        Standardized verification items evaluated across all
                        crypto projects.
                      </p>
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto scroller space-y-2.5 pr-1">
                    {settingsChecklistPagination.items.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-[#f0f2f5] dark:bg-[#111b21] border border-[#e4e6eb] dark:border-[#2a3942] space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            aria-label="Checklist item name"
                            value={item.label}
                            onChange={(e) =>
                              saveChecklistItemMutation.mutate({
                                ...item,
                                label: e.target.value,
                              })
                            }
                            className="flex-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] outline-none"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              deleteChecklistItemMutation.mutate(item.id)
                            }
                            aria-label={`Remove ${item.label}`}
                            title="Remove checklist item"
                            className="p-1.5 rounded-lg text-[#65676b] hover:text-rose-600 dark:text-[#8696a0] dark:hover:text-rose-400 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                        <input
                          type="text"
                          aria-label={`Scan prompt for ${item.label}`}
                          value={item.scanPrompt}
                          onChange={(e) =>
                            saveChecklistItemMutation.mutate({
                              ...item,
                              scanPrompt: e.target.value,
                            })
                          }
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-[#202c33] text-[#65676b] dark:text-[#d1d7db] outline-none"
                        />
                      </div>
                    ))}
                  </div>

                  <PaginationBar
                    variant="compact"
                    meta={settingsChecklistPagination.meta}
                    pageSizeOptions={
                      settingsChecklistPagination.pageSizeOptions
                    }
                    onPageChange={settingsChecklistPagination.setPage}
                    onPageSizeChange={settingsChecklistPagination.setPageSize}
                    itemLabel="checklist items"
                    ariaLabel="Admin global checklist pagination"
                    hideWhenSinglePage
                  />

                  <form
                    onSubmit={handleAddChecklistSubmit}
                    noValidate
                    className="p-3.5 rounded-xl border border-[#e4e6eb] dark:border-[#2a3942] space-y-2.5"
                  >
                    <span className="block text-xs font-semibold text-[#050505] dark:text-[#e9edef]">
                      Add Global Checklist Item
                    </span>
                    <FormField
                      label="Feature name"
                      srOnlyLabel
                      required
                      error={checklistForm.formState.errors.label}
                    >
                      {(a11yProps) => (
                        <input
                          {...a11yProps}
                          {...checklistForm.register("label")}
                          type="text"
                          required
                          placeholder="e.g., Smart Contract Audit Report"
                          className="w-full px-3 py-1.5 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
                        />
                      )}
                    </FormField>

                    <FormField
                      label="Scan prompt question"
                      srOnlyLabel
                      required
                      error={checklistForm.formState.errors.scanPrompt}
                    >
                      {(a11yProps) => (
                        <input
                          {...a11yProps}
                          {...checklistForm.register("scanPrompt")}
                          type="text"
                          required
                          placeholder="e.g., Has the protocol published a third-party security audit?"
                          className="w-full px-3 py-1.5 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
                        />
                      )}
                    </FormField>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={checklistForm.formState.isSubmitting}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] disabled:opacity-50 text-white transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Add to Checklist</span>
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            )}

            {/* ========================================================= */}
            {/* VIEW 6: SECURITY & ACTIVATION AUDIT LOG                   */}
            {/* ========================================================= */}
            {activeSection === "audit" && (
              <section
                aria-labelledby="audit-logs-heading"
                className="rounded-2xl bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] p-4 sm:p-5 shadow-2xs space-y-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#0084ff]/12 text-[#0084ff] flex items-center justify-center shrink-0">
                      <History className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div>
                      <h2
                        id="audit-logs-heading"
                        className="text-base sm:text-lg font-bold"
                      >
                        Security & Activation Audit Log (
                        {filteredAuditLogs.length})
                      </h2>
                      <p className="text-xs text-[#65676b] dark:text-[#8696a0]">
                        Immutable record of user activations, role changes, and
                        administrative operations.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                    <div className="flex items-center gap-1.5 overflow-x-auto scroller">
                      <FilterChip
                        active={auditRoleFilter === "all"}
                        onClick={() => setAuditRoleFilter("all")}
                        count={auditLogs.length}
                      >
                        All Roles
                      </FilterChip>
                      {USER_ROLES.map((roleKey) => (
                        <FilterChip
                          key={roleKey}
                          active={auditRoleFilter === roleKey}
                          onClick={() => setAuditRoleFilter(roleKey)}
                          count={
                            auditLogs.filter((l) => l.actorRole === roleKey)
                              .length
                          }
                        >
                          {USER_ROLE_META[roleKey].shortLabel}
                        </FilterChip>
                      ))}
                    </div>

                    <search className="relative min-w-56">
                      <label
                        htmlFor={auditSearchInputId}
                        className="visually-hidden"
                      >
                        Search audit logs
                      </label>
                      <Search
                        className="w-3.5 h-3.5 text-[#65676b] dark:text-[#8696a0] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id={auditSearchInputId}
                        type="search"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        value={auditSearchQuery}
                        onChange={(e) => setAuditSearchQuery(e.target.value)}
                        placeholder="Search actor, action, resource..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-full bg-[#f0f2f5] dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef] border border-transparent focus:border-[#0084ff] outline-none"
                      />
                    </search>
                  </div>
                </div>

                {filteredAuditLogs.length === 0 ? (
                  <p className="text-xs text-center text-[#65676b] dark:text-[#8696a0] py-8">
                    No audit events match the current filter.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {auditLogsPagination.items.map((log) => (
                        <div
                          key={log.id}
                          className="rounded-xl border border-[#e4e6eb] dark:border-[#2a3942] bg-[#f0f2f5]/50 dark:bg-[#111b21] px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-semibold text-[#0084ff]">
                                {log.action}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  USER_ROLE_META[log.actorRole].badgeClass
                                }`}
                              >
                                {log.actorRole}
                              </span>
                              <span className="text-[#65676b] dark:text-[#8696a0] truncate">
                                {log.actorEmail}
                              </span>
                            </div>
                            {log.details && (
                              <p className="text-[11px] text-[#65676b] dark:text-[#8696a0] font-mono mt-0.5 truncate">
                                {JSON.stringify(log.details)}
                              </p>
                            )}
                          </div>
                          <span className="text-[11px] text-[#65676b] dark:text-[#8696a0] shrink-0">
                            {new Date(log.createdAt).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      ))}
                    </div>

                    <PaginationBar
                      meta={auditLogsPagination.meta}
                      pageNumbers={auditLogsPagination.pageNumbers}
                      pageSizeOptions={auditLogsPagination.pageSizeOptions}
                      onPageChange={auditLogsPagination.setPage}
                      onPageSizeChange={auditLogsPagination.setPageSize}
                      itemLabel="audit events"
                      ariaLabel="Security audit logs pagination"
                    />
                  </>
                )}
              </section>
            )}
          </div>
        </main>
      </div>

      <NewProjectDialog
        dialogRef={newProjectDialogRef}
        onCreateProject={handleCreateProject}
      />

      <SyncProjectsDialog
        dialogRef={syncProjectsDialogRef}
        providerStatuses={syncProviders}
        jobState={syncJobState}
        wsConnected={syncWsConnected}
        onStartSync={handleStartProjectSync}
        onStopSync={stopAsyncSync}
        onTriggerNextPage={triggerNextSyncPage}
        onResetCursor={resetSyncCursor}
        onClearLogs={clearSyncLogs}
      />

      <EditProjectDialog
        dialogRef={editProjectDialogRef}
        project={editingProject}
        onUpdateProject={handleUpdateProject}
      />

      <ModalDialog
        dialogRef={bulkDeleteProjectsDialogRef}
        title="Delete Selected Projects"
        subtitle={`Permanently remove ${activeSelectedProjectIds.length} selected ${activeSelectedProjectIds.length === 1 ? "project" : "projects"}`}
        maxWidthClass="max-w-md"
      >
        <div className="mt-4 space-y-4">
          <p className="text-xs text-[#65676b] dark:text-[#8696a0] leading-relaxed">
            This will permanently delete{" "}
            <strong className="text-[#050505] dark:text-[#e9edef]">
              {activeSelectedProjectIds.length}
            </strong>{" "}
            selected{" "}
            {activeSelectedProjectIds.length === 1 ? "project" : "projects"}{" "}
            along with their contexts, AI chat messages, and due-diligence
            checklist records. This action cannot be undone.
          </p>

          {selectedProjects.length > 0 && (
            <div className="rounded-xl bg-[#f0f2f5] dark:bg-[#111b21] border border-[#e4e6eb] dark:border-[#2a3942] p-3 space-y-1.5">
              <div className="text-[11px] font-semibold text-[#65676b] dark:text-[#8696a0]">
                Projects queued for deletion:
              </div>
              <ul className="text-xs text-[#050505] dark:text-[#e9edef] space-y-1">
                {selectedProjects.slice(0, 5).map((project) => (
                  <li
                    key={project.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="truncate font-medium">{project.name}</span>
                    <span className="font-mono text-[11px] text-[#0084ff] shrink-0">
                      {project.ticker}
                    </span>
                  </li>
                ))}
              </ul>
              {selectedProjects.length > 5 && (
                <p className="text-[11px] text-[#65676b] dark:text-[#8696a0]">
                  and {selectedProjects.length - 5} more...
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={bulkDeleteProjectsMutation.isPending}
              onClick={() => bulkDeleteProjectsDialogRef.current?.close()}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#65676b] dark:text-[#8696a0] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] disabled:opacity-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={
                bulkDeleteProjectsMutation.isPending ||
                activeSelectedProjectIds.length === 0
              }
              onClick={() => void handleConfirmBulkDeleteProjects()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {bulkDeleteProjectsMutation.isPending
                  ? "Deleting..."
                  : `Delete ${activeSelectedProjectIds.length} ${activeSelectedProjectIds.length === 1 ? "Project" : "Projects"}`}
              </span>
            </button>
          </div>
        </div>
      </ModalDialog>
    </div>
  );
}
