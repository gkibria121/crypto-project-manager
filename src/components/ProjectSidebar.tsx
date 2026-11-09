"use client";

import React, { useId, useState } from "react";
import {
  BUSINESS_STATUS_META,
  CryptoProject,
  ProjectBusinessStatus,
} from "@/types/project";
import { ProjectAvatar } from "@/components/ProjectAvatar";
import { Search, Plus, Archive, ArchiveRestore, Settings } from "lucide-react";

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
}

type SidebarFilter = "active" | ProjectBusinessStatus;

export function ProjectSidebar({
  projects,
  selectedProjectId,
  onSelectProject,
  onUpdateBusinessStatus,
  onOpenNewProjectModal,
  onOpenGlobalSettings,
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

  const STATUS_SORT_PRIORITY: Record<ProjectBusinessStatus, number> = {
    new: 0,
    contacted: 1,
    collaborated: 2,
    completed: 3,
    unresponsive: 4,
    archived: 5,
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
        STATUS_SORT_PRIORITY[a.businessStatus] -
        STATUS_SORT_PRIORITY[b.businessStatus]
    );

  const filterTabs: { id: SidebarFilter; label: string }[] = [
    { id: "new", label: "New" },
    { id: "active", label: "Active" },
    { id: "contacted", label: "Contacted" },
    { id: "collaborated", label: "Collaborated" },
    { id: "completed", label: "Completed" },
    { id: "unresponsive", label: "Unresponsive" },
    { id: "archived", label: "Archived" },
  ];

  return (
    <aside
      aria-label="Projects"
      className="w-80 lg:w-90 shrink-0 h-full border-r border-[#e4e6eb] dark:border-[#222d34] bg-white dark:bg-[#111b21] flex flex-col"
    >
      {/* WhatsApp / Messenger Top Header */}
      <div className="px-4 pt-3.5 pb-2.5">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold tracking-tight text-[#050505] dark:text-[#e9edef]">
            Projects
          </h1>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenGlobalSettings}
              aria-label="Global settings for system prompts and checklist"
              title="Global Settings (Prompts & Checklist)"
              className="w-9 h-9 rounded-full bg-[#f0f2f5] hover:bg-[#e4e6eb] dark:bg-[#202c33] dark:hover:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] flex items-center justify-center transition cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onOpenNewProjectModal}
              aria-label="New project"
              title="New project"
              className="w-9 h-9 rounded-full bg-[#f0f2f5] hover:bg-[#e4e6eb] dark:bg-[#202c33] dark:hover:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] flex items-center justify-center transition cursor-pointer"
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
            className="w-full pl-9 pr-3.5 py-2 text-[14px] rounded-full bg-[#f0f2f5] dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] placeholder:text-[#65676b] dark:placeholder:text-[#8696a0] outline-none"
          />
        </div>

        {/* Messenger / WhatsApp Filter Chips */}
        <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto scroller pb-1">
          {filterTabs.map((tab) => {
            const isActive = activeFilter === tab.id;
            const count = countByStatus(tab.id);

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? "bg-[#e7f3ff] text-[#0084ff] dark:bg-[#0084ff]/20 dark:text-[#4599ff]"
                    : "bg-[#f0f2f5] text-[#65676b] hover:bg-[#e4e6eb] dark:bg-[#202c33] dark:text-[#8696a0] dark:hover:bg-[#2a3942]"
                }`}
              >
                <span>{tab.label}</span>
                {count > 0 && (
                  <span className="text-[11px] opacity-80">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto scroller px-2 py-1">
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
                className={`w-full rounded-xl transition flex items-center gap-3 px-2.5 py-2.5 group relative ${
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
                      <span className="text-xs text-[#65676b] dark:text-[#8696a0] shrink-0 group-hover:hidden">
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

                {/* Hover Quick Archive / Restore Button */}
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
                  className="hidden group-hover:inline-flex focus-visible:inline-flex p-1.5 rounded-full bg-white dark:bg-[#111b21] text-[#65676b] dark:text-[#8696a0] hover:text-[#050505] dark:hover:text-white shadow-xs border border-[#e4e6eb] dark:border-[#222d34] absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
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
