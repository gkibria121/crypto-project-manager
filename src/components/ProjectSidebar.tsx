"use client";

import React, { useId, useState } from "react";
import { CryptoProject } from "@/types/project";
import { ProjectAvatar } from "@/components/ProjectAvatar";
import {
  Search,
  Plus,
  Pin,
  Sparkles,
  Layers,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";

interface ProjectSidebarProps {
  projects: CryptoProject[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  onOpenNewProjectModal: () => void;
}

export function ProjectSidebar({
  projects,
  selectedProjectId,
  onSelectProject,
  onOpenNewProjectModal,
}: ProjectSidebarProps) {
  const searchInputId = useId();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<
    "all" | "pinned" | "Pre-TGE" | "Mainnet Live"
  >("all");

  const filteredProjects = projects.filter((project) => {
    const matchesQuery =
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.chain.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesQuery) return false;
    if (activeFilter === "pinned") return Boolean(project.isPinned);
    if (activeFilter === "Pre-TGE") return project.stage === "Pre-TGE";
    if (activeFilter === "Mainnet Live") return project.stage === "Mainnet Live";
    return true;
  });

  return (
    <aside
      aria-label="Crypto Projects"
      className="w-80 lg:w-88 shrink-0 h-full border-r border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl flex flex-col"
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
                  Agency AI
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {projects.length} Managed Web3 Clients
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

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto no-scrollbar">
          {(
            [
              { id: "all", label: "All Clients" },
              { id: "pinned", label: "Pinned" },
              { id: "Pre-TGE", label: "Pre-TGE" },
              { id: "Mainnet Live", label: "Mainnet" },
            ] as const
          ).map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-xs"
                    : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800"
                }`}
              >
                {tab.label}
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
              No matching crypto projects found.
            </p>
          </div>
        ) : (
          filteredProjects.map((project) => {
            const isSelected = project.id === selectedProjectId;
            const activeContextsCount = project.contexts.filter(
              (c) => c.isActive
            ).length;
            const lastMsg = project.messages[project.messages.length - 1];

            return (
              <button
                key={project.id}
                type="button"
                onClick={() => onSelectProject(project.id)}
                className={`w-full text-left p-2.5 rounded-2xl transition flex items-start gap-3 group cursor-pointer relative ${
                  isSelected
                    ? "bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-500/30 shadow-xs"
                    : "hover:bg-slate-100/80 dark:hover:bg-slate-900/60 border border-transparent"
                }`}
              >
                {/* Project Avatar with Online/Campaign Dot */}
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
                      {project.isPinned && (
                        <Pin className="w-3 h-3 text-indigo-500 shrink-0 rotate-45" />
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                      {project.lastActivityTime}
                    </span>
                  </div>

                  {/* Stage & Active Contexts Row */}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                      {project.ticker}
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                      {project.stage}
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
