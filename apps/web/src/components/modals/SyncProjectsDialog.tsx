"use client";

import React, {
  useEffect,
  useId,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CloudDownload,
  FastForward,
  Globe,
  Infinity as InfinityIcon,
  KeyRound,
  Minimize2,
  Radio,
  RefreshCw,
  RotateCcw,
  Square,
  Terminal,
  Trash2,
} from "lucide-react";
import {
  SYNC_PROVIDERS,
  SYNC_PROVIDER_META,
  type SyncJobState,
  type SyncLogLevel,
  type SyncProjectsDto,
  type SyncProvider,
  type SyncProviderStatus,
} from "@/types/project";
import { ModalDialog, PaginationBar } from "@/components/ui";
import { usePagination } from "@/hooks/usePagination";

interface SyncProjectsDialogProps {
  dialogRef: RefObject<HTMLDialogElement | null>;
  providerStatuses?: SyncProviderStatus[];
  jobState: SyncJobState;
  wsConnected: boolean;
  onStartSync: (dto: SyncProjectsDto) => Promise<SyncJobState>;
  onStopSync: () => Promise<SyncJobState>;
  onTriggerNextPage: () => Promise<SyncJobState>;
  onResetCursor: () => Promise<SyncJobState>;
  onClearLogs: () => Promise<SyncJobState>;
}

const RATE_LIMIT_PRESETS = [10, 50, 100, 500, 1000] as const;

const RANK_RANGE_PRESETS: ReadonlyArray<{
  label: string;
  minRank: number | null;
  maxRank: number | null;
}> = [
  { label: "All Ranks", minRank: null, maxRank: null },
  { label: "Top 50 (1–50)", minRank: 1, maxRank: 50 },
  { label: "51–200", minRank: 51, maxRank: 200 },
  { label: "201–500", minRank: 201, maxRank: 500 },
  { label: "501–1000", minRank: 501, maxRank: 1000 },
];

function parseOptionalRank(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const num = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(num)) return null;
  return Math.min(Math.max(num, 1), 100000);
}

function formatRankRangeBadge(
  minRank?: number | null,
  maxRank?: number | null
): string | null {
  if (minRank != null && maxRank != null) return `Ranks #${minRank}–#${maxRank}`;
  if (minRank != null) return `Ranks #${minRank}+`;
  if (maxRank != null) return `Ranks #1–#${maxRank}`;
  return null;
}

function formatLogTime(isoTimestamp: string): string {
  try {
    return new Date(isoTimestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return "--:--:--";
  }
}

const LOG_LEVEL_BADGE: Record<
  SyncLogLevel,
  { label: string; className: string }
> = {
  success: {
    label: "NEW",
    className:
      "bg-emerald-500/20 text-emerald-300 border border-emerald-500/35",
  },
  update: {
    label: "SYNC",
    className: "bg-sky-500/20 text-sky-300 border border-sky-500/35",
  },
  info: {
    label: "INFO",
    className: "bg-slate-500/20 text-slate-300 border border-slate-500/35",
  },
  warn: {
    label: "WARN",
    className: "bg-amber-500/20 text-amber-300 border border-amber-500/35",
  },
  error: {
    label: "ERR",
    className: "bg-rose-500/20 text-rose-300 border border-rose-500/35",
  },
};

export function SyncProjectsDialog({
  dialogRef,
  providerStatuses = [],
  jobState,
  wsConnected,
  onStartSync,
  onStopSync,
  onTriggerNextPage,
  onResetCursor,
  onClearLogs,
}: SyncProjectsDialogProps) {
  const providerPrefixId = useId();
  const limitInputId = useId();
  const limitHelpId = useId();
  const minRankInputId = useId();
  const maxRankInputId = useId();
  const rankRangeHelpId = useId();
  const continuousCheckboxId = useId();

  const [selectedProvider, setSelectedProvider] = useState<SyncProvider>(
    jobState.provider || "coingecko"
  );
  const [limitPerMinuteInput, setLimitPerMinuteInput] = useState<string>(
    String(jobState.limit || 50)
  );
  const [isNoLimit, setIsNoLimit] = useState<boolean>(jobState.noLimit);
  const [continuousSync, setContinuousSync] = useState<boolean>(
    jobState.continuous
  );
  const [minRankInput, setMinRankInput] = useState<string>(
    jobState.minRank ? String(jobState.minRank) : ""
  );
  const [maxRankInput, setMaxRankInput] = useState<string>(
    jobState.maxRank ? String(jobState.maxRank) : ""
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmittingCommand, setIsSubmittingCommand] =
    useState<boolean>(false);

  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef<boolean>(true);

  const isRunning = jobState.isRunning;
  const isFetchingBatch = jobState.isFetchingBatch;
  const currentPage = jobState.currentPage;
  const countdownSeconds = jobState.countdownSeconds;
  const logs = jobState.logs;
  const activeError = localError ?? jobState.lastError;
  const logsPagination = usePagination(logs, {
    initialPageSize: 25,
    pageSizeOptions: [15, 25, 50, 100],
    initialPageStrategy: "last",
  });

  const effectiveProvider: SyncProvider =
    isRunning && jobState.provider ? jobState.provider : selectedProvider;
  const effectiveNoLimit = isRunning ? jobState.noLimit : isNoLimit;
  const effectiveContinuous = isRunning ? jobState.continuous : continuousSync;
  const effectiveLimitInput =
    isRunning && !jobState.noLimit
      ? String(jobState.limit)
      : limitPerMinuteInput;
  const effectiveMinRankInput = isRunning
    ? jobState.minRank != null
      ? String(jobState.minRank)
      : ""
    : minRankInput;
  const effectiveMaxRankInput = isRunning
    ? jobState.maxRank != null
      ? String(jobState.maxRank)
      : ""
    : maxRankInput;

  const parsedLimitPerMinute = Math.min(
    Math.max(Number.parseInt(effectiveLimitInput, 10) || 10, 1),
    1000
  );
  const parsedMinRank = parseOptionalRank(effectiveMinRankInput);
  const parsedMaxRank = parseOptionalRank(effectiveMaxRankInput);
  const activeRankRangeBadge = formatRankRangeBadge(
    isRunning ? jobState.minRank : parsedMinRank,
    isRunning ? jobState.maxRank : parsedMaxRank
  );

  const statusMap = new Map<SyncProvider, SyncProviderStatus>(
    providerStatuses.map((s) => [s.id, s])
  );

  // Smooth auto-scroll on new WebSocket log entries unless user scrolled up
  useEffect(() => {
    const el = logContainerRef.current;
    if (!el || !stickToBottomRef.current) return;
    const rafId = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(rafId);
  }, [logs]);

  const handleLogScroll = () => {
    const el = logContainerRef.current;
    if (!el) return;
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 48;
  };

  const handleStartSync = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isRunning || isSubmittingCommand) return;

    const clampedLimit = Math.min(
      Math.max(Number.parseInt(limitPerMinuteInput, 10) || 10, 1),
      1000
    );
    const nextMinRank = parseOptionalRank(minRankInput);
    const nextMaxRank = parseOptionalRank(maxRankInput);

    if (
      nextMinRank !== null &&
      nextMaxRank !== null &&
      nextMinRank > nextMaxRank
    ) {
      setLocalError(
        "Minimum rank cannot be greater than maximum rank. Please check the rank range."
      );
      return;
    }

    if (!isNoLimit) {
      setLimitPerMinuteInput(String(clampedLimit));
    }
    setMinRankInput(nextMinRank !== null ? String(nextMinRank) : "");
    setMaxRankInput(nextMaxRank !== null ? String(nextMaxRank) : "");
    setLocalError(null);
    setIsSubmittingCommand(true);
    stickToBottomRef.current = true;

    const rangeChanged =
      nextMinRank !== (jobState.minRank ?? null) ||
      nextMaxRank !== (jobState.maxRank ?? null) ||
      selectedProvider !== (jobState.provider ?? selectedProvider);

    try {
      await onStartSync({
        provider: selectedProvider,
        limit: isNoLimit ? 1000 : clampedLimit,
        ...(rangeChanged ? {} : { page: currentPage }),
        minRank: nextMinRank,
        maxRank: nextMaxRank,
        noLimit: isNoLimit,
        continuous: continuousSync,
      });
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : "Failed to start background project sync."
      );
    } finally {
      setIsSubmittingCommand(false);
    }
  };

  const handleStopSync = async () => {
    if (!isRunning || isSubmittingCommand) return;
    setIsSubmittingCommand(true);
    try {
      await onStopSync();
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "Failed to stop background sync."
      );
    } finally {
      setIsSubmittingCommand(false);
    }
  };

  const handleResetProgress = async () => {
    if (isRunning || isSubmittingCommand) return;
    setLocalError(null);
    setIsSubmittingCommand(true);
    try {
      await onResetCursor();
      setMinRankInput("");
      setMaxRankInput("");
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "Failed to reset pagination."
      );
    } finally {
      setIsSubmittingCommand(false);
    }
  };

  return (
    <ModalDialog
      dialogRef={dialogRef}
      title="Sync Crypto Projects"
      subtitle="Asynchronous background sync with real-time WebSocket log streaming. You can close this modal anytime and continue using the site while syncing runs."
      maxWidthClass="max-w-2xl"
    >
      <form
        method="post"
        onSubmit={(e) => void handleStartSync(e)}
        noValidate
        className="space-y-4 mt-4"
      >
        <div aria-live="polite">
          {activeError && (
            <div
              role="alert"
              className="rounded-xl bg-rose-500/12 border border-rose-500/30 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300 font-medium flex items-start gap-2"
            >
              <AlertTriangle
                className="w-4 h-4 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>{activeError}</span>
            </div>
          )}
        </div>

        {/* Provider Selector */}
        <fieldset disabled={isRunning} className="space-y-2">
          <legend className="text-xs font-bold uppercase tracking-wider text-[#65676b] dark:text-[#8696a0] mb-1">
            1. Select Market Cap Provider <span aria-hidden="true">*</span>
          </legend>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SYNC_PROVIDERS.map((providerKey, index) => {
              const meta = SYNC_PROVIDER_META[providerKey];
              const status = statusMap.get(providerKey);
              const isConfigured = status?.configured ?? false;
              const isSelected = effectiveProvider === providerKey;
              const radioId = `${providerPrefixId}-${providerKey}`;
              const descId = `${providerPrefixId}-${providerKey}-desc`;

              return (
                <div
                  key={providerKey}
                  className={`rounded-xl border p-2.5 transition ${
                    isSelected
                      ? "border-[#0084ff] bg-[#e7f3ff]/40 dark:bg-[#0084ff]/10"
                      : "border-[#e4e6eb] dark:border-[#2a3942] bg-[#f0f2f5]/60 dark:bg-[#111b21]"
                  } ${isRunning ? "opacity-75" : ""}`}
                >
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <div className="flex items-center gap-2">
                      <input
                        id={radioId}
                        type="radio"
                        name="sync-provider"
                        value={providerKey}
                        checked={isSelected}
                        autoFocus={index === 0}
                        aria-describedby={descId}
                        onChange={() => {
                          setSelectedProvider(providerKey);
                          setLocalError(null);
                        }}
                        className="checkbox-native"
                      />
                      <label
                        htmlFor={radioId}
                        className="text-xs font-bold text-[#050505] dark:text-[#e9edef] cursor-pointer"
                      >
                        {meta.shortLabel}
                      </label>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        isConfigured
                          ? "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                          : "bg-amber-500/12 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                      }`}
                    >
                      {isConfigured ? (
                        <>
                          <CheckCircle2
                            className="w-3 h-3"
                            aria-hidden="true"
                          />
                          <span>Key Ready</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-3 h-3" aria-hidden="true" />
                          <span>{meta.envVar}</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div
                    id={descId}
                    className="pl-6 mt-1 text-[10px] text-[#65676b] dark:text-[#8696a0] line-clamp-2"
                  >
                    {meta.freeTierNote}
                  </div>
                </div>
              );
            })}
          </div>
        </fieldset>

        {/* Rate Limit Per Minute & Continuous Sync Mode */}
        <div className="rounded-xl bg-[#f0f2f5]/70 dark:bg-[#111b21] border border-[#e4e6eb] dark:border-[#2a3942] p-3.5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <label
                htmlFor={limitInputId}
                className="text-xs font-bold uppercase tracking-wider text-[#050505] dark:text-[#e9edef] block"
              >
                2. Sync Rate Limit (Projects per Minute)
              </label>
              <p
                id={limitHelpId}
                className="text-[11px] text-[#65676b] dark:text-[#8696a0]"
              >
                Set how many projects to sync per minute (1–1000) or click{" "}
                <strong className="text-[#050505] dark:text-[#e9edef]">
                  No Limit
                </strong>{" "}
                for non-blocking async background syncing.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {effectiveNoLimit ? (
                <div className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-[#00a884]/15 text-[#00a884] border border-[#00a884]/40 flex items-center gap-1.5">
                  <InfinityIcon className="w-4 h-4" aria-hidden="true" />
                  <span>No Limit</span>
                </div>
              ) : (
                <>
                  <input
                    id={limitInputId}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={1000}
                    step={1}
                    disabled={isRunning}
                    aria-describedby={limitHelpId}
                    value={effectiveLimitInput}
                    onChange={(e) => {
                      setIsNoLimit(false);
                      setLimitPerMinuteInput(e.target.value);
                    }}
                    className="w-24 px-3 py-1.5 rounded-lg text-sm font-mono font-bold text-center bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] border border-[#e4e6eb] dark:border-[#2a3942] focus:border-[#0084ff] outline-none disabled:opacity-60"
                  />
                  <span className="text-xs font-semibold text-[#65676b] dark:text-[#8696a0]">
                    / min
                  </span>
                </>
              )}

              <button
                type="button"
                disabled={isRunning}
                onClick={() => setIsNoLimit((prev) => !prev)}
                aria-pressed={effectiveNoLimit}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer disabled:opacity-50 ${
                  effectiveNoLimit
                    ? "border-[#00a884] bg-[#00a884] text-white"
                    : "border-[#e4e6eb] dark:border-[#2a3942] bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] hover:border-[#00a884]"
                }`}
              >
                <InfinityIcon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>No Limit</span>
              </button>
            </div>
          </div>

          {/* Preset Pills */}
          <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-[#65676b] dark:text-[#8696a0] mr-1">
                Quick presets:
              </span>
              {RATE_LIMIT_PRESETS.map((preset) => {
                const isSelected =
                  !effectiveNoLimit && parsedLimitPerMinute === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    disabled={isRunning}
                    onClick={() => {
                      setIsNoLimit(false);
                      setLimitPerMinuteInput(String(preset));
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer disabled:opacity-50 ${
                      isSelected
                        ? "border-[#0084ff] bg-[#0084ff] text-white"
                        : "border-[#e4e6eb] dark:border-[#2a3942] bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] hover:border-[#0084ff]"
                    }`}
                  >
                    {preset} / min
                  </button>
                );
              })}
              <button
                type="button"
                disabled={isRunning}
                onClick={() => setIsNoLimit(true)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer disabled:opacity-50 ${
                  effectiveNoLimit
                    ? "border-[#00a884] bg-[#00a884] text-white"
                    : "border-[#e4e6eb] dark:border-[#2a3942] bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] hover:border-[#00a884]"
                }`}
              >
                <InfinityIcon className="w-3 h-3" aria-hidden="true" />
                <span>No Limit</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                id={continuousCheckboxId}
                type="checkbox"
                disabled={isRunning}
                checked={effectiveContinuous}
                onChange={(e) => setContinuousSync(e.target.checked)}
                className="checkbox-native"
              />
              <label
                htmlFor={continuousCheckboxId}
                className="text-xs font-semibold text-[#050505] dark:text-[#e9edef] cursor-pointer"
              >
                Keep syncing all pages until stopped
              </label>
            </div>
          </div>
        </div>

        {/* Target Rank Range (Min / Max) */}
        <div className="rounded-xl bg-[#f0f2f5]/70 dark:bg-[#111b21] border border-[#e4e6eb] dark:border-[#2a3942] p-3.5 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-bold uppercase tracking-wider text-[#050505] dark:text-[#e9edef]">
                3. Target Market Cap Rank Range (Optional)
              </div>
              <p
                id={rankRangeHelpId}
                className="text-[11px] text-[#65676b] dark:text-[#8696a0]"
              >
                Specify a Min and Max rank (e.g. 51 to 200) to jump directly to
                that tier and stop automatically once Max rank is reached.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <label
                  htmlFor={minRankInputId}
                  className="text-[11px] font-semibold text-[#65676b] dark:text-[#8696a0]"
                >
                  Min
                </label>
                <input
                  id={minRankInputId}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100000}
                  step={1}
                  disabled={isRunning}
                  placeholder="Any"
                  aria-describedby={rankRangeHelpId}
                  value={effectiveMinRankInput}
                  onChange={(e) => {
                    setMinRankInput(e.target.value);
                    setLocalError(null);
                  }}
                  className="w-20 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold text-center bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] border border-[#e4e6eb] dark:border-[#2a3942] focus:border-[#0084ff] outline-none disabled:opacity-60"
                />
              </div>
              <span
                aria-hidden="true"
                className="text-xs text-[#65676b] dark:text-[#8696a0]"
              >
                –
              </span>
              <div className="flex items-center gap-1.5">
                <label
                  htmlFor={maxRankInputId}
                  className="text-[11px] font-semibold text-[#65676b] dark:text-[#8696a0]"
                >
                  Max
                </label>
                <input
                  id={maxRankInputId}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100000}
                  step={1}
                  disabled={isRunning}
                  placeholder="Any"
                  aria-describedby={rankRangeHelpId}
                  value={effectiveMaxRankInput}
                  onChange={(e) => {
                    setMaxRankInput(e.target.value);
                    setLocalError(null);
                  }}
                  className="w-20 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold text-center bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] border border-[#e4e6eb] dark:border-[#2a3942] focus:border-[#0084ff] outline-none disabled:opacity-60"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-[#65676b] dark:text-[#8696a0] mr-1">
              Target tiers:
            </span>
            {RANK_RANGE_PRESETS.map((preset) => {
              const isSelected =
                parsedMinRank === preset.minRank &&
                parsedMaxRank === preset.maxRank;
              return (
                <button
                  key={preset.label}
                  type="button"
                  disabled={isRunning}
                  onClick={() => {
                    setMinRankInput(
                      preset.minRank !== null ? String(preset.minRank) : ""
                    );
                    setMaxRankInput(
                      preset.maxRank !== null ? String(preset.maxRank) : ""
                    );
                    setLocalError(null);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer disabled:opacity-50 ${
                    isSelected
                      ? "border-[#0084ff] bg-[#0084ff] text-white"
                      : "border-[#e4e6eb] dark:border-[#2a3942] bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] hover:border-[#0084ff]"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live WebSocket Sync Activity Log Console */}
        <div className="rounded-xl border border-[#2a3942] bg-[#0b141a] text-[#e9edef] overflow-hidden">
          {/* Console Header & Telemetry Strip */}
          <div className="px-3.5 py-2 bg-[#111b21] border-b border-[#2a3942] flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Terminal
                className="w-3.5 h-3.5 text-[#00a884]"
                aria-hidden="true"
              />
              <span className="text-xs font-bold tracking-wide">
                Live WebSocket Sync Logs
              </span>

              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono ${
                  wsConnected
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                    : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                }`}
                title={
                  wsConnected
                    ? "Connected to real-time WebSocket stream (/ws/sync)"
                    : "Reconnecting to WebSocket stream..."
                }
              >
                <Radio className="w-2.5 h-2.5" aria-hidden="true" />
                <span>{wsConnected ? "WS Live" : "WS Reconnecting"}</span>
              </span>

              {isRunning ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"
                    aria-hidden="true"
                  />
                  <span>
                    {isFetchingBatch
                      ? `Syncing Page #${currentPage}...`
                      : countdownSeconds !== null
                        ? `Next batch in ${countdownSeconds}s (Page #${currentPage})`
                        : "Running Async"}
                  </span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-500/20 text-slate-300">
                  {jobState.pagesCompleted > 0
                    ? `Paused at Page #${currentPage}`
                    : "Idle"}
                </span>
              )}
              {activeRankRangeBadge && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#0084ff]/20 text-[#60a5fa] border border-[#0084ff]/30">
                  {activeRankRangeBadge}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span
                className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-semibold"
                title="New projects added to DB and tagged 'new'"
              >
                +{jobState.totalCreated} new
              </span>
              <span
                className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 font-semibold"
                title="Existing DB projects updated with latest provider data"
              >
                ~{jobState.totalUpdated} synced
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-500/20 text-slate-300">
                {jobState.pagesCompleted}{" "}
                {jobState.pagesCompleted === 1 ? "page" : "pages"}
              </span>
              {logs.length > 0 && (
                <button
                  type="button"
                  onClick={() => void onClearLogs()}
                  aria-label="Clear sync logs"
                  title="Clear logs"
                  className="p-1 rounded hover:bg-[#202c33] text-[#8696a0] hover:text-white transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Log Output */}
          <div
            ref={logContainerRef}
            onScroll={handleLogScroll}
            role="log"
            aria-live="off"
            aria-label="Project synchronization logs"
            className="h-52 overflow-y-auto scroller p-3 font-mono text-[11px] space-y-1.5"
          >
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-[#8696a0] gap-1">
                <Globe className="w-5 h-5 text-[#0084ff]/70" aria-hidden="true" />
                <p>
                  Select a provider, choose a rate limit or{" "}
                  <strong className="text-[#e9edef]">No Limit</strong>, and
                  click{" "}
                  <strong className="text-[#e9edef]">
                    Start Continuous Sync
                  </strong>{" "}
                  to stream real-time WebSocket logs.
                </p>
              </div>
            ) : (
              logsPagination.items.map((entry) => {
                const badge = LOG_LEVEL_BADGE[entry.level];
                return (
                  <div
                    key={entry.id}
                    className="flex items-start gap-2 leading-relaxed break-words"
                  >
                    <span className="text-[#8696a0] shrink-0 select-none">
                      [{formatLogTime(entry.timestamp)}]
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    <span className="text-[#e9edef]">{entry.message}</span>
                  </div>
                );
              })
            )}
          </div>

          {logs.length > 0 && (
            <div className="px-3.5 pb-2 border-t border-[#2a3942] bg-[#111b21]">
              <PaginationBar
                variant="compact"
                meta={logsPagination.meta}
                pageSizeOptions={logsPagination.pageSizeOptions}
                onPageChange={logsPagination.setPage}
                onPageSizeChange={logsPagination.setPageSize}
                itemLabel="log entries"
                ariaLabel="Sync activity logs pagination"
                hideWhenSinglePage={logs.length <= 15}
              />
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#e4e6eb] dark:border-[#2a3942] flex-wrap">
          <div className="flex items-center gap-2">
            {!isRunning && currentPage > 1 && (
              <button
                type="button"
                disabled={isSubmittingCommand}
                onClick={() => void handleResetProgress()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#f0f2f5] hover:bg-[#e4e6eb] dark:bg-[#202c33] dark:hover:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] transition cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Reset to Page #1</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 ml-auto">
            <button
              type="button"
              onClick={() => {
                setLocalError(null);
                dialogRef.current?.close();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-[#65676b] dark:text-[#8696a0] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] transition cursor-pointer"
            >
              {isRunning ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Run in Background</span>
                </>
              ) : (
                <span>Close</span>
              )}
            </button>

            {isRunning ? (
              <>
                {!isFetchingBatch && countdownSeconds !== null && (
                  <button
                    type="button"
                    disabled={isSubmittingCommand}
                    onClick={() => void onTriggerNextPage()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] text-white transition cursor-pointer disabled:opacity-50"
                  >
                    <FastForward className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Sync Next Page Now</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={isSubmittingCommand}
                  onClick={() => void handleStopSync()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer disabled:opacity-50"
                >
                  {isFetchingBatch ? (
                    <RefreshCw
                      className="w-3.5 h-3.5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Square className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>Stop Syncing</span>
                </button>
              </>
            ) : (
              <button
                type="submit"
                disabled={isSubmittingCommand}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#00a884] hover:bg-[#008f6f] text-white transition cursor-pointer disabled:opacity-50"
              >
                <CloudDownload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {continuousSync
                    ? currentPage > 1
                      ? `Resume Continuous Sync (Page #${currentPage})`
                      : isNoLimit
                        ? "Start Continuous Sync (No Limit)"
                        : "Start Continuous Sync"
                    : `Sync Page #${currentPage} (${isNoLimit ? "No Limit" : `${parsedLimitPerMinute} projects`})`}
                </span>
              </button>
            )}
          </div>
        </div>
      </form>
    </ModalDialog>
  );
}
