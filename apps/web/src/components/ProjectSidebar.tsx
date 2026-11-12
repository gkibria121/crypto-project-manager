"use client";

import React, { useId, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Settings,
  Shield,
} from "lucide-react";
import {
  BUSINESS_STATUS_META,
  COMPACT_PAGE_SIZE_OPTIONS,
  USER_ROLE_META,
  hasPermission,
  type AuthUser,
  type CryptoProject,
  type ProjectBusinessStatus,
  type SystemHealthStatus,
} from "@/types/project";
import { ProjectAvatar } from "@/components/ProjectAvatar";
import { FilterChip, PaginationBar } from "@/components/ui";
import { usePagination } from "@/hooks/usePagination";

interface ProjectSidebarProps {
  currentUser: AuthUser;
  projects: CryptoProject[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  onUpdateBusinessStatus: (
    projectId: string,
    status: ProjectBusinessStatus
  ) => void;
  onOpenNewProjectModal: () => void;
  onOpenGlobalSettings: () => void;
  onOpenTeamRbacModal: () => void;
  onLogout: () => void;
  healthStatus?: SystemHealthStatus;
  pendingUsersCount?: number;
  isMobileHidden?: boolean;
}

type SidebarFilter = "all" | ProjectBusinessStatus;

const FILTER_TABS: { id: SidebarFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "active", label: "Active" },
  { id: "contacted", label: "Contacted" },
  { id: "collaborated", label: "Collaborated" },
  { id: "completed", label: "Completed" },
  { id: "unresponsive", label: "Unresponsive" },
  { id: "archived", label: "Archived" },
];

export function ProjectSidebar({
  currentUser,
  projects,
  selectedProjectId,
  onSelectProject,
  onUpdateBusinessStatus,
  onOpenNewProjectModal,
  onOpenGlobalSettings,
  onOpenTeamRbacModal,
  onLogout,
  healthStatus,
  pendingUsersCount = 0,
  isMobileHidden = false,
}: ProjectSidebarProps) {
  const searchInputId = useId();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<SidebarFilter>("all");

  const isAdmin =
    currentUser.role === "admin" || hasPermission(currentUser, "users:write");
  const canCreateProject = hasPermission(currentUser, "projects:create");
  const canUpdateProject = hasPermission(currentUser, "projects:update");
  const canWriteSettings = hasPermission(currentUser, "settings:write");

  const countByStatus = (status: SidebarFilter) => {
    if (status === "all") {
      return projects.filter((p) => p.businessStatus !== "archived").length;
    }
    return projects.filter((p) => p.businessStatus === status).length;
  };

  const filteredProjects = projects
    .filter((project) => {
      const matchesQuery =
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.chain.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesQuery) return false;

      if (activeFilter === "all") {
        return searchQuery.trim()
          ? true
          : project.businessStatus !== "archived";
      }
      return project.businessStatus === activeFilter;
    })
    .sort(
      (a, b) =>
        BUSINESS_STATUS_META[a.businessStatus].sortPriority -
        BUSINESS_STATUS_META[b.businessStatus].sortPriority
    );

  const sidebarPagination = usePagination(filteredProjects, {
    initialPageSize: 15,
    pageSizeOptions: COMPACT_PAGE_SIZE_OPTIONS,
    resetKey: `${activeFilter}:${searchQuery}`,
  });

  return (
    <aside
      aria-label="Projects"
      className={`${
        isMobileHidden ? "hidden md:flex" : "flex"
      } w-full md:w-76 lg:w-88 shrink-0 h-full border-r border-[#e4e6eb] dark:border-[#222d34] bg-white dark:bg-[#111b21] flex-col min-w-0`}
    >
      {/* WhatsApp / Messenger Top Header */}
      <div className="px-3.5 sm:px-4 pt-3.5 pb-2.5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-[#050505] dark:text-[#e9edef]">
              Projects
            </h1>
            {healthStatus && (
              <span
                title={`API: ${healthStatus.status} · DB: ${healthStatus.dependencies.database} · Scraper: ${healthStatus.dependencies.scraper}`}
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
                  {healthStatus.status === "ok" ? "Services Live" : "Degraded"}
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {isAdmin && (
              <Link
                href="/admin"
                aria-label={
                  pendingUsersCount > 0
                    ? `Admin Dashboard (${pendingUsersCount} pending user activations)`
                    : "Admin Dashboard"
                }
                title="Open Admin Dashboard"
                className="relative h-10 sm:h-9 px-2.5 rounded-full bg-[#e7f3ff] hover:bg-[#d0e7ff] dark:bg-[#0084ff]/20 dark:hover:bg-[#0084ff]/30 text-[#0084ff] dark:text-[#4599ff] flex items-center gap-1.5 text-xs font-semibold transition"
              >
                <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
                <span className="hidden lg:inline">Admin</span>
              
              </Link>
            )} 
            {canWriteSettings && (
              <button
                type="button"
                onClick={onOpenGlobalSettings}
                aria-label="Global settings for system prompts and checklist"
                title="Global Settings (Prompts & Checklist)"
                className="w-10 h-10 sm:w-9 sm:h-9 rounded-full bg-[#f0f2f5] hover:bg-[#e4e6eb] dark:bg-[#202c33] dark:hover:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] flex items-center justify-center transition cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            {canCreateProject && (
              <button
                type="button"
                onClick={onOpenNewProjectModal}
                aria-label="New project"
                title="New project"
                className="w-10 h-10 sm:w-9 sm:h-9 rounded-full bg-[#f0f2f5] hover:bg-[#e4e6eb] dark:bg-[#202c33] dark:hover:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] flex items-center justify-center transition cursor-pointer"
              >
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Clean Rounded Search Input */}
        <div className="relative">
          <label htmlFor={searchInputId} className="sr-only">
            Search projects
          </label>
          <Search className="w-4 h-4 text-[#65676b] dark:text-[#8696a0] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id={searchInputId}
            type="search"
            name="project-search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects"
            className="w-full pl-9 pr-3.5 py-2 text-base sm:text-[14px] rounded-full bg-[#f0f2f5] dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] placeholder:text-[#65676b] dark:placeholder:text-[#8696a0] outline-none"
          />
        </div>

        {/* Messenger / WhatsApp Filter Chips */}
        <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto scroller pb-1">
          {FILTER_TABS.map((tab) => (
            <FilterChip
              key={tab.id}
              active={activeFilter === tab.id}
              onClick={() => setActiveFilter(tab.id)}
              count={countByStatus(tab.id)}
            >
              {tab.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto scroller px-2 py-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {filteredProjects.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-sm text-[#65676b] dark:text-[#8696a0]">
              No projects in{" "}
              {activeFilter === "all"
                ? "All Projects"
                : BUSINESS_STATUS_META[activeFilter].label}
              .
            </p>
          </div>
        ) : (
          sidebarPagination.items.map((project) => {
            const isSelected = project.id === selectedProjectId;
            const lastMsg = project.messages[project.messages.length - 1];
            const statusMeta = BUSINESS_STATUS_META[project.businessStatus];
            const isArchived = project.businessStatus === "archived";

            return (
              <div
                key={project.id}
                className={`w-full rounded-xl transition flex items-center gap-2.5 sm:gap-3 px-2.5 py-2.5 group relative ${
                  isSelected
                    ? "bg-[#e7f3ff]/70 dark:bg-[#2a3942]"
                    : "hover:bg-[#f0f2f5] dark:hover:bg-[#202c33]"
                } ${isArchived ? "opacity-65" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => onSelectProject(project.id)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
                >
                  <ProjectAvatar
                    project={project}
                    size="lg"
                    showOnlineDot
                    decorative
                  />

                  <div className="flex-1 min-w-0">
                    {/* Top Row: Name + Status Pill + Time */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[15px] font-semibold text-[#050505] dark:text-[#e9edef] truncate">
                          {project.name}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${statusMeta.badgeClass}`}
                        >
                          {statusMeta.shortLabel}
                        </span>
                      </div>
                      <span className="text-xs text-[#65676b] dark:text-[#8696a0] shrink-0 md:group-hover:hidden">
                        {project.lastActivityTime}
                      </span>
                    </div>

                    {/* Bottom Row: Single-line message preview + Unread Dot */}
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p
                        className={`text-[13px] truncate ${
                          project.unreadInsights
                            ? "font-semibold text-[#050505] dark:text-[#e9edef]"
                            : "text-[#65676b] dark:text-[#8696a0]"
                        }`}
                      >
                        {lastMsg
                          ? `${lastMsg.sender === "admin" ? "You: " : ""}${lastMsg.content.replace(/[#*>`]/g, "")}`
                          : project.tagline}
                      </p>
                      {project.unreadInsights ? (
                        <span className="shrink-0 w-5 h-5 rounded-full bg-[#0084ff] text-white text-[11px] font-semibold flex items-center justify-center">
                          {project.unreadInsights}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>

                {/* Quick Archive / Restore Button (projects:update permission required) */}
                {canUpdateProject && (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateBusinessStatus(
                        project.id,
                        isArchived ? "active" : "archived"
                      )
                    }
                    aria-label={
                      isArchived
                        ? `Restore ${project.name}`
                        : `Archive ${project.name}`
                    }
                    title={isArchived ? "Unarchive" : "Archive"}
                    className="inline-flex md:hidden md:group-hover:inline-flex focus-visible:inline-flex p-2 md:p-1.5 rounded-full bg-white dark:bg-[#111b21] text-[#65676b] dark:text-[#8696a0] hover:text-[#050505] dark:hover:text-white shadow-xs border border-[#e4e6eb] dark:border-[#222d34] shrink-0 md:absolute md:right-2.5 md:top-1/2 md:-translate-y-1/2 cursor-pointer"
                  >
                    {isArchived ? (
                      <ArchiveRestore className="w-4 h-4" />
                    ) : (
                      <Archive className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Shared Sidebar Pagination Bar */}
      {filteredProjects.length > 0 && (
        <div className="px-3 pb-2 border-t border-[#e4e6eb] dark:border-[#222d34] bg-white dark:bg-[#111b21]">
          <PaginationBar
            variant="compact"
            meta={sidebarPagination.meta}
            pageSizeOptions={sidebarPagination.pageSizeOptions}
            onPageChange={sidebarPagination.setPage}
            onPageSizeChange={sidebarPagination.setPageSize}
            itemLabel="projects"
            ariaLabel="Sidebar projects pagination"
            hideWhenSinglePage={filteredProjects.length <= COMPACT_PAGE_SIZE_OPTIONS[0]}
          />
        </div>
      )}

      {/* Authenticated User Profile & RBAC Footer */}
      <div className="px-3.5 py-2.5 border-t border-[#e4e6eb] dark:border-[#222d34] bg-[#f0f2f5]/50 dark:bg-[#202c33]/60 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onOpenTeamRbacModal}
          title="View RBAC permissions & team members"
          className="flex items-center gap-2.5 min-w-0 flex-1 text-left rounded-lg p-1 hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
        >
          <div
            className={`w-8 h-8 rounded-full ${currentUser.avatarColor} text-white font-bold text-[11px] flex items-center justify-center shrink-0`}
          >
            {currentUser.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[#050505] dark:text-[#e9edef] truncate">
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
        </button>

        <button
          type="button"
          onClick={onLogout}
          aria-label="Sign out"
          title="Sign out"
          className="w-8 h-8 rounded-full text-[#65676b] dark:text-[#8696a0] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center shrink-0 transition cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
