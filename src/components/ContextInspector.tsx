"use client";

import React, { useState } from "react";
import {
  BUSINESS_STATUS_META,
  CryptoProject,
  ProjectBusinessStatus,
  ProjectContextItem,
} from "@/types/project";
import { ProjectAvatar } from "@/components/ProjectAvatar";
import {
  Globe,
  AtSign,
  Briefcase,
  MessageSquareText,
  Plus,
  ExternalLink,
  Trash2,
  CornerDownLeft,
  CheckCircle2,
  Circle,
  SendHorizontal,
  Sparkles,
  Layers,
  Camera,
} from "lucide-react";

interface ContextInspectorProps {
  project: CryptoProject;
  onUpdateBusinessStatus: (status: ProjectBusinessStatus) => void;
  onToggleContext: (contextId: string) => void;
  onToggleAllContexts: (enable: boolean) => void;
  onDeleteContext: (contextId: string) => void;
  onReferenceInPrompt: (ctx: ProjectContextItem) => void;
  onOpenAddContextModal: () => void;
  onOpenEditLogoModal: () => void;
}

function getContextTypeMeta(type: ProjectContextItem["type"]) {
  switch (type) {
    case "website":
      return {
        label: "Website",
        icon: <Globe className="w-3.5 h-3.5 text-sky-500" />,
        badgeClass:
          "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
      };
    case "x_handle":
      return {
        label: "X / Twitter",
        icon: <AtSign className="w-3.5 h-3.5 text-slate-900 dark:text-white" />,
        badgeClass:
          "bg-slate-500/10 text-slate-700 dark:text-slate-200 border-slate-500/20",
      };
    case "linkedin":
      return {
        label: "LinkedIn",
        icon: <Briefcase className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />,
        badgeClass:
          "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      };
    case "telegram":
      return {
        label: "Telegram",
        icon: <SendHorizontal className="w-3.5 h-3.5 text-cyan-500" />,
        badgeClass:
          "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
      };
    case "message":
      return {
        label: "Context Note",
        icon: <MessageSquareText className="w-3.5 h-3.5 text-amber-500" />,
        badgeClass:
          "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      };
  }
}

export function ContextInspector({
  project,
  onUpdateBusinessStatus,
  onToggleContext,
  onToggleAllContexts,
  onDeleteContext,
  onReferenceInPrompt,
  onOpenAddContextModal,
  onOpenEditLogoModal,
}: ContextInspectorProps) {
  const [filterTab, setFilterTab] = useState<"all" | "links" | "messages">(
    "all"
  );

  const activeCount = project.contexts.filter((c) => c.isActive).length;
  const allEnabled =
    project.contexts.length > 0 && activeCount === project.contexts.length;

  const filteredContexts = project.contexts.filter((ctx) => {
    if (filterTab === "links") return ctx.type !== "message";
    if (filterTab === "messages") return ctx.type === "message";
    return true;
  });

  return (
    <aside
      aria-label="Project Contexts & Links"
      className="w-84 lg:w-92 shrink-0 h-full border-l border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl flex flex-col"
    >
      {/* Messenger-style Right Profile Card */}
      <div className="p-4 border-b border-slate-200/70 dark:border-slate-800/70 flex flex-col items-center text-center">
        <div className="mb-2">
          <ProjectAvatar
            project={project}
            size="xl"
            onEditClick={onOpenEditLogoModal}
            decorative={false}
          />
        </div>

        <button
          type="button"
          onClick={onOpenEditLogoModal}
          className="inline-flex items-center gap-1 px-2 py-0.5 mb-1.5 rounded-full text-[10px] font-semibold bg-slate-100 hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-indigo-950/70 text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 border border-slate-200/70 dark:border-slate-800 transition cursor-pointer"
        >
          <Camera className="w-3 h-3" />
          <span>{project.logoUrl ? "Change Project Logo" : "Add Project Logo"}</span>
        </button>

        <h2 className="font-bold text-sm text-slate-900 dark:text-white">
          {project.name}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
          {project.tagline}
        </p>

        {/* Business State CRM Pipeline Pills */}
        <div className="w-full mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/60 text-left">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Business State
            </span>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
              {BUSINESS_STATUS_META[project.businessStatus].label}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {(
              [
                "new",
                "contacted",
                "collaborated",
                "completed",
                "unresponsive",
                "archived",
              ] as const
            ).map((statusKey) => {
              const meta = BUSINESS_STATUS_META[statusKey];
              const isSelected = project.businessStatus === statusKey;
              return (
                <button
                  key={statusKey}
                  type="button"
                  onClick={() => onUpdateBusinessStatus(statusKey)}
                  title={meta.description}
                  className={`flex items-center justify-center gap-1 py-1 px-1.5 rounded-lg text-[10px] font-semibold border transition cursor-pointer ${
                    isSelected
                      ? meta.badgeClass
                      : "bg-slate-100/70 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-200/60 dark:hover:bg-slate-800"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dotClass}`}
                  />
                  <span className="truncate">{meta.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Social & Web Link Pills */}
        <div className="flex items-center justify-center gap-1.5 mt-3 flex-wrap">
          {project.contexts
            .filter((c) => c.url)
            .map((linkCtx) => {
              const meta = getContextTypeMeta(linkCtx.type);
              return (
                <a
                  key={linkCtx.id}
                  href={linkCtx.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${linkCtx.title}: ${linkCtx.value}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
                >
                  {meta.icon}
                  <span>{meta.label}</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                </a>
              );
            })}
        </div>
      </div>

      {/* Context Memory Header & Filter Controls */}
      <div className="px-4 pt-3.5 pb-2.5 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Project Contexts
            </h3>
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              {activeCount}/{project.contexts.length} Active
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onToggleAllContexts(!allEnabled)}
              className="text-[11px] font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition cursor-pointer"
            >
              {allEnabled ? "Mute All" : "Enable All"}
            </button>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <button
              type="button"
              onClick={onOpenAddContextModal}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>
        </div>

        {/* Filter Tabs: All / Links / Notes */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900">
          {(
            [
              { id: "all", label: `All (${project.contexts.length})` },
              {
                id: "links",
                label: `Links (${project.contexts.filter((c) => c.type !== "message").length})`,
              },
              {
                id: "messages",
                label: `Notes (${project.contexts.filter((c) => c.type === "message").length})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id)}
              className={`py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                filterTab === tab.id
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Context Cards */}
      <div className="flex-1 overflow-y-auto scroller p-3 space-y-2.5">
        {filteredContexts.length === 0 ? (
          <div className="text-center py-10 px-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              No contexts in this category yet.
            </p>
            <button
              type="button"
              onClick={onOpenAddContextModal}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Website, X, LinkedIn, or Note
            </button>
          </div>
        ) : (
          filteredContexts.map((ctx) => {
            const meta = getContextTypeMeta(ctx.type);
            return (
              <div
                key={ctx.id}
                className={`rounded-2xl p-3 border transition ${
                  ctx.isActive
                    ? "bg-white dark:bg-slate-900/90 border-indigo-500/30 shadow-2xs"
                    : "bg-slate-50/70 dark:bg-slate-900/30 border-slate-200/60 dark:border-slate-800/60 opacity-70"
                }`}
              >
                {/* Top Row: Type Badge + Active Toggle */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${meta.badgeClass}`}
                  >
                    {meta.icon}
                    <span>{meta.label}</span>
                  </span>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400">
                      {ctx.updatedAt}
                    </span>
                    <button
                      type="button"
                      onClick={() => onToggleContext(ctx.id)}
                      title={
                        ctx.isActive
                          ? "Active in AI Prompt (Click to mute)"
                          : "Muted (Click to include in AI Prompt)"
                      }
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition cursor-pointer ${
                        ctx.isActive
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                          : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                      }`}
                    >
                      {ctx.isActive ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>In AI</span>
                        </>
                      ) : (
                        <>
                          <Circle className="w-3 h-3" />
                          <span>Muted</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Context Title */}
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {ctx.title}
                </h4>

                {/* Context Link or Message Value */}
                {ctx.url ? (
                  <a
                    href={ctx.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs font-mono text-indigo-600 dark:text-indigo-400 hover:underline break-all"
                  >
                    <span>{ctx.value}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                ) : (
                  <p className="mt-1 text-xs text-slate-700 dark:text-slate-200 bg-amber-500/5 border border-amber-500/15 rounded-xl p-2 leading-relaxed">
                    “{ctx.value}”
                  </p>
                )}

                {/* AI Digest / Summary */}
                {ctx.summary && (
                  <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    {ctx.summary}
                  </p>
                )}

                {/* Card Footer Actions */}
                <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => onReferenceInPrompt(ctx)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition cursor-pointer"
                  >
                    <CornerDownLeft className="w-3 h-3" />
                    <span>Ask AI with this context</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteContext(ctx.id)}
                    title="Remove Context"
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Add Context CTA */}
      <div className="p-3 border-t border-slate-200/70 dark:border-slate-800/70 bg-slate-50/60 dark:bg-slate-900/40">
        <button
          type="button"
          onClick={onOpenAddContextModal}
          className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Add Link or Campaign Context</span>
        </button>
      </div>
    </aside>
  );
}
