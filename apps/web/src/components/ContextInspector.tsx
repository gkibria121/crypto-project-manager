"use client";

import React, { useState } from "react";
import {
  ArrowLeft,
  CornerDownLeft,
  Database,
  ExternalLink,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import {
  type AuthUser,
  BUSINESS_STATUS_META,
  BUSINESS_STATUS_ORDER,
  COMPACT_PAGE_SIZE_OPTIONS,
  type CryptoProject,
  SPECIALIZED_SCRAPER_PROVIDER_META,
  detectSpecializedProvider,
  getProjectPlatformRanksList,
  hasPermission,
  type ProjectBusinessStatus,
  type ProjectContextItem,
  type ScraperProviderStatus,
} from "@/types/project";
import { ProjectAvatar } from "@/components/ProjectAvatar";
import {
  ContextTypeIcon,
  FilterChip,
  PaginationBar,
  PlatformRankBadges,
} from "@/components/ui";
import { usePagination } from "@/hooks/usePagination";

interface ContextInspectorProps {
  project: CryptoProject;
  currentUser: AuthUser;
  providerStatuses?: ScraperProviderStatus[];
  onUpdateBusinessStatus: (status: ProjectBusinessStatus) => void;
  onDeleteProject?: () => void;
  onToggleContext: (contextId: string) => void;
  onToggleAllContexts: (enable: boolean) => void;
  onDeleteContext: (contextId: string) => void;
  onScrapeContext?: (ctx: ProjectContextItem) => void;
  onScrapeAllContexts?: () => void;
  onViewScrapedData?: (ctx: ProjectContextItem | null) => void;
  scrapingContextId?: string | null;
  isScrapingAll?: boolean;
  onReferenceInPrompt: (ctx: ProjectContextItem) => void;
  onOpenAddContextModal: () => void;
  onOpenEditLogoModal: () => void;
  onOpenEditProjectModal?: () => void;
  isDesktopOpen?: boolean;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function ContextInspector({
  project,
  currentUser,
  providerStatuses = [],
  onUpdateBusinessStatus,
  onDeleteProject,
  onToggleContext,
  onToggleAllContexts,
  onDeleteContext,
  onScrapeContext,
  onScrapeAllContexts,
  onViewScrapedData,
  scrapingContextId = null,
  isScrapingAll = false,
  onReferenceInPrompt,
  onOpenAddContextModal,
  onOpenEditLogoModal,
  onOpenEditProjectModal,
  isDesktopOpen = true,
  isMobileOpen = false,
  onCloseMobile,
}: ContextInspectorProps) {
  const canUpdateProject = hasPermission(currentUser, "projects:update");
  const canDeleteProject = hasPermission(currentUser, "projects:delete");
  const canWriteContexts = hasPermission(currentUser, "contexts:write");
  const canTriggerScraper = hasPermission(currentUser, "scraper:trigger");
  const canWriteChat = hasPermission(currentUser, "chat:write");

  const [filterTab, setFilterTab] = useState<"all" | "links" | "messages">(
    "all"
  );

  const activeCount = project.contexts.filter((c) => c.isActive).length;
  const allEnabled =
    project.contexts.length > 0 && activeCount === project.contexts.length;
  const providerStatusMap = new Map(
    providerStatuses.map((s) => [s.provider, s])
  );
  const hasAnyScrapedData = project.contexts.some(
    (c) => Boolean(c.lastScrapedAt || c.scrapedMetadata || c.scrapeStatus)
  );

  const filteredContexts = project.contexts.filter((ctx) => {
    if (filterTab === "links") return ctx.type !== "message";
    if (filterTab === "messages") return ctx.type === "message";
    return true;
  });

  const contextsPagination = usePagination(filteredContexts, {
    initialPageSize: 6,
    pageSizeOptions: COMPACT_PAGE_SIZE_OPTIONS,
    resetKey: `${project.id}:${filterTab}`,
  });

  const inspectorContent = (
    <>
      {/* Mobile / Tablet Sticky Drawer Top Bar (< xl) */}
      <div className="xl:hidden sticky top-0 z-10 px-4 py-3 bg-white/95 dark:bg-[#111b21]/95 backdrop-blur-xs border-b border-[#e4e6eb] dark:border-[#222d34] flex items-center justify-between gap-2 shrink-0">
        <button
          type="button"
          onClick={onCloseMobile}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0084ff] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to chat</span>
        </button>

        <span className="text-xs font-semibold text-[#65676b] dark:text-[#8696a0]">
          Project Info & Contexts
        </span>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close project info panel"
          className="w-8 h-8 rounded-full text-[#65676b] dark:text-[#8696a0] hover:bg-[#f0f2f5] dark:hover:bg-[#202c33] flex items-center justify-center transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messenger / WhatsApp Contact Info Profile Header */}
      <div className="px-4 pt-5 pb-4 border-b border-[#e4e6eb] dark:border-[#222d34] flex flex-col items-center text-center">
        <ProjectAvatar
          project={project}
          size="xl"
          onEditClick={canUpdateProject ? onOpenEditLogoModal : undefined}
          decorative={false}
        />

        {canUpdateProject && (
          <div className="mt-2 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onOpenEditLogoModal}
              className="text-xs font-medium text-[#0084ff] hover:underline cursor-pointer"
            >
              {project.logoUrl ? "Change photo" : "Add photo"}
            </button>
            {onOpenEditProjectModal && (
              <>
                <span
                  aria-hidden="true"
                  className="text-xs text-[#65676b] dark:text-[#8696a0]"
                >
                  ·
                </span>
                <button
                  type="button"
                  onClick={onOpenEditProjectModal}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#0084ff] hover:underline cursor-pointer"
                >
                  <Pencil className="w-3 h-3" aria-hidden="true" />
                  <span>Edit project</span>
                </button>
              </>
            )}
          </div>
        )}

        <h2 className="mt-1.5 font-bold text-base text-[#050505] dark:text-[#e9edef]">
          {project.name}
        </h2>
        <p className="text-xs text-[#65676b] dark:text-[#8696a0]">
          {project.ticker} · {project.chain} · {project.stage}
        </p>

        {getProjectPlatformRanksList(project).length > 0 && (
          <div className="mt-2.5 flex flex-col items-center gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#65676b] dark:text-[#8696a0]">
              Market Cap Ranks
            </span>
            <div className="flex justify-center">
              <PlatformRankBadges project={project} />
            </div>
          </div>
        )}

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
          <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 gap-1.5 sm:gap-1">
            {BUSINESS_STATUS_ORDER.map((statusKey) => {
              const meta = BUSINESS_STATUS_META[statusKey];
              const isSelected = project.businessStatus === statusKey;
              return (
                <button
                  key={statusKey}
                  type="button"
                  disabled={!canUpdateProject}
                  onClick={() => onUpdateBusinessStatus(statusKey)}
                  title={meta.description}
                  className={`flex items-center justify-center gap-1.5 py-2 sm:py-1.5 px-2 rounded-lg text-[11px] font-medium transition cursor-pointer disabled:opacity-65 disabled:cursor-default ${
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
          {project.businessStatus === "new" && (
            <p className="mt-1.5 text-[10px] text-[#65676b] dark:text-[#8696a0]">
              New project — chatting, scraping, or updating contexts/checklist
              automatically moves it to <strong>Active</strong>.
            </p>
          )}

          {canDeleteProject && onDeleteProject && (
            <div className="mt-3 pt-2.5 border-t border-[#e4e6eb] dark:border-[#222d34] flex justify-end">
              <button
                type="button"
                onClick={onDeleteProject}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete Project Workspace</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Project Contexts Section */}
      <div className="px-4 py-3 border-b border-[#e4e6eb] dark:border-[#222d34]">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <h3 className="text-[13px] font-semibold text-[#050505] dark:text-[#e9edef] truncate">
            Context ({activeCount}/{project.contexts.length})
          </h3>

          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {onViewScrapedData && hasAnyScrapedData && (
              <button
                type="button"
                onClick={() => onViewScrapedData(null)}
                title="Show all scraped data stored for this project"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#0084ff] hover:underline cursor-pointer"
              >
                <Database className="w-3 h-3" aria-hidden="true" />
                <span>Scraped data</span>
              </button>
            )}
            {canTriggerScraper &&
              onScrapeAllContexts &&
              project.contexts.length > 0 && (
                <button
                  type="button"
                  onClick={onScrapeAllContexts}
                  disabled={isScrapingAll}
                  title="Configure crawl levels & options and scrape all contexts"
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#00a884] hover:underline disabled:opacity-50 transition cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${isScrapingAll ? "animate-spin" : ""}`}
                  />
                  <span>{isScrapingAll ? "Scraping..." : "Scrape all"}</span>
                </button>
              )}
            {canWriteContexts && (
              <>
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
              </>
            )}
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
      <div className="flex-1 divide-y divide-[#e4e6eb] dark:divide-[#222d34] pb-[max(1rem,env(safe-area-inset-bottom))]">
        {filteredContexts.length === 0 ? (
          <div className="text-center py-10 px-4">
            <p className="text-xs text-[#65676b] dark:text-[#8696a0]">
              No items in this view.
            </p>
            {canWriteContexts && (
              <button
                type="button"
                onClick={onOpenAddContextModal}
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#0084ff] hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add link or note
              </button>
            )}
          </div>
        ) : (
          contextsPagination.items.map((ctx) => {
            const specialized = detectSpecializedProvider(
              ctx.type,
              ctx.url ?? ctx.value
            );
            const providerStatus = specialized
              ? providerStatusMap.get(specialized)
              : undefined;
            const needsApiKey =
              Boolean(specialized) && !(providerStatus?.configured ?? false);
            const hasScrapedData = Boolean(
              ctx.lastScrapedAt ||
                ctx.scrapedMetadata ||
                ctx.scrapeStatus === "completed" ||
                ctx.scrapeStatus === "api_key_required" ||
                ctx.scrapeStatus === "unreachable"
            );
            const pagesCount = ctx.scrapedMetadata?.pagesCount ?? 0;

            return (
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

                      <label
                        className={`inline-flex items-center gap-1.5 text-[11px] text-[#65676b] dark:text-[#8696a0] shrink-0 ${
                          canWriteContexts ? "cursor-pointer" : "cursor-default"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={ctx.isActive}
                          disabled={!canWriteContexts}
                          onChange={() => onToggleContext(ctx.id)}
                          className="checkbox-native rounded cursor-pointer disabled:cursor-default"
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
                      <p className="mt-1 text-xs text-[#050505] dark:text-[#d1d7db] bg-[#f0f2f5] dark:bg-[#202c33] rounded-lg px-2.5 py-1.5 leading-relaxed break-words">
                        {ctx.value}
                      </p>
                    )}

                    {/* Specialized Platform API Key Needed Notice */}
                    {specialized && (
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        {needsApiKey ? (
                          <span
                            title={
                              SPECIALIZED_SCRAPER_PROVIDER_META[specialized]
                                .requiredNotice
                            }
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/12 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 text-[10px] font-semibold"
                          >
                            <KeyRound className="w-2.5 h-2.5" aria-hidden="true" />
                            <span>
                              API key needed (
                              {
                                SPECIALIZED_SCRAPER_PROVIDER_META[specialized]
                                  .envVar
                              }
                              )
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-medium">
                            <KeyRound className="w-2.5 h-2.5" aria-hidden="true" />
                            <span>
                              {
                                SPECIALIZED_SCRAPER_PROVIDER_META[specialized]
                                  .shortLabel
                              }{" "}
                              API ready
                            </span>
                          </span>
                        )}
                      </div>
                    )}

                    {ctx.summary && (
                      <details className="mt-1 text-[11px] text-[#65676b] dark:text-[#8696a0]">
                        <summary className="cursor-pointer select-none hover:text-[#050505] dark:hover:text-[#e9edef] inline-flex items-center gap-1.5">
                          <span>Context note</span>
                          {ctx.scrapeStatus && (
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-medium ${
                                ctx.scrapeStatus === "completed"
                                  ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
                                  : ctx.scrapeStatus === "api_key_required"
                                    ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                                    : ctx.scrapeStatus === "unreachable"
                                      ? "bg-amber-500/12 text-amber-700 dark:text-amber-400"
                                      : ctx.scrapeStatus === "failed"
                                        ? "bg-rose-500/12 text-rose-700 dark:text-rose-400"
                                        : "bg-[#e7f3ff] text-[#0084ff] dark:bg-[#0084ff]/20 dark:text-[#4599ff]"
                              }`}
                            >
                              {ctx.scrapeStatus.replace(/_/g, " ")}
                            </span>
                          )}
                        </summary>
                        <p className="mt-1 pl-2 border-l border-[#e4e6eb] dark:border-[#2a3942]">
                          {ctx.summary}
                        </p>
                        {ctx.scrapedMetadata?.signals &&
                          ctx.scrapedMetadata.signals.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1 pl-2">
                              {ctx.scrapedMetadata.signals.map((signal) => (
                                <span
                                  key={signal}
                                  className="px-1.5 py-0.5 rounded bg-[#f0f2f5] dark:bg-[#202c33] text-[10px] font-mono text-[#050505] dark:text-[#d1d7db]"
                                >
                                  {signal}
                                </span>
                              ))}
                            </div>
                          )}
                      </details>
                    )}

                    {!ctx.summary && ctx.scrapeStatus && (
                      <div className="mt-1">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            ctx.scrapeStatus === "completed"
                              ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
                              : ctx.scrapeStatus === "api_key_required"
                                ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                                : ctx.scrapeStatus === "unreachable"
                                  ? "bg-amber-500/12 text-amber-700 dark:text-amber-400"
                                  : "bg-rose-500/12 text-rose-700 dark:text-rose-400"
                          }`}
                        >
                          Scrape: {ctx.scrapeStatus.replace(/_/g, " ")}
                        </span>
                      </div>
                    )}

                    {(canWriteChat ||
                      canTriggerScraper ||
                      canWriteContexts ||
                      (onViewScrapedData && hasScrapedData)) && (
                      <div className="flex items-center justify-between mt-2 gap-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          {canWriteChat && (
                            <button
                              type="button"
                              onClick={() => onReferenceInPrompt(ctx)}
                              className="inline-flex items-center gap-1 py-1 text-[11px] font-medium text-[#0084ff] hover:underline cursor-pointer"
                            >
                              <CornerDownLeft className="w-3 h-3" />
                              <span>Use in chat</span>
                            </button>
                          )}

                          {canTriggerScraper && onScrapeContext && (
                            <button
                              type="button"
                              onClick={() => onScrapeContext(ctx)}
                              disabled={
                                isScrapingAll || scrapingContextId === ctx.id
                              }
                              title="Configure levels & scraping options and scrape this link"
                              className="inline-flex items-center gap-1 py-1 text-[11px] font-medium text-[#00a884] hover:underline disabled:opacity-50 cursor-pointer"
                            >
                              <RefreshCw
                                className={`w-3 h-3 ${
                                  scrapingContextId === ctx.id
                                    ? "animate-spin"
                                    : ""
                                }`}
                              />
                              <span>
                                {scrapingContextId === ctx.id
                                  ? "Scraping..."
                                  : "Scrape"}
                              </span>
                            </button>
                          )}

                          {onViewScrapedData && hasScrapedData && (
                            <button
                              type="button"
                              onClick={() => onViewScrapedData(ctx)}
                              title="Show scraped data captured from this link"
                              className="inline-flex items-center gap-1 py-1 text-[11px] font-semibold text-[#0084ff] hover:underline cursor-pointer"
                            >
                              <Database className="w-3 h-3" aria-hidden="true" />
                              <span>
                                Show scraped data
                                {pagesCount > 0 ? ` (${pagesCount})` : ""}
                              </span>
                            </button>
                          )}
                        </div>

                        {canWriteContexts && (
                          <button
                            type="button"
                            onClick={() => onDeleteContext(ctx.id)}
                            title="Delete context"
                            aria-label={`Delete ${ctx.title}`}
                            className="p-1.5 rounded text-[#65676b] hover:text-rose-600 dark:text-[#8696a0] dark:hover:text-rose-400 transition cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {filteredContexts.length > 0 && (
        <div className="px-4 pb-3 border-t border-[#e4e6eb] dark:border-[#222d34] shrink-0">
          <PaginationBar
            variant="compact"
            meta={contextsPagination.meta}
            pageSizeOptions={contextsPagination.pageSizeOptions}
            onPageChange={contextsPagination.setPage}
            onPageSizeChange={contextsPagination.setPageSize}
            itemLabel="contexts"
            ariaLabel="Project contexts pagination"
            hideWhenSinglePage={
              filteredContexts.length <= COMPACT_PAGE_SIZE_OPTIONS[0]
            }
          />
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Desktop Persistent Third Column (xl+) */}
      {isDesktopOpen && (
        <aside
          aria-label="Project info and contexts"
          className="hidden xl:flex xl:w-88 shrink-0 h-full border-l border-[#e4e6eb] dark:border-[#222d34] bg-white dark:bg-[#111b21] flex-col overflow-y-auto scroller"
        >
          {inspectorContent}
        </aside>
      )}

      {/* Mobile & Tablet Slide-Over Drawer (< xl) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 flex justify-end xl:hidden">
          <div
            aria-hidden="true"
            onClick={onCloseMobile}
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
          />
          <aside
            aria-label="Project info and contexts"
            className="relative z-10 w-full sm:w-96 max-w-full h-dvh border-l border-[#e4e6eb] dark:border-[#222d34] bg-white dark:bg-[#111b21] flex flex-col overflow-y-auto scroller shadow-2xl"
          >
            {inspectorContent}
          </aside>
        </div>
      )}
    </>
  );
}
