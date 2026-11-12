"use client";

import React, { useId, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Trash2,
} from "lucide-react";
import {
  SPECIALIZED_SCRAPER_PROVIDERS,
  SPECIALIZED_SCRAPER_PROVIDER_META,
  type ScraperProviderStatus,
  type SpecializedScraperProvider,
} from "@/types/project";

interface ScraperProviderKeysPanelProps {
  providerStatuses: ScraperProviderStatus[];
  canEdit: boolean;
  onSaveKey: (params: {
    provider: SpecializedScraperProvider;
    apiKey: string;
  }) => Promise<unknown>;
  onDeleteKey: (provider: SpecializedScraperProvider) => Promise<unknown>;
}

export function ScraperProviderKeysPanel({
  providerStatuses,
  canEdit,
  onSaveKey,
  onDeleteKey,
}: ScraperProviderKeysPanelProps) {
  const baseId = useId();
  const [draftKeys, setDraftKeys] = useState<
    Partial<Record<SpecializedScraperProvider, string>>
  >({});
  const [revealed, setRevealed] = useState<
    Partial<Record<SpecializedScraperProvider, boolean>>
  >({});
  const [savingProvider, setSavingProvider] =
    useState<SpecializedScraperProvider | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const statusByProvider = new Map(
    providerStatuses.map((item) => [item.provider, item])
  );

  const handleSave = async (
    e: React.FormEvent<HTMLFormElement>,
    provider: SpecializedScraperProvider
  ) => {
    e.preventDefault();
    const token = (draftKeys[provider] ?? "").trim();
    if (!token) {
      setErrorMessage(
        `Please enter a valid ${SPECIALIZED_SCRAPER_PROVIDER_META[provider].shortLabel} API key or token.`
      );
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setSavingProvider(provider);
    try {
      await onSaveKey({ provider, apiKey: token });
      setDraftKeys((prev) => ({ ...prev, [provider]: "" }));
      setStatusMessage(
        `Saved ${SPECIALIZED_SCRAPER_PROVIDER_META[provider].label} key (encrypted in database).`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to save scraper API key."
      );
    } finally {
      setSavingProvider(null);
    }
  };

  const handleRemove = async (provider: SpecializedScraperProvider) => {
    setErrorMessage(null);
    setStatusMessage(null);
    setSavingProvider(provider);
    try {
      await onDeleteKey(provider);
      setStatusMessage(
        `Removed workspace override for ${SPECIALIZED_SCRAPER_PROVIDER_META[provider].label}.`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Failed to remove workspace API key."
      );
    } finally {
      setSavingProvider(null);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#65676b] dark:text-[#8696a0]">
        Specialized platforms (<strong>X / Twitter</strong>,{" "}
        <strong>LinkedIn</strong>, and <strong>Telegram</strong>) require
        official API keys to scrape via their preferred APIs instead of being
        blocked by login walls. Keys saved here are encrypted at rest and
        override <code className="font-mono">.env</code> defaults.
      </p>

      <div aria-live="polite" className="space-y-2">
        {errorMessage && (
          <div
            role="alert"
            className="rounded-xl bg-rose-500/12 border border-rose-500/30 px-3 py-2 text-xs text-rose-700 dark:text-rose-300 font-medium"
          >
            {errorMessage}
          </div>
        )}
        {statusMessage && (
          <div
            role="status"
            className="rounded-xl bg-emerald-500/12 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 font-medium"
          >
            {statusMessage}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {SPECIALIZED_SCRAPER_PROVIDERS.map((provider) => {
          const meta = SPECIALIZED_SCRAPER_PROVIDER_META[provider];
          const status = statusByProvider.get(provider);
          const isConfigured = status?.configured ?? false;
          const isWorkspace = status?.source === "workspace";
          const inputId = `${baseId}-${provider}-key`;
          const isBusy = savingProvider === provider;
          const isShown = Boolean(revealed[provider]);

          return (
            <div
              key={provider}
              className="rounded-xl border border-[#e4e6eb] dark:border-[#2a3942] bg-[#f0f2f5]/60 dark:bg-[#111b21] p-3.5 space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-[#050505] dark:text-[#e9edef]">
                      {meta.label}
                    </span>
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
                          <span>
                            Configured ({status?.source === "workspace" ? "Workspace" : ".env"}{" "}
                            {status?.maskedKey ?? ""})
                          </span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-3 h-3" aria-hidden="true" />
                          <span>API Key Needed ({meta.envVar})</span>
                        </>
                      )}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#65676b] dark:text-[#8696a0]">
                    Preferred method: {meta.preferredMethod}
                  </p>
                </div>

                <a
                  href={meta.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0084ff] hover:underline shrink-0"
                >
                  <span>API Docs</span>
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              </div>

              {canEdit ? (
                <form
                  method="post"
                  onSubmit={(e) => void handleSave(e, provider)}
                  noValidate
                  className="flex flex-col sm:flex-row sm:items-end gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <label
                      htmlFor={inputId}
                      className="block text-[11px] font-semibold text-[#65676b] dark:text-[#8696a0] mb-1"
                    >
                      {isConfigured
                        ? `Replace ${meta.shortLabel} API Token`
                        : `Enter ${meta.shortLabel} API Token (${meta.envVar})`}
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id={inputId}
                        name={`${provider}-api-key`}
                        type={isShown ? "text" : "password"}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        value={draftKeys[provider] ?? ""}
                        onChange={(e) =>
                          setDraftKeys((prev) => ({
                            ...prev,
                            [provider]: e.target.value,
                          }))
                        }
                        placeholder={
                          isConfigured
                            ? `Saved (${status?.maskedKey ?? "configured"}) — paste new key to override`
                            : `Paste ${meta.envVar}...`
                        }
                        className="w-full pr-9 pl-3 py-1.5 text-xs font-mono rounded-lg bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] border border-[#e4e6eb] dark:border-[#2a3942] outline-none"
                      />
                      <button
                        type="button"
                        aria-pressed={isShown}
                        aria-label={
                          isShown
                            ? `Hide ${meta.shortLabel} token`
                            : `Show ${meta.shortLabel} token`
                        }
                        onClick={() =>
                          setRevealed((prev) => ({
                            ...prev,
                            [provider]: !prev[provider],
                          }))
                        }
                        className="absolute right-2 p-1 text-[#65676b] dark:text-[#8696a0] hover:text-[#050505] dark:hover:text-white cursor-pointer"
                      >
                        {isShown ? (
                          <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="submit"
                      disabled={isBusy}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] disabled:opacity-50 text-white transition cursor-pointer"
                    >
                      {isBusy ? "Saving..." : "Save Key"}
                    </button>

                    {isWorkspace && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleRemove(provider)}
                        title="Remove workspace override key"
                        aria-label={`Remove saved ${meta.shortLabel} API key`}
                        className="p-1.5 rounded-lg bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-50 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </form>
              ) : (
                <p className="text-[11px] text-[#65676b] dark:text-[#8696a0]">
                  {isConfigured
                    ? `Ready for specialized scraping via ${meta.preferredMethod}.`
                    : `API key required: ask an Admin or BD Manager to configure ${meta.envVar} in Global Settings or .env.`}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
