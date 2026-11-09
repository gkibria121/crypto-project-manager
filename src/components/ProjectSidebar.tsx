"use client";

import React, { useId, useState } from "react";
import {
  BUSINESS_STATUS_META,
  CryptoProject,
  ProjectBusinessStatus,
} from "@/types/project";
import { ProjectAvatar } from "@/components/ProjectAvatar";
import {
  Search,
  Plus,
  Pin,
  Sparkles,
  Layers,
  TrendingUp,
  CheckCircle2,
  Archive,
  ArchiveRestore,
} from "lucide-react";

interface ProjectSidebarProps {
  projects: CryptoProject[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  onUpdateBusinessStatus: (
    projectId: string,
    status: ProjectBusinessStatus
  ) => void;
  onOpenNewProjectModal: () => void;
}

type SidebarFilter = "active" | ProjectBusinessStatus;

export function ProjectSidebar({
  projects,
  selectedProjectId,
  onSelectProject,
  onUpdateBusinessStatus,
  onOpenNewProjectModal,
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

      // Initial state in the chat list is "active" (all non-archived projects)
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
      aria-label="Crypto Projects"
      className="w-80 lg:w-92 shrink-0 h-full border-r border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl flex flex-col"
    >
      {/* Messenger-style Top Agency Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-base tracking-tight text-slate-900 dark:text-white">
                  PulseOS
                </h1>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  Agency CRM
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {countByStatus("active")} Active •{" "}
                {countByStatus("collaborated")} Collaborated
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenNewProjectModal}
            title="Add New Crypto Project"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>

        {/* Search Input with Accessible Label */}
        <div className="relative">
          <label htmlFor={searchInputId} className="sr-only">
            Search crypto projects by name, ticker, or chain
          </label>
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
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
            placeholder="Search projects, $TICKER, or chain..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-900/90 border border-transparent focus:border-indigo-500/60 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none transition"
          />
        </div>

        {/* Business State Filter Pills */}
        <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto scroller pb-1">
          {filterTabs.map((tab) => {
            const isActive = activeFilter === tab.id;
            const count = countByStatus(tab.id);
            const dotClass =
              tab.id !== "active" ? BUSINESS_STATUS_META[tab.id].dotClass : "";

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-xs"
                    : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800"
                }`}
              >
                {dotClass && (
                  <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                )}
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1 rounded-full ${
                    isActive
                      ? "bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-950"
                      : "bg-slate-200/80 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Messenger-style Project Thread List */}
      <div className="flex-1 overflow-y-auto scroller p-2 space-y-1">
        {filteredProjects.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              No projects in the{" "}
              <strong>
                {activeFilter === "active"
                  ? "Active"
                  : BUSINESS_STATUS_META[activeFilter].label}
              </strong>{" "}
              category.
            </p>
          </div>
        ) : (
          filteredProjects.map((project) => {
            const isSelected = project.id === selectedProjectId;
            const activeContextsCount = project.contexts.filter(
              (c) => c.isActive
            ).length;
            const lastMsg = project.messages[project.messages.length - 1];
            const statusMeta = BUSINESS_STATUS_META[project.businessStatus];
            const isArchived = project.businessStatus === "archived";

            return (
              <div
                key={project.id}
                className={`w-full rounded-2xl transition flex items-start gap-3 p-2.5 group relative ${
                  isSelected
                    ? "bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-500/30 shadow-xs"
                    : "hover:bg-slate-100/80 dark:hover:bg-slate-900/60 border border-transparent"
                } ${isArchived ? "opacity-75" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => onSelectProject(project.id)}
                  className="flex items-start gap-3 flex-1 min-w-0 text-left cursor-pointer"
                >
                  {/* Project Avatar with Business Status Dot */}
                  <ProjectAvatar
                    project={project}
                    size="lg"
                    showOnlineDot
                    decorative
                  />

                  {/* Project Info & Last Message Preview */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`text-sm font-semibold truncate ${
                            isSelected
                              ? "text-indigo-950 dark:text-white"
                              : "text-slate-900 dark:text-slate-100"
                          }`}
                        >
                          {project.name}
                        </span>
                        {project.isPinned && !isArchived && (
                          <Pin className="w-3 h-3 text-indigo-500 shrink-0 rotate-45" />
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0 group-hover:hidden">
                        {project.lastActivityTime}
                      </span>
                    </div>

                    {/* Business State Badge & Ticker Row */}
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md border font-semibold ${statusMeta.badgeClass}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`}
                        />
                        {statusMeta.shortLabel}
                      </span>
                      <span className="text-[10px] font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                        {project.ticker}
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium ml-auto">
                        <Layers className="w-2.5 h-2.5" />
                        {activeContextsCount}/{project.contexts.length} ctx
                      </span>
                    </div>

                    {/* Last Message / Tagline Snippet */}
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {lastMsg
                          ? `${lastMsg.sender === "admin" ? "You: " : "AI: "}${lastMsg.content.replace(/[#*>`]/g, "")}`
                          : project.tagline}
                      </p>
                      {project.unreadInsights ? (
                        <span className="shrink-0 w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
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
                      ? `Restore ${project.name} from archive`
                      : `Archive ${project.name}`
                  }
                  title={
                    isArchived
                      ? "Restore project to New"
                      : "Archive project"
                  }
                  className="hidden group-hover:inline-flex focus-visible:inline-flex p-1.5 rounded-lg bg-white/90 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-xs border border-slate-200/70 dark:border-slate-700 absolute top-2 right-2 cursor-pointer"
                >
                  {isArchived ? (
                    <ArchiveRestore className="w-3.5 h-3.5" />
                  ) : (
                    <Archive className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Agency Admin Footer */}
      <div className="p-3 border-t border-slate-200/70 dark:border-slate-800/70 bg-slate-50/60 dark:bg-slate-900/40 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-800 to-slate-600 dark:from-slate-700 dark:to-slate-500 text-white flex items-center justify-center text-xs font-bold">
            CM
          </div>
          <div>
            <div className="flex items-center gap-1">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Crypto Marketing Lead
              </p>
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              Context-RAG Engine Online
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
