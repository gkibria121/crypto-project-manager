"use client";

import React, { useId, useState, type RefObject } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Globe,
  KeyRound,
  Layers,
  Play,
  RefreshCw,
  Settings,
} from "lucide-react";
import {
  DEFAULT_SCRAPE_CONFIG,
  SPECIALIZED_SCRAPER_PROVIDER_META,
  detectSpecializedProvider,
  type CryptoProject,
  type ProjectContextItem,
  type ScrapeConfig,
  type ScraperProviderStatus,
  type ScrapeWaitUntil,
  type SpecializedScraperProvider,
} from "@/types/project";
import { ModalDialog } from "@/components/ui";

interface ScrapeConfigDialogProps {
  dialogRef: RefObject<HTMLDialogElement | null>;
  project: CryptoProject | null;
  targetContext: ProjectContextItem | null;
  providerStatuses: ScraperProviderStatus[];
  canWriteSettings: boolean;
  isScraping: boolean;
  onSaveProviderKey?: (params: {
    provider: SpecializedScraperProvider;
    apiKey: string;
  }) => Promise<unknown>;
  onStartScrape: (config: ScrapeConfig) => Promise<void>;
  onOpenGlobalSettings?: () => void;
}

const LEVEL_OPTIONS: ReadonlyArray<{
  value: number;
  title: string;
  hint: string;
}> = [
  { value: 1, title: "Level 1", hint: "Target URL / profile only" },
  { value: 2, title: "Level 2", hint: "Target + direct links / posts" },
  { value: 3, title: "Level 3", hint: "2 hops deep + feeds" },
  { value: 4, title: "Level 4", hint: "Deep site crawl (3 hops)" },
  { value: 5, title: "Level 5", hint: "Full depth crawl (4 hops)" },
];

const WAIT_UNTIL_OPTIONS: ReadonlyArray<{
  value: ScrapeWaitUntil;
  label: string;
  hint: string;
}> = [
  {
    value: "networkidle",
    label: "Network Idle",
    hint: "Best for React / Next.js SPAs",
  },
  {
    value: "load",
    label: "Window Load",
    hint: "Wait for scripts & resources",
  },
  {
    value: "domcontentloaded",
    label: "DOM Ready",
    hint: "Fastest JS hydration check",
  },
];

function parsePatternList(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function parseClampedInt(
  raw: string,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = Number.parseInt(raw, 10);
  const value = Number.isNaN(parsed) ? fallback : parsed;
  return Math.min(Math.max(value, min), max);
}

const POST_LIMIT_PRESETS = [5, 10, 25, 50] as const;

function PostLimitField({
  inputId,
  hintId,
  label,
  hint,
  value,
  highlighted,
  onChange,
}: {
  inputId: string;
  hintId: string;
  label: string;
  hint: string;
  value: string;
  highlighted: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <div
      className={`rounded-lg border p-3 space-y-2 ${
        highlighted
          ? "border-[#0084ff]/40 bg-[#e7f3ff]/50 dark:bg-[#0084ff]/10"
          : "border-[#e4e6eb] dark:border-[#2a3942] bg-white/70 dark:bg-[#202c33]/60"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-[#050505] dark:text-[#e9edef]"
          >
            {label}
          </label>
          <p
            id={hintId}
            className="text-[11px] text-[#65676b] dark:text-[#8696a0]"
          >
            {hint}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            id={inputId}
            type="text"
            inputMode="numeric"
            aria-describedby={hintId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-16 px-2.5 py-1.5 text-xs font-mono text-center rounded-lg bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] border border-[#e4e6eb] dark:border-[#2a3942] outline-none"
          />
          {POST_LIMIT_PRESETS.map((preset) => {
            const isActivePreset = Number(value) === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => onChange(String(preset))}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition cursor-pointer ${
                  isActivePreset
                    ? "bg-[#0084ff] text-white border-[#0084ff]"
                    : "bg-white dark:bg-[#202c33] text-[#65676b] dark:text-[#d1d7db] border-[#e4e6eb] dark:border-[#2a3942] hover:border-[#0084ff]/60"
                }`}
              >
                {preset}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ScrapeConfigDialog({
  dialogRef,
  project,
  targetContext,
  providerStatuses,
  canWriteSettings,
  isScraping,
  onSaveProviderKey,
  onStartScrape,
  onOpenGlobalSettings,
}: ScrapeConfigDialogProps) {
  const baseId = useId();

  const [levels, setLevels] = useState<number>(DEFAULT_SCRAPE_CONFIG.levels);
  const [maxPages, setMaxPages] = useState<string>(
    String(DEFAULT_SCRAPE_CONFIG.maxPages)
  );
  const [renderJs, setRenderJs] = useState<boolean>(
    DEFAULT_SCRAPE_CONFIG.renderJs
  );
  const [waitUntil, setWaitUntil] = useState<ScrapeWaitUntil>(
    DEFAULT_SCRAPE_CONFIG.waitUntil
  );
  const [waitForMs, setWaitForMs] = useState<string>(
    String(DEFAULT_SCRAPE_CONFIG.waitForMs)
  );
  const [scrollToBottom, setScrollToBottom] = useState<boolean>(
    DEFAULT_SCRAPE_CONFIG.scrollToBottom
  );
  const [blockMedia, setBlockMedia] = useState<boolean>(
    DEFAULT_SCRAPE_CONFIG.blockMedia
  );
  const [sameDomainOnly, setSameDomainOnly] = useState<boolean>(
    DEFAULT_SCRAPE_CONFIG.sameDomainOnly
  );
  const [includeSubdomains, setIncludeSubdomains] = useState<boolean>(
    DEFAULT_SCRAPE_CONFIG.includeSubdomains
  );
  const [respectRobotsTxt, setRespectRobotsTxt] = useState<boolean>(
    DEFAULT_SCRAPE_CONFIG.respectRobotsTxt
  );
  const [extractStructuredData, setExtractStructuredData] = useState<boolean>(
    DEFAULT_SCRAPE_CONFIG.extractStructuredData
  );
  const [extractContacts, setExtractContacts] = useState<boolean>(
    DEFAULT_SCRAPE_CONFIG.extractContacts
  );
  const [timeoutSeconds, setTimeoutSeconds] = useState<string>(
    String(DEFAULT_SCRAPE_CONFIG.timeoutSeconds)
  );
  const [specializedMaxItems, setSpecializedMaxItems] = useState<string>(
    String(DEFAULT_SCRAPE_CONFIG.specializedMaxItems)
  );
  const [xPostsLimit, setXPostsLimit] = useState<string>(
    String(DEFAULT_SCRAPE_CONFIG.xPostsLimit)
  );
  const [linkedinPostsLimit, setLinkedinPostsLimit] = useState<string>(
    String(DEFAULT_SCRAPE_CONFIG.linkedinPostsLimit)
  );
  const [includePatternsInput, setIncludePatternsInput] = useState<string>("");
  const [excludePatternsInput, setExcludePatternsInput] = useState<string>("");

  const [inlineKeyDrafts, setInlineKeyDrafts] = useState<
    Partial<Record<SpecializedScraperProvider, string>>
  >({});
  const [savingKeyProvider, setSavingKeyProvider] =
    useState<SpecializedScraperProvider | null>(null);
  const [editingKeyProvider, setEditingKeyProvider] =
    useState<SpecializedScraperProvider | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const targetsToInspect = targetContext
    ? [targetContext]
    : (project?.contexts ?? []).slice(0, 20);

  const detectedProviders = Array.from(
    new Set(
      targetsToInspect
        .map((c) => detectSpecializedProvider(c.type, c.url ?? c.value))
        .filter((p): p is SpecializedScraperProvider => p !== null)
    )
  );
  const hasXTarget = detectedProviders.includes("x");
  const hasLinkedinTarget = detectedProviders.includes("linkedin");

  const hasStandardWebsites = targetsToInspect.some(
    (c) =>
      c.type !== "message" &&
      detectSpecializedProvider(c.type, c.url ?? c.value) === null
  );

  const providerStatusMap = new Map(
    providerStatuses.map((s) => [s.provider, s])
  );

  const missingProviders = detectedProviders.filter(
    (prov) => !providerStatusMap.get(prov)?.configured
  );

  const handleQuickSaveKey = async (provider: SpecializedScraperProvider) => {
    if (!onSaveProviderKey) return;
    const token = (inlineKeyDrafts[provider] ?? "").trim();
    if (!token) {
      setErrorBanner(
        `Enter a valid API key for ${SPECIALIZED_SCRAPER_PROVIDER_META[provider].shortLabel}.`
      );
      return;
    }
    setErrorBanner(null);
    setStatusBanner(null);
    setSavingKeyProvider(provider);
    try {
      await onSaveProviderKey({ provider, apiKey: token });
      setInlineKeyDrafts((prev) => ({ ...prev, [provider]: "" }));
      setEditingKeyProvider(null);
      setStatusBanner(
        `Saved ${SPECIALIZED_SCRAPER_PROVIDER_META[provider].label} key. You can now scrape using its preferred official API.`
      );
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : "Failed to save API key."
      );
    } finally {
      setSavingKeyProvider(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isScraping) return;

    setErrorBanner(null);
    setStatusBanner(null);

    const parsedMaxPages = Math.min(
      Math.max(Number.parseInt(maxPages, 10) || 10, 1),
      50
    );
    const parsedWaitForMs = Math.min(
      Math.max(Number.parseInt(waitForMs, 10) || 0, 0),
      10000
    );
    const parsedTimeoutSec = Math.min(
      Math.max(Number.parseInt(timeoutSeconds, 10) || 15, 5),
      60
    );
    const parsedSpecializedMax = parseClampedInt(
      specializedMaxItems,
      DEFAULT_SCRAPE_CONFIG.specializedMaxItems,
      1,
      100
    );
    const parsedXPostsLimit = parseClampedInt(
      xPostsLimit,
      DEFAULT_SCRAPE_CONFIG.xPostsLimit,
      1,
      100
    );
    const parsedLinkedinPostsLimit = parseClampedInt(
      linkedinPostsLimit,
      DEFAULT_SCRAPE_CONFIG.linkedinPostsLimit,
      1,
      100
    );

    const config: ScrapeConfig = {
      levels,
      maxPages: parsedMaxPages,
      renderJs,
      waitUntil,
      waitForMs: parsedWaitForMs,
      scrollToBottom,
      sameDomainOnly,
      includeSubdomains,
      respectRobotsTxt,
      extractStructuredData,
      extractContacts,
      blockMedia,
      timeoutSeconds: parsedTimeoutSec,
      includePatterns: parsePatternList(includePatternsInput),
      excludePatterns: parsePatternList(excludePatternsInput),
      specializedMaxItems: parsedSpecializedMax,
      xPostsLimit: parsedXPostsLimit,
      linkedinPostsLimit: parsedLinkedinPostsLimit,
    };

    try {
      await onStartScrape(config);
      dialogRef.current?.close();
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : "Scrape execution failed."
      );
    }
  };

  return (
    <ModalDialog
      dialogRef={dialogRef}
      title={
        targetContext
          ? `Configure Scrape — ${targetContext.title}`
          : `Configure Batch Scrape (${targetsToInspect.length} contexts)`
      }
      subtitle={`${project ? `${project.name} (${project.ticker})` : "Project"} · ${
        targetContext
          ? targetContext.url || targetContext.value
          : "All linked websites, social APIs & notes"
      }`}
      maxWidthClass="max-w-2xl"
    >
      <form
        method="post"
        onSubmit={(e) => void handleSubmit(e)}
        noValidate
        className="space-y-4 mt-4"
      >
        {/* Live Errors & Updates */}
        <div aria-live="polite" className="space-y-2">
          {errorBanner && (
            <div
              role="alert"
              className="rounded-xl bg-rose-500/12 border border-rose-500/30 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300 font-medium flex items-start gap-2"
            >
              <AlertTriangle
                className="w-4 h-4 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>{errorBanner}</span>
            </div>
          )}
          {statusBanner && (
            <div
              role="status"
              className="rounded-xl bg-emerald-500/12 border border-emerald-500/30 px-3.5 py-2.5 text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-start gap-2"
            >
              <CheckCircle2
                className="w-4 h-4 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>{statusBanner}</span>
            </div>
          )}
        </div>

        {/* Specialized Platform API Key Detection Banner */}
        {detectedProviders.length > 0 && (
          <div
            className={`rounded-xl border p-3.5 space-y-2.5 ${
              missingProviders.length > 0
                ? "border-amber-500/40 bg-amber-500/10"
                : "border-emerald-500/35 bg-emerald-500/8"
            }`}
          >
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="flex items-start gap-2">
                <KeyRound
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    missingProviders.length > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                  aria-hidden="true"
                />
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-[#050505] dark:text-[#e9edef]">
                    {missingProviders.length > 0
                      ? "API Key Needed for Specialized Platforms"
                      : "Specialized Platform API Keys Configured"}
                  </div>
                  <p className="text-[11px] text-[#65676b] dark:text-[#d1d7db]">
                    Platforms like <strong>LinkedIn</strong>,{" "}
                    <strong>X (Twitter)</strong>, and <strong>Telegram</strong>{" "}
                    block unauthenticated HTML scraping and use their official
                    preferred APIs when an API key is configured.
                  </p>
                </div>
              </div>

              {onOpenGlobalSettings && canWriteSettings && (
                <button
                  type="button"
                  onClick={() => {
                    dialogRef.current?.close();
                    onOpenGlobalSettings();
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0084ff] hover:underline cursor-pointer shrink-0"
                >
                  <Settings className="w-3 h-3" aria-hidden="true" />
                  <span>Manage all API keys</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              {detectedProviders.map((prov) => {
                const meta = SPECIALIZED_SCRAPER_PROVIDER_META[prov];
                const status = providerStatusMap.get(prov);
                const configured = status?.configured ?? false;
                const isEditing = editingKeyProvider === prov;
                const inputId = `${baseId}-inline-key-${prov}`;

                return (
                  <div
                    key={prov}
                    className="rounded-lg bg-white/85 dark:bg-[#111b21]/85 border border-[#e4e6eb] dark:border-[#2a3942] p-2.5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-[#050505] dark:text-[#e9edef]">
                            {meta.label}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              configured
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                            }`}
                          >
                            {configured
                              ? `API Key Ready (${status?.maskedKey ?? "env"})`
                              : `API Key Needed (${meta.envVar})`}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#65676b] dark:text-[#8696a0] mt-0.5">
                          Preferred: {meta.preferredMethod}
                        </p>
                      </div>

                      {canWriteSettings && onSaveProviderKey && (
                        <button
                          type="button"
                          onClick={() =>
                            setEditingKeyProvider(isEditing ? null : prov)
                          }
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#e7f3ff] hover:bg-[#d0e7ff] text-[#0084ff] dark:bg-[#0084ff]/20 dark:text-[#4599ff] transition cursor-pointer shrink-0"
                        >
                          {isEditing
                            ? "Hide input"
                            : configured
                              ? "Update Key"
                              : "Configure API Key"}
                        </button>
                      )}
                    </div>

                    {!configured && !canWriteSettings && (
                      <p className="text-[11px] text-amber-800 dark:text-amber-300">
                        {meta.requiredNotice} Ask an Admin or BD Manager to
                        configure it.
                      </p>
                    )}

                    {isEditing && canWriteSettings && (
                      <div
                        role="group"
                        aria-label={`Configure ${meta.label} key`}
                        className="flex items-end gap-2 pt-1"
                      >
                        <div className="flex-1 min-w-0">
                          <label
                            htmlFor={inputId}
                            className="block text-[10px] font-semibold text-[#65676b] dark:text-[#8696a0] mb-1"
                          >
                            {meta.envVar}
                          </label>
                          <input
                            id={inputId}
                            type="password"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="none"
                            spellCheck={false}
                            value={inlineKeyDrafts[prov] ?? ""}
                            onChange={(e) =>
                              setInlineKeyDrafts((prev) => ({
                                ...prev,
                                [prov]: e.target.value,
                              }))
                            }
                            placeholder={`Paste ${meta.shortLabel} API key/token...`}
                            className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-[#f0f2f5] dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] border border-[#e4e6eb] dark:border-[#2a3942] outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={savingKeyProvider === prov}
                          onClick={() => void handleQuickSaveKey(prov)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] disabled:opacity-50 text-white transition cursor-pointer shrink-0"
                        >
                          {savingKeyProvider === prov ? "Saving..." : "Save Key"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 1: Crawl Levels (1..5 Radio Group) */}
        <fieldset className="rounded-xl bg-[#f0f2f5]/70 dark:bg-[#111b21] border border-[#e4e6eb] dark:border-[#2a3942] p-3.5 space-y-2.5">
          <legend className="px-1 text-xs font-bold uppercase tracking-wider text-[#050505] dark:text-[#e9edef] inline-flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#0084ff]" aria-hidden="true" />
            <span>
              1. Crawl Depth (Levels) <span aria-hidden="true">*</span>
            </span>
          </legend>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            {LEVEL_OPTIONS.map((opt, idx) => {
              const radioId = `${baseId}-level-${opt.value}`;
              const isSelected = levels === opt.value;
              return (
                <div
                  key={opt.value}
                  className={`rounded-xl border p-2.5 transition ${
                    isSelected
                      ? "border-[#0084ff] bg-[#e7f3ff]/50 dark:bg-[#0084ff]/15"
                      : "border-[#e4e6eb] dark:border-[#2a3942] bg-white dark:bg-[#202c33]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      id={radioId}
                      type="radio"
                      name="scrape-levels"
                      value={opt.value}
                      checked={isSelected}
                      autoFocus={idx === 1}
                      onChange={() => setLevels(opt.value)}
                      className="checkbox-native"
                    />
                    <label
                      htmlFor={radioId}
                      className="text-xs font-bold text-[#050505] dark:text-[#e9edef] cursor-pointer"
                    >
                      {opt.title}
                    </label>
                  </div>
                  <p className="text-[10px] text-[#65676b] dark:text-[#8696a0] mt-1 pl-6 leading-snug">
                    {opt.hint}
                  </p>
                </div>
              );
            })}
          </div>
        </fieldset>

        {/* Step 2: JavaScript Rendering & Dynamic Content */}
        {(hasStandardWebsites || !targetContext) && (
          <fieldset className="rounded-xl bg-[#f0f2f5]/70 dark:bg-[#111b21] border border-[#e4e6eb] dark:border-[#2a3942] p-3.5 space-y-3">
            <legend className="px-1 text-xs font-bold uppercase tracking-wider text-[#050505] dark:text-[#e9edef] inline-flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[#00a884]" aria-hidden="true" />
              <span>2. JavaScript & Dynamic Content Rendering</span>
            </legend>

            <div className="flex items-start gap-2.5">
              <input
                id={`${baseId}-render-js`}
                type="checkbox"
                checked={renderJs}
                onChange={(e) => setRenderJs(e.target.checked)}
                className="checkbox-native mt-0.5"
              />
              <label
                htmlFor={`${baseId}-render-js`}
                className="text-xs text-[#050505] dark:text-[#e9edef] cursor-pointer"
              >
                <span className="font-semibold">
                  Enable Headless Chromium JavaScript rendering
                </span>{" "}
                <span className="text-[#65676b] dark:text-[#8696a0]">
                  — recommended for React, Next.js, and client-rendered dApps so
                  dynamic content is captured.
                </span>
              </label>
            </div>

            {renderJs && (
              <div className="space-y-3 pl-0 sm:pl-6 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {WAIT_UNTIL_OPTIONS.map((opt) => {
                    const radioId = `${baseId}-wait-${opt.value}`;
                    const isSelected = waitUntil === opt.value;
                    return (
                      <div
                        key={opt.value}
                        className={`rounded-lg border p-2 transition ${
                          isSelected
                            ? "border-[#0084ff] bg-[#e7f3ff]/40 dark:bg-[#0084ff]/10"
                            : "border-[#e4e6eb] dark:border-[#2a3942] bg-white dark:bg-[#202c33]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            id={radioId}
                            type="radio"
                            name="scrape-wait-until"
                            value={opt.value}
                            checked={isSelected}
                            onChange={() => setWaitUntil(opt.value)}
                            className="checkbox-native"
                          />
                          <label
                            htmlFor={radioId}
                            className="text-xs font-semibold text-[#050505] dark:text-[#e9edef] cursor-pointer"
                          >
                            {opt.label}
                          </label>
                        </div>
                        <p className="text-[10px] text-[#65676b] dark:text-[#8696a0] pl-6 mt-0.5">
                          {opt.hint}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                  <div>
                    <label
                      htmlFor={`${baseId}-wait-ms`}
                      className="block text-[11px] font-semibold text-[#65676b] dark:text-[#8696a0] mb-1"
                    >
                      Hydration Settle Wait (ms)
                    </label>
                    <input
                      id={`${baseId}-wait-ms`}
                      type="text"
                      inputMode="numeric"
                      value={waitForMs}
                      onChange={(e) => setWaitForMs(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] border border-[#e4e6eb] dark:border-[#2a3942] outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-3 sm:pt-4">
                    <input
                      id={`${baseId}-scroll`}
                      type="checkbox"
                      checked={scrollToBottom}
                      onChange={(e) => setScrollToBottom(e.target.checked)}
                      className="checkbox-native"
                    />
                    <label
                      htmlFor={`${baseId}-scroll`}
                      className="text-xs font-medium text-[#050505] dark:text-[#e9edef] cursor-pointer"
                    >
                      Auto-scroll lazy content
                    </label>
                  </div>

                  <div className="flex items-center gap-2 pt-1 sm:pt-4">
                    <input
                      id={`${baseId}-block-media`}
                      type="checkbox"
                      checked={blockMedia}
                      onChange={(e) => setBlockMedia(e.target.checked)}
                      className="checkbox-native"
                    />
                    <label
                      htmlFor={`${baseId}-block-media`}
                      className="text-xs font-medium text-[#050505] dark:text-[#e9edef] cursor-pointer"
                    >
                      Skip media/fonts (faster)
                    </label>
                  </div>
                </div>
              </div>
            )}
          </fieldset>
        )}

        {/* Step 3: Crawl Scope, Limits & Filters */}
        <fieldset className="rounded-xl bg-[#f0f2f5]/70 dark:bg-[#111b21] border border-[#e4e6eb] dark:border-[#2a3942] p-3.5 space-y-3">
          <legend className="px-1 text-xs font-bold uppercase tracking-wider text-[#050505] dark:text-[#e9edef] inline-flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-[#0084ff]" aria-hidden="true" />
            <span>3. Crawl Scope, Limits & Extraction</span>
          </legend>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor={`${baseId}-max-pages`}
                className="block text-[11px] font-semibold text-[#65676b] dark:text-[#8696a0] mb-1"
              >
                Max Pages per Link (1–50)
              </label>
              <input
                id={`${baseId}-max-pages`}
                type="text"
                inputMode="numeric"
                value={maxPages}
                onChange={(e) => setMaxPages(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] border border-[#e4e6eb] dark:border-[#2a3942] outline-none"
              />
            </div>

            <div>
              <label
                htmlFor={`${baseId}-timeout`}
                className="block text-[11px] font-semibold text-[#65676b] dark:text-[#8696a0] mb-1"
              >
                Page Timeout (5–60 sec)
              </label>
              <input
                id={`${baseId}-timeout`}
                type="text"
                inputMode="numeric"
                value={timeoutSeconds}
                onChange={(e) => setTimeoutSeconds(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] border border-[#e4e6eb] dark:border-[#2a3942] outline-none"
              />
            </div>

            <div>
              <label
                htmlFor={`${baseId}-specialized-items`}
                className="block text-[11px] font-semibold text-[#65676b] dark:text-[#8696a0] mb-1"
              >
                API Feed Items (Telegram)
              </label>
              <input
                id={`${baseId}-specialized-items`}
                type="text"
                inputMode="numeric"
                value={specializedMaxItems}
                onChange={(e) => setSpecializedMaxItems(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] border border-[#e4e6eb] dark:border-[#2a3942] outline-none"
              />
            </div>
          </div>

          <PostLimitField
            inputId={`${baseId}-x-posts-limit`}
            hintId={`${baseId}-x-posts-hint`}
            label="X Latest Posts Limit (1–100, default: 10)"
            hint="Always fetches X account details plus the latest configured number of posts via X API v2."
            value={xPostsLimit}
            highlighted={hasXTarget}
            onChange={setXPostsLimit}
          />

          <PostLimitField
            inputId={`${baseId}-linkedin-posts-limit`}
            hintId={`${baseId}-linkedin-posts-hint`}
            label="LinkedIn Latest Posts Limit (1–100, default: 10)"
            hint="Always fetches LinkedIn organization details plus the latest configured number of posts via LinkedIn REST API."
            value={linkedinPostsLimit}
            highlighted={hasLinkedinTarget}
            onChange={setLinkedinPostsLimit}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <div className="flex items-center gap-2">
              <input
                id={`${baseId}-same-domain`}
                type="checkbox"
                checked={sameDomainOnly}
                onChange={(e) => setSameDomainOnly(e.target.checked)}
                className="checkbox-native"
              />
              <label
                htmlFor={`${baseId}-same-domain`}
                className="text-xs font-medium text-[#050505] dark:text-[#e9edef] cursor-pointer"
              >
                Stay on same domain
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                id={`${baseId}-subdomains`}
                type="checkbox"
                checked={includeSubdomains}
                disabled={!sameDomainOnly}
                onChange={(e) => setIncludeSubdomains(e.target.checked)}
                className="checkbox-native disabled:opacity-50"
              />
              <label
                htmlFor={`${baseId}-subdomains`}
                className="text-xs font-medium text-[#050505] dark:text-[#e9edef] cursor-pointer"
              >
                Include subdomains (e.g. docs.*)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                id={`${baseId}-robots`}
                type="checkbox"
                checked={respectRobotsTxt}
                onChange={(e) => setRespectRobotsTxt(e.target.checked)}
                className="checkbox-native"
              />
              <label
                htmlFor={`${baseId}-robots`}
                className="text-xs font-medium text-[#050505] dark:text-[#e9edef] cursor-pointer"
              >
                Respect robots.txt rules
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                id={`${baseId}-structured`}
                type="checkbox"
                checked={extractStructuredData}
                onChange={(e) => setExtractStructuredData(e.target.checked)}
                className="checkbox-native"
              />
              <label
                htmlFor={`${baseId}-structured`}
                className="text-xs font-medium text-[#050505] dark:text-[#e9edef] cursor-pointer"
              >
                Extract JSON-LD & OpenGraph
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                id={`${baseId}-contacts`}
                type="checkbox"
                checked={extractContacts}
                onChange={(e) => setExtractContacts(e.target.checked)}
                className="checkbox-native"
              />
              <label
                htmlFor={`${baseId}-contacts`}
                className="text-xs font-medium text-[#050505] dark:text-[#e9edef] cursor-pointer"
              >
                Extract public emails / contacts
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label
                htmlFor={`${baseId}-include-patterns`}
                className="block text-[11px] font-semibold text-[#65676b] dark:text-[#8696a0] mb-1"
              >
                Include URL Substrings (comma-separated, optional)
              </label>
              <input
                id={`${baseId}-include-patterns`}
                type="text"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                value={includePatternsInput}
                onChange={(e) => setIncludePatternsInput(e.target.value)}
                placeholder="e.g. /docs, /whitepaper, /blog"
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] border border-[#e4e6eb] dark:border-[#2a3942] outline-none"
              />
            </div>

            <div>
              <label
                htmlFor={`${baseId}-exclude-patterns`}
                className="block text-[11px] font-semibold text-[#65676b] dark:text-[#8696a0] mb-1"
              >
                Exclude URL Substrings (comma-separated, optional)
              </label>
              <input
                id={`${baseId}-exclude-patterns`}
                type="text"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                value={excludePatternsInput}
                onChange={(e) => setExcludePatternsInput(e.target.value)}
                placeholder="e.g. /login, /privacy, /terms"
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] border border-[#e4e6eb] dark:border-[#2a3942] outline-none"
              />
            </div>
          </div>
        </fieldset>

        {/* Action Footer */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e4e6eb] dark:border-[#2a3942]">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-[#65676b] dark:text-[#8696a0] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isScraping}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-55 text-white transition cursor-pointer"
          >
            {isScraping ? (
              <RefreshCw
                className="w-3.5 h-3.5 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Play className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>
              {isScraping
                ? "Scraping..."
                : targetContext
                  ? `Start Level-${levels} Scrape`
                  : `Scrape All (${targetsToInspect.length}) · Level ${levels}`}
            </span>
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
