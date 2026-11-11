"use client";

import React, { useId, useState } from "react";
import { Archive, ArchiveRestore, Plus, Search, Settings } from "lucide-react";
import {
  BUSINESS_STATUS_META,
  type CryptoProject,
  type ProjectBusinessStatus,
  type SystemHealthStatus,
} from "@/types/project";
import { ProjectAvatar } from "@/components/ProjectAvatar";
import { FilterChip } from "@/components/ui";

interface ProjectSidebarProps {
  projects: CryptoProject[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  onUpdateBusinessStatus: (
    projectId: string,
    status: ProjectBusinessStatus
  ) => void;
  onOpenNewProjectModal: () => void;
  onOpenGlobalSettings: () => void;
  healthStatus?: SystemHealthStatus;
  isMobileHidden?: boolean;
}

type SidebarFilter = "active" | ProjectBusinessStatus;

const FILTER_TABS: { id: SidebarFilter; label: string }[] = [
  { id: "new", label: "New" },
  { id: "active", label: "Active" },
  { id: "contacted", label: "Contacted" },
  { id: "collaborated", label: "Collaborated" },
  { id: "completed", label: "Completed" },
  { id: "unresponsive", label: "Unresponsive" },
  { id: "archived", label: "Archived" },
];

export function ProjectSidebar({
  projects,
  selectedProjectId,
  onSelectProject,
  onUpdateBusinessStatus,
  onOpenNewProjectModal,
  onOpenGlobalSettings,
  healthStatus,
  isMobileHidden = false,
}: ProjectSidebarProps) {
  const searchInputId = useId();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<SidebarFilter>("active");

  const countByStatus = (status: SidebarFilter) => {
    if (status === "active") {
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

      if (activeFilter === "active") {
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
            <button
              type="button"
              onClick={onOpenGlobalSettings}
              aria-label="Global settings for system prompts and checklist"
              title="Global Settings (Prompts & Checklist)"
              className="w-10 h-10 sm:w-9 sm:h-9 rounded-full bg-[#f0f2f5] hover:bg-[#e4e6eb] dark:bg-[#202c33] dark:hover:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] flex items-center justify-center transition cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onOpenNewProjectModal}
              aria-label="New project"
              title="New project"
              className="w-10 h-10 sm:w-9 sm:h-9 rounded-full bg-[#f0f2f5] hover:bg-[#e4e6eb] dark:bg-[#202c33] dark:hover:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] flex items-center justify-center transition cursor-pointer"
            >
              <Plus className="w-5 h-5" />
            </button>
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
              {activeFilter === "active"
                ? "Active"
                : BUSINESS_STATUS_META[activeFilter].label}
              .
            </p>
          </div>
        ) : (
          filteredProjects.map((project) => {
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

                {/* Quick Archive / Restore Button */}
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBusinessStatus(
                      project.id,
                      isArchived ? "new" : "archived"
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
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
