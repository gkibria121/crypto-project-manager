"use client";

import React, { useId, useMemo, useState, type RefObject } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Database,
  ExternalLink,
  KeyRound,
  Layers,
  Link2,
  Mail,
  RefreshCw,
  Search,
  Settings,
} from "lucide-react";
import {
  SPECIALIZED_SCRAPER_PROVIDER_META,
  detectSpecializedProvider,
  type CryptoProject,
  type ProjectContextItem,
  type ScrapedPage,
  type ScrapeJob,
} from "@/types/project";
import { ContextTypeIcon, ModalDialog, PaginationBar } from "@/components/ui";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { usePagination } from "@/hooks/usePagination";
import { useProjectScrapedDataQuery } from "@/hooks/useServerState";

interface ScrapedDataDialogProps {
  dialogRef: RefObject<HTMLDialogElement | null>;
  project: CryptoProject | null;
  initialContextId: string | null;
  isOpen: boolean;
  onClose: () => void;
  canTriggerScraper?: boolean;
  canWriteSettings?: boolean;
  onOpenScrapeConfig?: (ctx: ProjectContextItem | null) => void;
  onOpenGlobalSettings?: () => void;
}

const RENDER_MODE_LABELS: Record<string, { label: string; badgeClass: string }> = {
  playwright_js: {
    label: "JS Rendered (Chromium)",
    badgeClass:
      "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  },
  static_html: {
    label: "Static HTML",
    badgeClass:
      "bg-slate-500/12 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
  },
  static_html_fallback: {
    label: "Static HTTP Fallback",
    badgeClass:
      "bg-amber-500/12 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  },
  x_api_v2: {
    label: "Official X API v2",
    badgeClass:
      "bg-slate-900/10 text-slate-800 dark:bg-white/15 dark:text-[#e9edef]",
  },
  linkedin_api: {
    label: "Official LinkedIn API",
    badgeClass:
      "bg-[#0a66c2]/15 text-[#0a66c2] dark:bg-[#0a66c2]/25 dark:text-[#60a5fa]",
  },
  telegram_bot_api: {
    label: "Official Telegram Bot API",
    badgeClass:
      "bg-[#229ed9]/15 text-[#167fb3] dark:bg-[#229ed9]/20 dark:text-[#5cc4f5]",
  },
  note_parser: {
    label: "Context Note Parser",
    badgeClass:
      "bg-purple-500/12 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
  },
};

function renderStatusBadgeClass(status: ScrapeJob["status"]): string {
  switch (status) {
    case "completed":
      return "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300";
    case "api_key_required":
      return "bg-amber-500/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300";
    case "unreachable":
      return "bg-amber-500/12 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300";
    case "failed":
      return "bg-rose-500/12 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300";
    default:
      return "bg-[#e7f3ff] text-[#0084ff] dark:bg-[#0084ff]/20 dark:text-[#4599ff]";
  }
}

export function ScrapedDataDialog({
  dialogRef,
  project,
  initialContextId,
  isOpen,
  onClose,
  canTriggerScraper = false,
  canWriteSettings = false,
  onOpenScrapeConfig,
  onOpenGlobalSettings,
}: ScrapedDataDialogProps) {
  const searchInputId = useId();
  const jobSelectId = useId();
  const { copiedId, copy } = useCopyToClipboard();

  const [selectedContextOverride, setSelectedContextOverride] = useState<{
    scopeKey: string;
    contextId: string | null;
  } | null>(null);
  const [selectedJobOverride, setSelectedJobOverride] = useState<{
    scopeKey: string;
    jobId: string | null;
  } | null>(null);
  const [depthFilter, setDepthFilter] = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const scopeKey = `${project?.id ?? ""}:${initialContextId ?? "all"}`;
  const activeContextId =
    selectedContextOverride && selectedContextOverride.scopeKey === scopeKey
      ? selectedContextOverride.contextId
      : initialContextId;

  const scrapedDataQuery = useProjectScrapedDataQuery(
    project?.id,
    activeContextId,
    isOpen
  );

  const jobs = useMemo(
    () => scrapedDataQuery.data?.jobs ?? [],
    [scrapedDataQuery.data]
  );
  const allPages = useMemo(
    () => scrapedDataQuery.data?.pages ?? [],
    [scrapedDataQuery.data]
  );

  const jobScopeKey = `${scopeKey}:${activeContextId ?? "all"}`;
  const chosenJobId =
    selectedJobOverride && selectedJobOverride.scopeKey === jobScopeKey
      ? selectedJobOverride.jobId
      : null;

  const activeJob: ScrapeJob | null = useMemo(() => {
    if (jobs.length === 0) return null;
    if (chosenJobId) {
      return jobs.find((j) => j.id === chosenJobId) ?? jobs[0] ?? null;
    }
    return jobs[0] ?? null;
  }, [jobs, chosenJobId]);

  // Show pages belonging to the selected job (when viewing a specific context or job) or latest jobs per context
  const pagesForView: ScrapedPage[] = useMemo(() => {
    if (allPages.length === 0) return [];
    if (chosenJobId) {
      return allPages.filter((p) => p.scrapeJobId === chosenJobId);
    }
    if (activeContextId && activeJob) {
      return allPages.filter((p) => p.scrapeJobId === activeJob.id);
    }
    // When viewing all project links together, show the latest job's pages per context
    const latestJobIdByContext = new Map<string, string>();
    for (const j of jobs) {
      if (j.contextId && !latestJobIdByContext.has(j.contextId)) {
        latestJobIdByContext.set(j.contextId, j.id);
      }
    }
    if (latestJobIdByContext.size > 0) {
      return allPages.filter(
        (p) => latestJobIdByContext.get(p.contextId) === p.scrapeJobId
      );
    }
    return allPages;
  }, [allPages, chosenJobId, activeContextId, activeJob, jobs]);

  const availableDepths = useMemo(() => {
    const depths = Array.from(new Set(pagesForView.map((p) => p.depth))).sort(
      (a, b) => a - b
    );
    return depths;
  }, [pagesForView]);

  const filteredPages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return pagesForView
      .filter((p) => {
        if (depthFilter !== "all" && p.depth !== depthFilter) return false;
        if (!q) return true;
        return (
          p.url.toLowerCase().includes(q) ||
          (p.title ?? "").toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q) ||
          (p.textContent ?? "").toLowerCase().includes(q) ||
          p.signals.some((s) => s.toLowerCase().includes(q)) ||
          p.contacts.some((c) => c.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => a.depth - b.depth);
  }, [pagesForView, depthFilter, searchQuery]);

  const pagesPagination = usePagination(filteredPages, {
    initialPageSize: 10,
    pageSizeOptions: [10, 25, 50],
    resetKey: `${jobScopeKey}:${chosenJobId ?? "latest"}:${depthFilter}:${searchQuery}`,
  });

  const activeContextItem =
    project?.contexts.find((c) => c.id === activeContextId) ?? null;

  const contextById = useMemo(
    () => new Map((project?.contexts ?? []).map((c) => [c.id, c])),
    [project]
  );

  const aggregatedSignals = useMemo(
    () => Array.from(new Set(pagesForView.flatMap((p) => p.signals))),
    [pagesForView]
  );
  const aggregatedContacts = useMemo(
    () => Array.from(new Set(pagesForView.flatMap((p) => p.contacts))),
    [pagesForView]
  );
  const aggregatedSocials = useMemo(() => {
    const merged: Record<string, string> = {};
    for (const p of pagesForView) {
      for (const [k, v] of Object.entries(p.socialLinks ?? {})) {
        if (!merged[k]) merged[k] = v;
      }
    }
    return merged;
  }, [pagesForView]);

  const activePlatformData = useMemo(() => {
    if (activeJob?.platformData) return activeJob.platformData;
    return pagesForView.find((p) => p.platformData)?.platformData ?? null;
  }, [activeJob, pagesForView]);

  const specializedProvider = activeContextItem
    ? detectSpecializedProvider(
        activeContextItem.type,
        activeContextItem.url ?? activeContextItem.value
      )
    : null;

  return (
    <ModalDialog
      dialogRef={dialogRef}
      onClose={onClose}
      title={
        <span className="inline-flex items-center gap-2">
          <Database className="w-4 h-4 text-[#00a884]" aria-hidden="true" />
          <span>
            Scraped Intelligence Data
            {project ? ` — ${project.name}` : ""}
          </span>
        </span>
      }
      subtitle={
        activeContextItem
          ? `Link: ${activeContextItem.title} (${activeContextItem.url || activeContextItem.value})`
          : project
            ? `Relational scraped records linked to ${project.name} (${project.ticker}) and its context links`
            : "Scraped project & link data"
      }
      maxWidthClass="max-w-4xl"
    >
      <div className="mt-4 space-y-4">
        {/* Context Link Tabs (Single Row Horizontal Scroll per modern-web-guidance tabs) */}
        {project && project.contexts.length > 0 && (
          <div
            role="tablist"
            aria-label="Filter scraped data by project link"
            className="flex items-center gap-1 border-b border-[#e4e6eb] dark:border-[#2a3942] overflow-x-auto scroller"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeContextId === null}
              onClick={() => {
                setSelectedContextOverride({ scopeKey, contextId: null });
                setSelectedJobOverride(null);
                setDepthFilter("all");
              }}
              className="accessible-tab px-3 py-2 text-xs font-semibold text-[#65676b] dark:text-[#8696a0] hover:text-[#050505] dark:hover:text-[#e9edef] transition cursor-pointer whitespace-nowrap"
            >
              All Links ({project.contexts.length})
            </button>

            {project.contexts.map((ctx) => {
              const isSelected = activeContextId === ctx.id;
              const pageCount = ctx.scrapedMetadata?.pagesCount;
              return (
                <button
                  key={ctx.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => {
                    setSelectedContextOverride({
                      scopeKey,
                      contextId: ctx.id,
                    });
                    setSelectedJobOverride(null);
                    setDepthFilter("all");
                  }}
                  className="accessible-tab inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#65676b] dark:text-[#8696a0] hover:text-[#050505] dark:hover:text-[#e9edef] transition cursor-pointer whitespace-nowrap"
                >
                  <ContextTypeIcon type={ctx.type} variant="sm" />
                  <span className="max-w-36 truncate">{ctx.title}</span>
                  {typeof pageCount === "number" && pageCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-[#f0f2f5] dark:bg-[#2a3942] text-[10px]">
                      {pageCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Loading & Error States */}
        {scrapedDataQuery.isLoading ? (
          <div className="py-12 text-center text-xs text-[#65676b] dark:text-[#8696a0] flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
            <span>Loading scraped records from PostgreSQL...</span>
          </div>
        ) : scrapedDataQuery.isError ? (
          <div
            role="alert"
            className="rounded-xl bg-rose-500/12 border border-rose-500/30 p-3.5 text-xs text-rose-700 dark:text-rose-300"
          >
            {scrapedDataQuery.error instanceof Error
              ? scrapedDataQuery.error.message
              : "Failed to load scraped data."}
          </div>
        ) : (
          <>
            {/* Scrape Job Selector & Relation Metadata Bar */}
            {jobs.length > 0 && activeJob && (
              <div className="rounded-xl bg-[#f0f2f5]/80 dark:bg-[#111b21] border border-[#e4e6eb] dark:border-[#2a3942] p-3.5 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${renderStatusBadgeClass(
                        activeJob.status
                      )}`}
                    >
                      {activeJob.status.replace(/_/g, " ")}
                    </span>
                    {activeJob.providerUsed && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          RENDER_MODE_LABELS[activeJob.providerUsed]?.badgeClass ??
                          "bg-[#e7f3ff] text-[#0084ff]"
                        }`}
                      >
                        {RENDER_MODE_LABELS[activeJob.providerUsed]?.label ??
                          activeJob.providerUsed}
                      </span>
                    )}
                    <span className="text-[11px] font-medium text-[#65676b] dark:text-[#8696a0]">
                      Levels: <strong>{activeJob.levelsScraped}</strong> ·
                      Pages captured:{" "}
                      <strong>{pagesForView.length}</strong>
                      {activeJob.durationMs !== undefined && (
                        <> · {activeJob.durationMs}ms</>
                      )}
                    </span>
                  </div>

                  {jobs.length > 1 && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <label
                        htmlFor={jobSelectId}
                        className="text-[11px] font-semibold text-[#65676b] dark:text-[#8696a0]"
                      >
                        Run:
                      </label>
                      <select
                        id={jobSelectId}
                        value={chosenJobId ?? ""}
                        onChange={(e) =>
                          setSelectedJobOverride({
                            scopeKey: jobScopeKey,
                            jobId: e.target.value || null,
                          })
                        }
                        className="rounded-lg bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] px-2 py-1 text-[11px] font-medium text-[#050505] dark:text-[#e9edef] outline-none cursor-pointer"
                      >
                        <option value="">
                          {activeContextId
                            ? "Latest run for this link"
                            : "Latest run per link"}
                        </option>
                        {jobs.map((job) => {
                          const linkedCtx = job.contextId
                            ? contextById.get(job.contextId)
                            : null;
                          return (
                            <option key={job.id} value={job.id}>
                              {linkedCtx ? `${linkedCtx.title} · ` : ""}
                              {job.status} ·{" "}
                              {new Date(job.createdAt).toLocaleString()} (
                              {job.pagesScraped}p)
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}
                </div>

                {/* Config used pill strip */}
                {activeJob.config && (
                  <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-[#65676b] dark:text-[#8696a0]">
                    <span className="font-semibold text-[#050505] dark:text-[#d1d7db]">
                      Config:
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942]">
                      Levels: {activeJob.config.levels ?? 1}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942]">
                      JS: {activeJob.config.renderJs === false ? "Off" : "Enabled"}
                    </span>
                    {activeJob.config.maxPages && (
                      <span className="px-1.5 py-0.5 rounded bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942]">
                        Max pages: {activeJob.config.maxPages}
                      </span>
                    )}
                    {activeJob.config.xPostsLimit !== undefined &&
                      (activeJob.providerUsed === "x_api_v2" ||
                        activeJob.targetType === "x_handle" ||
                        specializedProvider === "x") && (
                        <span className="px-1.5 py-0.5 rounded bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942]">
                          X posts limit: {activeJob.config.xPostsLimit}
                        </span>
                      )}
                    {activeJob.config.sameDomainOnly !== undefined && (
                      <span className="px-1.5 py-0.5 rounded bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942]">
                        {activeJob.config.sameDomainOnly
                          ? "Same domain"
                          : "Cross-domain"}
                      </span>
                    )}
                  </div>
                )}

                {/* API Key Needed Callout if job required key */}
                {activeJob.status === "api_key_required" && (
                  <div
                    role="alert"
                    className="rounded-lg bg-amber-500/12 border border-amber-500/35 p-3 text-xs text-amber-800 dark:text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="flex items-start gap-2">
                      <KeyRound
                        className="w-4 h-4 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <div>
                        <div className="font-bold">
                          API Key Needed for{" "}
                          {specializedProvider
                            ? SPECIALIZED_SCRAPER_PROVIDER_META[specializedProvider]
                                .label
                            : activeJob.targetType}
                        </div>
                        <p className="text-[11px] mt-0.5">
                          {activeJob.errorMessage ||
                            "Configure the specialized platform API key to scrape this link."}
                        </p>
                      </div>
                    </div>

                    {canWriteSettings && onOpenGlobalSettings && (
                      <button
                        type="button"
                        onClick={() => {
                          dialogRef.current?.close();
                          onOpenGlobalSettings();
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-600 hover:bg-amber-700 text-white transition cursor-pointer shrink-0"
                      >
                        <Settings className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Configure API Key</span>
                      </button>
                    )}
                  </div>
                )}

                {activeJob.status !== "api_key_required" &&
                  activeJob.errorMessage && (
                    <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-2.5 text-[11px] text-rose-700 dark:text-rose-300 flex items-start gap-2">
                      <AlertTriangle
                        className="w-3.5 h-3.5 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <span>{activeJob.errorMessage}</span>
                    </div>
                  )}
              </div>
            )}

            {/* Specialized Platform Data Summary (X / LinkedIn / Telegram) */}
            {activePlatformData && (
              <div className="rounded-xl border border-[#e4e6eb] dark:border-[#2a3942] bg-white dark:bg-[#111b21] p-3.5 space-y-2">
                <div className="text-xs font-bold text-[#050505] dark:text-[#e9edef]">
                  Specialized Platform Intelligence (
                  {String(activePlatformData.provider ?? "API").toUpperCase()})
                </div>
                <pre className="text-[11px] font-mono bg-[#f0f2f5] dark:bg-[#202c33] text-[#050505] dark:text-[#d1d7db] rounded-lg p-2.5 overflow-x-auto max-h-44 scroller">
                  {JSON.stringify(activePlatformData, null, 2)}
                </pre>
              </div>
            )}

            {/* Aggregated Signals, Contacts & Socials */}
            {(aggregatedSignals.length > 0 ||
              aggregatedContacts.length > 0 ||
              Object.keys(aggregatedSocials).length > 0) && (
              <div className="rounded-xl border border-[#e4e6eb] dark:border-[#2a3942] bg-white dark:bg-[#111b21] p-3.5 space-y-2.5">
                {aggregatedSignals.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-[#65676b] dark:text-[#8696a0] mr-1">
                      Signals:
                    </span>
                    {aggregatedSignals.map((sig) => (
                      <span
                        key={sig}
                        className="px-2 py-0.5 rounded bg-[#f0f2f5] dark:bg-[#202c33] text-[10px] font-mono font-semibold text-[#050505] dark:text-[#e9edef]"
                      >
                        {sig}
                      </span>
                    ))}
                  </div>
                )}

                {aggregatedContacts.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                    <Mail
                      className="w-3.5 h-3.5 text-[#0084ff] shrink-0"
                      aria-hidden="true"
                    />
                    <span className="font-semibold text-[#65676b] dark:text-[#8696a0]">
                      Contacts:
                    </span>
                    {aggregatedContacts.map((email) => (
                      <span
                        key={email}
                        className="px-2 py-0.5 rounded bg-[#e7f3ff] dark:bg-[#0084ff]/20 text-[#0084ff] dark:text-[#4599ff] font-mono text-[10px]"
                      >
                        {email}
                      </span>
                    ))}
                  </div>
                )}

                {Object.keys(aggregatedSocials).length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                    <Link2
                      className="w-3.5 h-3.5 text-[#00a884] shrink-0"
                      aria-hidden="true"
                    />
                    <span className="font-semibold text-[#65676b] dark:text-[#8696a0]">
                      Discovered Links:
                    </span>
                    {Object.entries(aggregatedSocials).map(([key, href]) => (
                      <a
                        key={`${key}:${href}`}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#f0f2f5] dark:bg-[#202c33] text-[10px] text-[#0084ff] hover:underline"
                      >
                        <span className="font-semibold uppercase">{key}</span>
                        <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Search & Level Filter for Pages */}
            {pagesForView.length > 0 && (
              <search className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setDepthFilter("all")}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                      depthFilter === "all"
                        ? "bg-[#e7f3ff] text-[#0084ff] dark:bg-[#0084ff]/20 dark:text-[#4599ff]"
                        : "bg-[#f0f2f5] dark:bg-[#2a3942] text-[#65676b] dark:text-[#8696a0]"
                    }`}
                  >
                    All Levels ({pagesForView.length})
                  </button>
                  {availableDepths.map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setDepthFilter(lvl)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                        depthFilter === lvl
                          ? "bg-[#e7f3ff] text-[#0084ff] dark:bg-[#0084ff]/20 dark:text-[#4599ff]"
                          : "bg-[#f0f2f5] dark:bg-[#2a3942] text-[#65676b] dark:text-[#8696a0]"
                      }`}
                    >
                      <Layers className="w-3 h-3" aria-hidden="true" />
                      <span>
                        Level {lvl} (
                        {pagesForView.filter((p) => p.depth === lvl).length})
                      </span>
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-64">
                  <label htmlFor={searchInputId} className="sr-only">
                    Search scraped page contents
                  </label>
                  <Search
                    className="w-3.5 h-3.5 text-[#65676b] dark:text-[#8696a0] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id={searchInputId}
                    type="search"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter scraped pages..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-full bg-[#f0f2f5] dark:bg-[#111b21] border border-[#e4e6eb] dark:border-[#2a3942] text-[#050505] dark:text-[#e9edef] outline-none"
                  />
                </div>
              </search>
            )}

            {/* Crawled Pages Accordion (Semantic <details> with NO headings inside <summary> per modern-web-guidance) */}
            {pagesForView.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#e4e6eb] dark:border-[#2a3942] py-10 px-4 text-center space-y-2">
                <p className="text-xs text-[#65676b] dark:text-[#8696a0]">
                  {jobs.length > 0
                    ? "No crawled HTML/API pages were captured for this run yet."
                    : "No scraped data saved in the database for this selection yet."}
                </p>
                {canTriggerScraper && onOpenScrapeConfig && (
                  <button
                    type="button"
                    onClick={() => {
                      dialogRef.current?.close();
                      onOpenScrapeConfig(activeContextItem);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#00a884] hover:bg-[#008f6f] text-white transition cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Configure & Run Scrape</span>
                  </button>
                )}
              </div>
            ) : filteredPages.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#65676b] dark:text-[#8696a0]">
                No scraped pages match your current filter.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[50dvh] overflow-y-auto scroller pr-1">
                {pagesPagination.items.map((page, index) => {
                  const renderInfo = RENDER_MODE_LABELS[page.renderMode] ?? {
                    label: page.renderMode,
                    badgeClass:
                      "bg-slate-500/12 text-slate-700 dark:text-slate-300",
                  };
                  const linkedContext = contextById.get(page.contextId);

                  return (
                    <details
                      key={page.id}
                      open={index === 0 && pagesPagination.meta.currentPage === 1}
                      className="rounded-xl border border-[#e4e6eb] dark:border-[#2a3942] bg-white dark:bg-[#111b21] overflow-hidden"
                    >
                      <summary className="px-3.5 py-2.5 cursor-pointer select-none flex items-center justify-between gap-2 hover:bg-[#f0f2f5]/60 dark:hover:bg-[#202c33]/70">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="px-1.5 py-0.5 rounded bg-[#e7f3ff] text-[#0084ff] dark:bg-[#0084ff]/20 dark:text-[#4599ff] font-mono text-[10px] font-bold shrink-0">
                            L{page.depth}
                          </span>
                          {page.httpStatus && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-semibold shrink-0">
                              {page.httpStatus}
                            </span>
                          )}
                          <span className="text-xs font-semibold text-[#050505] dark:text-[#e9edef] truncate">
                            {page.title || page.url}
                          </span>
                          <span className="hidden sm:inline text-[11px] font-mono text-[#65676b] dark:text-[#8696a0] truncate">
                            {page.url}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`hidden md:inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${renderInfo.badgeClass}`}
                          >
                            {renderInfo.label}
                          </span>
                          <span className="text-[10px] text-[#65676b] dark:text-[#8696a0] font-mono">
                            {page.wordCount}w
                          </span>
                        </div>
                      </summary>

                      <div className="px-3.5 pb-3.5 pt-2 border-t border-[#e4e6eb] dark:border-[#2a3942] space-y-3 text-xs">
                        {/* URL & Relation Details */}
                        <div className="flex flex-col gap-1 text-[11px] text-[#65676b] dark:text-[#8696a0]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-[#050505] dark:text-[#d1d7db]">
                              URL:
                            </span>
                            {page.url.startsWith("http") ? (
                              <a
                                href={page.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[#0084ff] hover:underline break-all"
                              >
                                <span>{page.url}</span>
                                <ExternalLink
                                  className="w-3 h-3 shrink-0"
                                  aria-hidden="true"
                                />
                              </a>
                            ) : (
                              <span className="font-mono">{page.url}</span>
                            )}
                          </div>

                          {linkedContext && (
                            <div>
                              <span className="font-semibold text-[#050505] dark:text-[#d1d7db]">
                                Linked Context:
                              </span>{" "}
                              {linkedContext.title} ({linkedContext.type})
                            </div>
                          )}

                          {page.parentUrl && (
                            <div className="break-all">
                              <span className="font-semibold text-[#050505] dark:text-[#d1d7db]">
                                Discovered From (Parent):
                              </span>{" "}
                              <span className="font-mono">{page.parentUrl}</span>
                            </div>
                          )}
                        </div>

                        {page.description && (
                          <p className="text-xs text-[#050505] dark:text-[#d1d7db] bg-[#f0f2f5] dark:bg-[#202c33] rounded-lg px-3 py-2">
                            {page.description}
                          </p>
                        )}

                        {/* Headings */}
                        {page.headings.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-[11px] font-semibold text-[#65676b] dark:text-[#8696a0]">
                              Extracted Headings ({page.headings.length})
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {page.headings.slice(0, 12).map((h, hIdx) => (
                                <span
                                  key={`${h.level}-${hIdx}`}
                                  className="px-2 py-0.5 rounded bg-[#f0f2f5] dark:bg-[#202c33] text-[11px] text-[#050505] dark:text-[#d1d7db]"
                                >
                                  <strong className="font-mono text-[10px] text-[#0084ff] uppercase mr-1">
                                    {h.level}
                                  </strong>
                                  {h.text}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Extracted Text Content */}
                        {page.textContent && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-[#65676b] dark:text-[#8696a0]">
                                Captured Dynamic Content ({page.wordCount} words)
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  copy(page.id, page.textContent ?? "")
                                }
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0084ff] hover:underline cursor-pointer"
                              >
                                {copiedId === page.id ? (
                                  <>
                                    <Check
                                      className="w-3 h-3 text-[#00a884]"
                                      aria-hidden="true"
                                    />
                                    <span>Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" aria-hidden="true" />
                                    <span>Copy text</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <div className="max-h-48 overflow-y-auto scroller rounded-lg bg-[#f0f2f5] dark:bg-[#202c33] p-3 text-[11px] leading-relaxed text-[#050505] dark:text-[#e9edef] whitespace-pre-wrap break-words">
                              {page.textContent}
                            </div>
                          </div>
                        )}

                        {/* Discovered Child Links */}
                        {page.links.length > 0 && (
                          <details className="rounded-lg border border-[#e4e6eb] dark:border-[#2a3942] bg-[#f0f2f5]/40 dark:bg-[#202c33]/40 p-2.5">
                            <summary className="text-[11px] font-semibold text-[#65676b] dark:text-[#8696a0] cursor-pointer select-none">
                              Discovered Links ({page.links.length})
                            </summary>
                            <ul className="mt-2 space-y-1 max-h-36 overflow-y-auto scroller text-[11px]">
                              {page.links.slice(0, 40).map((lnk, lIdx) => (
                                <li
                                  key={`${lnk.url}-${lIdx}`}
                                  className="flex items-center justify-between gap-2"
                                >
                                  <a
                                    href={lnk.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#0084ff] hover:underline truncate"
                                  >
                                    {lnk.text || lnk.url}
                                  </a>
                                  <span className="px-1.5 py-0.2 rounded bg-white dark:bg-[#111b21] text-[9px] font-mono text-[#65676b] dark:text-[#8696a0] shrink-0">
                                    {lnk.category ??
                                      (lnk.isInternal ? "internal" : "external")}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}

                        {/* Structured Data JSON-LD */}
                        {page.structuredData.length > 0 && (
                          <details className="rounded-lg border border-[#e4e6eb] dark:border-[#2a3942] bg-[#f0f2f5]/40 dark:bg-[#202c33]/40 p-2.5">
                            <summary className="text-[11px] font-semibold text-[#65676b] dark:text-[#8696a0] cursor-pointer select-none">
                              Structured JSON-LD ({page.structuredData.length})
                            </summary>
                            <pre className="mt-2 text-[10px] font-mono overflow-x-auto max-h-36 scroller">
                              {JSON.stringify(page.structuredData, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}

            <PaginationBar
              variant="compact"
              meta={pagesPagination.meta}
              pageSizeOptions={pagesPagination.pageSizeOptions}
              onPageChange={pagesPagination.setPage}
              onPageSizeChange={pagesPagination.setPageSize}
              itemLabel="scraped pages"
              ariaLabel="Scraped pages pagination"
              hideWhenSinglePage
            />
          </>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#e4e6eb] dark:border-[#2a3942]">
          <div>
            {canTriggerScraper && onOpenScrapeConfig && (
              <button
                type="button"
                onClick={() => {
                  dialogRef.current?.close();
                  onOpenScrapeConfig(activeContextItem);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#e7f3ff] hover:bg-[#d0e7ff] text-[#0084ff] dark:bg-[#0084ff]/20 dark:text-[#4599ff] transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Re-scrape with Config</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] text-white transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}
