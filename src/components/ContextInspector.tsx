"use client";

import React, { useState } from "react";
import {
  CornerDownLeft,
  ExternalLink,
  Plus,
  Trash2,
} from "lucide-react";
import {
  BUSINESS_STATUS_META,
  BUSINESS_STATUS_ORDER,
  type CryptoProject,
  type ProjectBusinessStatus,
  type ProjectContextItem,
} from "@/types/project";
import { ProjectAvatar } from "@/components/ProjectAvatar";
import { ContextTypeIcon, FilterChip } from "@/components/ui";

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
      aria-label="Project info and contexts"
      className="w-80 lg:w-88 shrink-0 h-full border-l border-[#e4e6eb] dark:border-[#222d34] bg-white dark:bg-[#111b21] flex flex-col overflow-y-auto scroller"
    >
      {/* Messenger / WhatsApp Contact Info Profile Header */}
      <div className="px-4 pt-5 pb-4 border-b border-[#e4e6eb] dark:border-[#222d34] flex flex-col items-center text-center">
        <ProjectAvatar
          project={project}
          size="xl"
          onEditClick={onOpenEditLogoModal}
          decorative={false}
        />

        <button
          type="button"
          onClick={onOpenEditLogoModal}
          className="mt-2 text-xs font-medium text-[#0084ff] hover:underline cursor-pointer"
        >
          {project.logoUrl ? "Change photo" : "Add photo"}
        </button>

        <h2 className="mt-1.5 font-bold text-base text-[#050505] dark:text-[#e9edef]">
          {project.name}
        </h2>
        <p className="text-xs text-[#65676b] dark:text-[#8696a0]">
          {project.ticker} · {project.chain} · {project.stage}
        </p>

        {/* Business State Selector Grid */}
        <div className="w-full mt-3.5 pt-3 border-t border-[#e4e6eb] dark:border-[#222d34] text-left">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-[#65676b] dark:text-[#8696a0]">
              Status
            </span>
            <span className="text-xs font-medium text-[#050505] dark:text-[#e9edef]">
              {BUSINESS_STATUS_META[project.businessStatus].label}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {BUSINESS_STATUS_ORDER.map((statusKey) => {
              const meta = BUSINESS_STATUS_META[statusKey];
              const isSelected = project.businessStatus === statusKey;
              return (
                <button
                  key={statusKey}
                  type="button"
                  onClick={() => onUpdateBusinessStatus(statusKey)}
                  title={meta.description}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                    isSelected
                      ? "bg-[#e7f3ff] text-[#0084ff] dark:bg-[#0084ff]/20 dark:text-[#4599ff] font-semibold"
                      : "bg-[#f0f2f5] dark:bg-[#202c33] text-[#65676b] dark:text-[#8696a0] hover:bg-[#e4e6eb] dark:hover:bg-[#2a3942]"
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
      </div>

      {/* Project Contexts Section */}
      <div className="px-4 py-3 border-b border-[#e4e6eb] dark:border-[#222d34]">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-[13px] font-semibold text-[#050505] dark:text-[#e9edef]">
            Context ({activeCount}/{project.contexts.length})
          </h3>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => onToggleAllContexts(!allEnabled)}
              className="text-xs font-medium text-[#65676b] dark:text-[#8696a0] hover:text-[#050505] dark:hover:text-white transition cursor-pointer"
            >
              {allEnabled ? "Mute all" : "Enable all"}
            </button>
            <button
              type="button"
              onClick={onOpenAddContextModal}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0084ff] hover:underline cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </div>

        {/* Filter Chips: All / Links / Notes */}
        <div className="flex items-center gap-1.5">
          {(
            [
              { id: "all", label: "All" },
              { id: "links", label: "Links" },
              { id: "messages", label: "Notes" },
            ] as const
          ).map((tab) => (
            <FilterChip
              key={tab.id}
              active={filterTab === tab.id}
              onClick={() => setFilterTab(tab.id)}
              className="py-1"
            >
              {tab.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Context Items List */}
      <div className="flex-1 divide-y divide-[#e4e6eb] dark:divide-[#222d34]">
        {filteredContexts.length === 0 ? (
          <div className="text-center py-10 px-4">
            <p className="text-xs text-[#65676b] dark:text-[#8696a0]">
              No items in this view.
            </p>
            <button
              type="button"
              onClick={onOpenAddContextModal}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#0084ff] hover:underline cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add link or note
            </button>
          </div>
        ) : (
          filteredContexts.map((ctx) => (
            <div
              key={ctx.id}
              className={`px-4 py-3 transition ${
                ctx.isActive ? "" : "opacity-55"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Circular Icon */}
                <div className="w-9 h-9 rounded-full bg-[#f0f2f5] dark:bg-[#202c33] flex items-center justify-center shrink-0 mt-0.5">
                  <ContextTypeIcon type={ctx.type} variant="md" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-[13px] font-semibold text-[#050505] dark:text-[#e9edef] truncate">
                      {ctx.title}
                    </h4>

                    <label className="inline-flex items-center gap-1.5 text-[11px] text-[#65676b] dark:text-[#8696a0] cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={ctx.isActive}
                        onChange={() => onToggleContext(ctx.id)}
                        className="rounded cursor-pointer"
                      />
                      <span>{ctx.isActive ? "Active" : "Off"}</span>
                    </label>
                  </div>

                  {ctx.url ? (
                    <a
                      href={ctx.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 text-xs text-[#0084ff] hover:underline break-all"
                    >
                      <span>{ctx.value}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ) : (
                    <p className="mt-1 text-xs text-[#050505] dark:text-[#d1d7db] bg-[#f0f2f5] dark:bg-[#202c33] rounded-lg px-2.5 py-1.5 leading-relaxed">
                      {ctx.value}
                    </p>
                  )}

                  {ctx.summary && (
                    <details className="mt-1 text-[11px] text-[#65676b] dark:text-[#8696a0]">
                      <summary className="cursor-pointer select-none hover:text-[#050505] dark:hover:text-[#e9edef]">
                        Context note
                      </summary>
                      <p className="mt-1 pl-2 border-l border-[#e4e6eb] dark:border-[#2a3942]">
                        {ctx.summary}
                      </p>
                    </details>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    <button
                      type="button"
                      onClick={() => onReferenceInPrompt(ctx)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0084ff] hover:underline cursor-pointer"
                    >
                      <CornerDownLeft className="w-3 h-3" />
                      <span>Use in chat</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteContext(ctx.id)}
                      title="Delete context"
                      aria-label={`Delete ${ctx.title}`}
                      className="p-1 rounded text-[#65676b] hover:text-rose-600 dark:text-[#8696a0] dark:hover:text-rose-400 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
