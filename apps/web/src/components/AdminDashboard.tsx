"use client";

import React, { useId, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Activity,
  Archive,
  ArchiveRestore,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FolderKanban,
  History,
  LogOut,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import {
  BUSINESS_STATUS_META,
  BUSINESS_STATUS_ORDER,
  USER_ROLES,
  USER_ROLE_META,
  createUserDtoSchema,
  hasPermission,
  type AuthUser,
  type CreateUserDto,
  type CryptoProject,
  type NewProjectFormValues,
  type ProjectBusinessStatus,
  type UpdateProjectFormValues,
  type UserRole,
} from "@/types/project";
import {
  useAuditLogsQuery,
  useCreateProjectMutation,
  useCreateUserMutation,
  useCurrentUserQuery,
  useDashboardDialogs,
  useDeleteProjectMutation,
  useDeleteUserMutation,
  useLoginMutation,
  useLogoutMutation,
  useProjectsQuery,
  useRegisterMutation,
  useSystemHealthQuery,
  useUpdateBusinessStatusMutation,
  useUpdateProjectMutation,
  useUpdateUserRoleMutation,
  useUpdateUserStatusMutation,
  useUsersQuery,
} from "@/hooks";
import { AuthScreen } from "@/components/AuthScreen";
import { ProjectAvatar } from "@/components/ProjectAvatar";
import { EditProjectDialog, NewProjectDialog } from "@/components/modals";
import { FilterChip } from "@/components/ui";

type UserFilterStatus = "all" | "pending" | "active";
type ProjectFilterStatus = "all" | ProjectBusinessStatus;

export function AdminDashboard() {
  const currentUserQuery = useCurrentUserQuery();
  const currentUser = currentUserQuery.data ?? null;
  const isAuthenticated = Boolean(currentUser);
  const isAdmin =
    currentUser?.role === "admin" ||
    hasPermission(currentUser, "users:write");

  const { data: healthStatus } = useSystemHealthQuery();
  const usersQuery = useUsersQuery(isAuthenticated && isAdmin);
  const projectsQuery = useProjectsQuery(isAuthenticated && isAdmin);
  const auditLogsQuery = useAuditLogsQuery(isAuthenticated && isAdmin);

  const users = usersQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const auditLogs = auditLogsQuery.data ?? [];

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
  const deleteProjectMutation = useDeleteProjectMutation();

  const {
    newProjectDialogRef,
    editProjectDialogRef,
    openNewProjectModal,
    openEditProjectModal,
  } = useDashboardDialogs();

  const [editingProject, setEditingProject] = useState<CryptoProject | null>(
    null
  );

  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userFilter, setUserFilter] = useState<UserFilterStatus>("all");
  const [showCreateUserForm, setShowCreateUserForm] = useState(false);

  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] =
    useState<ProjectFilterStatus>("all");

  const [statusAnnouncement, setStatusAnnouncement] = useState<string | null>(
    null
  );
  const [actionError, setActionError] = useState<string | null>(null);

  const usersCaptionId = useId();
  const projectsCaptionId = useId();
  const userSearchInputId = useId();
  const projectSearchInputId = useId();
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

  const inactiveUsers = users.filter((u) => !u.isActive);
  const activeUsers = users.filter((u) => u.isActive);
  const activeProjectsCount = projects.filter(
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
      project.tagline.toLowerCase().includes(query);

    if (!matchesSearch) return false;
    if (projectFilter === "all") return true;
    return project.businessStatus === projectFilter;
  });

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

  const handleDeleteProject = async (
    projectId: string,
    projectName: string
  ) => {
    setActionError(null);
    setStatusAnnouncement(null);
    try {
      await deleteProjectMutation.mutateAsync(projectId);
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

  const isMutatingUsers =
    createUserMutation.isPending ||
    updateUserRoleMutation.isPending ||
    updateUserStatusMutation.isPending ||
    deleteUserMutation.isPending;

  return (
    <div className="h-dvh w-full flex flex-col overflow-hidden bg-[#f0f2f5] dark:bg-[#0b141a] text-[#050505] dark:text-[#e9edef]">
      {/* Skip link per modern-web-guidance (accessibility) */}
      <a
        href="#admin-main-heading"
        className="visually-hidden focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-xl focus:bg-[#0084ff] focus:text-white focus:text-xs focus:font-semibold focus:shadow-md"
      >
        Skip to main content
      </a>

      {/* Top Site Header with Primary Navigation Landmark */}
      <header className="shrink-0 bg-white dark:bg-[#111b21] border-b border-[#e4e6eb] dark:border-[#222d34] px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0084ff] text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight">
                  PulseOS Admin
                </span>
                {healthStatus && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
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
                      {healthStatus.status === "ok"
                        ? "Services Live"
                        : "Degraded"}
                    </span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#65676b] dark:text-[#8696a0]">
                User Activation, RBAC Directory & Global Project Governance
              </p>
            </div>
          </div>

          <nav
            aria-label="Primary"
            className="flex items-center gap-1 sm:gap-2"
          >
            <Link
              href="/"
              className="site-nav-link inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-[#65676b] dark:text-[#8696a0] hover:text-[#050505] dark:hover:text-[#e9edef] hover:bg-[#f0f2f5] dark:hover:bg-[#202c33] transition"
            >
              <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Messenger Workspace</span>
            </Link>
            <Link
              href="/admin"
              aria-current="page"
              className="site-nav-link inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#e7f3ff]/60 dark:bg-[#0084ff]/15 transition"
            >
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Admin Dashboard</span>
              {inactiveUsers.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                  {inactiveUsers.length}
                </span>
              )}
            </Link>
          </nav>

          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[#f0f2f5] dark:bg-[#202c33]">
              <div
                className={`w-6 h-6 rounded-full ${currentUser.avatarColor} text-white font-bold text-[10px] flex items-center justify-center shrink-0`}
              >
                {currentUser.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <span className="text-xs font-semibold truncate max-w-32">
                {currentUser.name}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${
                  USER_ROLE_META[currentUser.role].badgeClass
                }`}
              >
                {USER_ROLE_META[currentUser.role].shortLabel}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                void usersQuery.refetch();
                void projectsQuery.refetch();
                void auditLogsQuery.refetch();
              }}
              aria-label="Refresh admin dashboard data"
              title="Refresh data"
              className="p-2 rounded-xl bg-[#f0f2f5] hover:bg-[#e4e6eb] dark:bg-[#202c33] dark:hover:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => logoutMutation.mutate()}
              aria-label="Sign out"
              title="Sign out"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#f0f2f5] hover:bg-rose-500/12 text-[#65676b] hover:text-rose-600 dark:bg-[#202c33] dark:text-[#8696a0] dark:hover:text-rose-400 text-xs font-semibold transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden md:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Scrollable Main Content Landmark */}
      <main className="flex-1 overflow-y-auto scroller p-4 sm:p-6">
        <div className="max-w-7xl mx-auto space-y-6 pb-8">
          {/* Page Heading & Quick Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1
                id="admin-main-heading"
                tabIndex={-1}
                className="text-xl sm:text-2xl font-bold tracking-tight outline-none"
              >
                Admin Control Center
              </h1>
              <p className="text-xs sm:text-sm text-[#65676b] dark:text-[#8696a0]">
                Approve newly registered inactive users, manage RBAC permissions,
                and oversee all Web3 project workspaces.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowCreateUserForm((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] transition cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5 text-[#0084ff]" aria-hidden="true" />
                <span>
                  {showCreateUserForm ? "Close User Form" : "Provision User"}
                </span>
              </button>

              <button
                type="button"
                onClick={openNewProjectModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] text-white transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>New Project</span>
              </button>
            </div>
          </div>

          {/* Centralized Live Regions for Announcements & Errors */}
          <div aria-live="polite" role="status">
            {statusAnnouncement && (
              <div className="rounded-xl bg-emerald-500/12 border border-emerald-500/30 px-4 py-2.5 text-xs text-emerald-800 dark:text-emerald-300 font-medium flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
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

          <div aria-live="polite">
            {actionError && (
              <div
                role="alert"
                className="rounded-xl bg-rose-500/12 border border-rose-500/30 px-4 py-2.5 text-xs text-rose-700 dark:text-rose-300 font-medium"
              >
                {actionError}
              </div>
            )}
          </div>

          {/* KPI Summary Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="rounded-2xl bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] p-4 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-[#65676b] dark:text-[#8696a0] mb-1">
                <span className="font-semibold">Total Registered Users</span>
                <Users className="w-4 h-4 text-[#0084ff]" aria-hidden="true" />
              </div>
              <div className="text-2xl font-bold">{users.length}</div>
              <div className="text-[11px] text-[#65676b] dark:text-[#8696a0] mt-1">
                {activeUsers.length} active · {inactiveUsers.length} inactive
              </div>
            </div>

            <div
              className={`rounded-2xl border p-4 shadow-2xs ${
                inactiveUsers.length > 0
                  ? "bg-amber-500/8 dark:bg-amber-500/10 border-amber-500/40"
                  : "bg-white dark:bg-[#202c33] border-[#e4e6eb] dark:border-[#2a3942]"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-[#65676b] dark:text-[#8696a0] mb-1">
                <span className="font-semibold">Pending User Activations</span>
                <Clock
                  className={`w-4 h-4 ${
                    inactiveUsers.length > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                  aria-hidden="true"
                />
              </div>
              <div className="text-2xl font-bold">{inactiveUsers.length}</div>
              <div className="text-[11px] text-[#65676b] dark:text-[#8696a0] mt-1">
                {inactiveUsers.length > 0
                  ? "Awaiting administrator activation"
                  : "All registered users are active"}
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] p-4 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-[#65676b] dark:text-[#8696a0] mb-1">
                <span className="font-semibold">Total Crypto Projects</span>
                <FolderKanban
                  className="w-4 h-4 text-[#00a884]"
                  aria-hidden="true"
                />
              </div>
              <div className="text-2xl font-bold">{projects.length}</div>
              <div className="text-[11px] text-[#65676b] dark:text-[#8696a0] mt-1">
                {activeProjectsCount} active pipeline ·{" "}
                {projects.length - activeProjectsCount} archived
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] p-4 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-[#65676b] dark:text-[#8696a0] mb-1">
                <span className="font-semibold">Intelligence & AI Output</span>
                <Activity
                  className="w-4 h-4 text-purple-600 dark:text-purple-400"
                  aria-hidden="true"
                />
              </div>
              <div className="text-2xl font-bold">{totalContextsCount}</div>
              <div className="text-[11px] text-[#65676b] dark:text-[#8696a0] mt-1">
                Tracked contexts · {totalMessagesCount} AI chat messages
              </div>
            </div>
          </div>

          {/* Pending User Approvals Callout Section (shown when inactive users exist) */}
          {inactiveUsers.length > 0 && (
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
                      Newly registered users are inactive by default and cannot
                      sign in until activated below.
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
                {inactiveUsers.map((pendingUser) => (
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
            </section>
          )}

          {/* Section 1: All Users Directory & Activation Controls */}
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
                  View all workspace accounts, activate newly registered users,
                  or adjust RBAC role assignments.
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

                <div className="relative min-w-56">
                  <label htmlFor={userSearchInputId} className="visually-hidden">
                    Search users
                  </label>
                  <Search
                    className="w-3.5 h-3.5 text-[#65676b] dark:text-[#8696a0] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id={userSearchInputId}
                    type="search"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search name, email, role..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-full bg-[#f0f2f5] dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef] border border-transparent focus:border-[#0084ff] outline-none"
                  />
                </div>
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

            {/* Semantic Responsive Data Table for Users per modern-web-guidance (responsive-table) */}
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
                    filteredUsers.map((member) => {
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
                              {member.permissions.length} granted permissions
                            </div>
                          </td>

                          <td className="py-3 px-3.5 text-[#65676b] dark:text-[#8696a0]">
                            {member.lastLoginAt
                              ? new Date(member.lastLoginAt).toLocaleDateString(
                                  undefined,
                                  {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )
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
                                  onClick={() => void handleDeleteUser(member)}
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
          </section>

          {/* Section 2: All Crypto Projects Governance Table */}
          <section
            aria-labelledby="projects-directory-heading"
            className="rounded-2xl bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] p-4 sm:p-5 shadow-2xs space-y-4"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h2
                  id="projects-directory-heading"
                  className="text-base sm:text-lg font-bold"
                >
                  All Crypto Projects ({projects.length})
                </h2>
                <p className="text-xs text-[#65676b] dark:text-[#8696a0]">
                  Complete overview of every Web3 project workspace, pipeline
                  stage, intelligence context count, and campaign budget.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                <div className="flex items-center gap-1.5 overflow-x-auto scroller">
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
                        projects.filter((p) => p.businessStatus === statusKey)
                          .length
                      }
                    >
                      {BUSINESS_STATUS_META[statusKey].shortLabel}
                    </FilterChip>
                  ))}
                </div>

                <div className="relative min-w-56">
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
                    value={projectSearchQuery}
                    onChange={(e) => setProjectSearchQuery(e.target.value)}
                    placeholder="Search project, ticker, chain..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-full bg-[#f0f2f5] dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef] border border-transparent focus:border-[#0084ff] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Semantic Responsive Data Table for Projects per modern-web-guidance (responsive-table) */}
            <div
              tabIndex={0}
              role="region"
              aria-labelledby={projectsCaptionId}
              className="table-wrapper scroller rounded-xl border border-[#e4e6eb] dark:border-[#2a3942]"
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
                      Project
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
                    filteredProjects.map((project) => {
                      const statusMeta =
                        BUSINESS_STATUS_META[project.businessStatus];
                      const activeContextsCount = project.contexts.filter(
                        (c) => c.isActive
                      ).length;
                      const isArchived = project.businessStatus === "archived";

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
                              <ProjectAvatar
                                project={project}
                                size="sm"
                                decorative
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-[#050505] dark:text-[#e9edef] truncate">
                                    {project.name}
                                  </span>
                                  <span className="font-mono text-[11px] text-[#0084ff] font-semibold">
                                    {project.ticker}
                                  </span>
                                </div>
                                <div className="text-[11px] text-[#65676b] dark:text-[#8696a0] truncate max-w-xs">
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
                              {activeContextsCount}/{project.contexts.length}{" "}
                              active contexts
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

                              <button
                                type="button"
                                onClick={() =>
                                  void handleUpdateProjectStatus(
                                    project.id,
                                    project.name,
                                    isArchived ? "new" : "archived"
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
          </section>

          {/* Section 3: Recent Security & User Activation Audit Logs */}
          <section
            aria-labelledby="audit-logs-heading"
            className="rounded-2xl bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] p-4 sm:p-5 shadow-2xs space-y-3"
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#0084ff]" aria-hidden="true" />
              <h2
                id="audit-logs-heading"
                className="text-base sm:text-lg font-bold"
              >
                Security & Activation Audit Log ({auditLogs.length})
              </h2>
            </div>

            {auditLogs.length === 0 ? (
              <p className="text-xs text-[#65676b] dark:text-[#8696a0] py-4">
                No audit events recorded yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto scroller">
                {auditLogs.slice(0, 12).map((log) => (
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
                      {new Date(log.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      <NewProjectDialog
        dialogRef={newProjectDialogRef}
        onCreateProject={handleCreateProject}
      />

      <EditProjectDialog
        dialogRef={editProjectDialogRef}
        project={editingProject}
        onUpdateProject={handleUpdateProject}
      />
    </div>
  );
}
