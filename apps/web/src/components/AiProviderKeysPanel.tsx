"use client";

import React, { useId, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  AI_PROVIDERS,
  AI_PROVIDER_META,
  type AiConfigurationSummary,
  type AiProvider,
  type UpdateAiProviderConfigDto,
} from "@/types/project";
import { apiClient } from "@/services/apiClient";

interface AiProviderKeysPanelProps {
  aiConfig: AiConfigurationSummary | undefined;
  canEdit: boolean;
  onSaveConfig: (
    params: { provider: AiProvider } & UpdateAiProviderConfigDto
  ) => Promise<unknown>;
  onActivateProvider: (params: {
    provider: AiProvider;
    selectedModel?: string;
  }) => Promise<unknown>;
  onDeleteKey: (provider: AiProvider) => Promise<unknown>;
}

const CUSTOM_MODEL_OPTION = "__custom__";

export function AiProviderKeysPanel({
  aiConfig,
  canEdit,
  onSaveConfig,
  onActivateProvider,
  onDeleteKey,
}: AiProviderKeysPanelProps) {
  const baseId = useId();
  const [draftKeys, setDraftKeys] = useState<Partial<Record<AiProvider, string>>>(
    {}
  );
  const [revealed, setRevealed] = useState<Partial<Record<AiProvider, boolean>>>(
    {}
  );
  const [liveModels, setLiveModels] = useState<
    Partial<Record<AiProvider, string[]>>
  >({});
  const [customModelMode, setCustomModelMode] = useState<
    Partial<Record<AiProvider, boolean>>
  >({});
  const [customModelDraft, setCustomModelDraft] = useState<
    Partial<Record<AiProvider, string>>
  >({});
  const [busyProvider, setBusyProvider] = useState<AiProvider | null>(null);
  const [refreshingModelsFor, setRefreshingModelsFor] =
    useState<AiProvider | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const statusByProvider = new Map(
    (aiConfig?.providers ?? []).map((item) => [item.provider, item])
  );

  const activeProviderMeta = aiConfig?.activeProvider
    ? AI_PROVIDER_META[aiConfig.activeProvider]
    : null;

  const handleSaveKey = async (
    e: React.FormEvent<HTMLFormElement>,
    provider: AiProvider
  ) => {
    e.preventDefault();
    const token = (draftKeys[provider] ?? "").trim();
    if (!token) {
      setErrorMessage(
        `Please enter a valid ${AI_PROVIDER_META[provider].shortLabel} API key.`
      );
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setBusyProvider(provider);
    try {
      await onSaveConfig({ provider, apiKey: token });
      setDraftKeys((prev) => ({ ...prev, [provider]: "" }));
      setStatusMessage(
        `Saved ${AI_PROVIDER_META[provider].label} API key (encrypted in database).`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to save AI provider API key."
      );
    } finally {
      setBusyProvider(null);
    }
  };

  const handleSelectModel = async (provider: AiProvider, model: string) => {
    if (model === CUSTOM_MODEL_OPTION) {
      const current =
        statusByProvider.get(provider)?.selectedModel ??
        AI_PROVIDER_META[provider].defaultModel;
      setCustomModelDraft((prev) => ({ ...prev, [provider]: current }));
      setCustomModelMode((prev) => ({ ...prev, [provider]: true }));
      return;
    }

    setCustomModelMode((prev) => ({ ...prev, [provider]: false }));
    setErrorMessage(null);
    setStatusMessage(null);
    setBusyProvider(provider);
    try {
      await onSaveConfig({ provider, selectedModel: model });
      setStatusMessage(
        `Updated ${AI_PROVIDER_META[provider].shortLabel} model to ${model}.`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to update AI model."
      );
    } finally {
      setBusyProvider(null);
    }
  };

  const handleSaveCustomModel = async (provider: AiProvider) => {
    const model = (customModelDraft[provider] ?? "").trim();
    if (!model) {
      setErrorMessage("Please enter a model ID.");
      return;
    }
    setErrorMessage(null);
    setStatusMessage(null);
    setBusyProvider(provider);
    try {
      await onSaveConfig({ provider, selectedModel: model });
      setCustomModelMode((prev) => ({ ...prev, [provider]: false }));
      setStatusMessage(
        `Updated ${AI_PROVIDER_META[provider].shortLabel} model to ${model}.`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to update AI model."
      );
    } finally {
      setBusyProvider(null);
    }
  };

  const handleActivate = async (provider: AiProvider) => {
    setErrorMessage(null);
    setStatusMessage(null);
    setBusyProvider(provider);
    try {
      await onActivateProvider({ provider });
      setStatusMessage(
        `${AI_PROVIDER_META[provider].label} is now the active AI chat provider.`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to switch active AI provider."
      );
    } finally {
      setBusyProvider(null);
    }
  };

  const handleRemoveKey = async (provider: AiProvider) => {
    setErrorMessage(null);
    setStatusMessage(null);
    setBusyProvider(provider);
    try {
      await onDeleteKey(provider);
      setStatusMessage(
        `Removed workspace API key for ${AI_PROVIDER_META[provider].label}.`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to remove workspace API key."
      );
    } finally {
      setBusyProvider(null);
    }
  };

  const handleRefreshModels = async (provider: AiProvider) => {
    setErrorMessage(null);
    setStatusMessage(null);
    setRefreshingModelsFor(provider);
    try {
      const res = await apiClient.fetchAiProviderModels(provider);
      setLiveModels((prev) => ({ ...prev, [provider]: res.models }));
      setStatusMessage(
        res.source === "live"
          ? `Loaded ${res.models.length} live models from ${AI_PROVIDER_META[provider].shortLabel}.`
          : `Showing ${res.models.length} recommended models for ${AI_PROVIDER_META[provider].shortLabel}.`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to fetch provider models."
      );
    } finally {
      setRefreshingModelsFor(null);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Active Provider Summary Banner */}
      {aiConfig?.hasConfiguredProvider && activeProviderMeta ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200">
            <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              Active Chat Provider:{" "}
              <strong>{activeProviderMeta.label}</strong> · Model:{" "}
              <code className="font-mono font-semibold">
                {aiConfig.activeModel || activeProviderMeta.defaultModel}
              </code>
            </span>
          </div>
          <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            Ready for multi-turn AI chat
          </span>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/12 px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
          <KeyRound className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <strong>API Key Required:</strong> No AI provider API key is
            configured yet. Add a{" "}
            <strong>Google AI Studio (Gemini)</strong> key or another provider
            key below to enable the AI chatbot.
          </div>
        </div>
      )}

      <p className="text-xs text-[#65676b] dark:text-[#8696a0]">
        Configure API keys and select models for supported AI providers. Keys
        saved here are encrypted at rest with AES-256-GCM and override{" "}
        <code className="font-mono">.env</code> defaults.
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
        {AI_PROVIDERS.map((provider) => {
          const meta = AI_PROVIDER_META[provider];
          const status = statusByProvider.get(provider);
          const isConfigured = status?.configured ?? false;
          const isWorkspace = status?.source === "workspace";
          const isActive = status?.isActive ?? false;
          const selectedModel = status?.selectedModel || meta.defaultModel;
          const availableModels = Array.from(
            new Set([
              ...(liveModels[provider] ?? meta.recommendedModels),
              ...(selectedModel ? [selectedModel] : []),
            ])
          );

          const keyInputId = `${baseId}-${provider}-api-key`;
          const modelSelectId = `${baseId}-${provider}-model`;
          const customModelInputId = `${baseId}-${provider}-custom-model`;
          const isBusy = busyProvider === provider;
          const isRefreshing = refreshingModelsFor === provider;
          const isShown = Boolean(revealed[provider]);
          const isCustomMode = Boolean(customModelMode[provider]);

          return (
            <div
              key={provider}
              className={`rounded-xl border p-3.5 space-y-3 transition ${
                isActive
                  ? "border-[#0084ff]/50 bg-[#e7f3ff]/40 dark:bg-[#0084ff]/10"
                  : "border-[#e4e6eb] dark:border-[#2a3942] bg-[#f0f2f5]/60 dark:bg-[#111b21]"
              }`}
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Bot
                      className="w-4 h-4 text-[#0084ff] shrink-0"
                      aria-hidden="true"
                    />
                    <span className="text-xs font-bold text-[#050505] dark:text-[#e9edef]">
                      {meta.label}
                    </span>

                    {isActive && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0084ff] text-white">
                        Active Provider
                      </span>
                    )}

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
                            Configured (
                            {status?.source === "workspace" ? "Workspace" : ".env"}{" "}
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
                    {meta.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {canEdit && !isActive && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleActivate(provider)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] hover:border-[#0084ff] text-[#0084ff] disabled:opacity-50 transition cursor-pointer"
                    >
                      Use as Active
                    </button>
                  )}

                  <a
                    href={meta.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0084ff] hover:underline shrink-0"
                  >
                    <span>Get Key</span>
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                </div>
              </div>

              {/* Model Selector */}
              <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                <div className="flex-1 min-w-0">
                  <label
                    htmlFor={modelSelectId}
                    className="block text-[11px] font-semibold text-[#65676b] dark:text-[#8696a0] mb-1"
                  >
                    Model
                  </label>
                  <div className="flex items-center gap-1.5">
                    <select
                      id={modelSelectId}
                      disabled={!canEdit || isBusy}
                      value={isCustomMode ? CUSTOM_MODEL_OPTION : selectedModel}
                      onChange={(e) =>
                        void handleSelectModel(provider, e.target.value)
                      }
                      className="flex-1 min-w-0 px-3 py-1.5 text-xs font-mono rounded-lg bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] border border-[#e4e6eb] dark:border-[#2a3942] outline-none disabled:opacity-60"
                    >
                      {availableModels.map((modelId) => (
                        <option key={modelId} value={modelId}>
                          {modelId}
                        </option>
                      ))}
                      {canEdit && (
                        <option value={CUSTOM_MODEL_OPTION}>
                          Custom model ID...
                        </option>
                      )}
                    </select>

                    {canEdit && isConfigured && (
                      <button
                        type="button"
                        disabled={isRefreshing || isBusy}
                        onClick={() => void handleRefreshModels(provider)}
                        title={`Fetch live models from ${meta.shortLabel}`}
                        aria-label={`Refresh models for ${meta.shortLabel}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] disabled:opacity-50 transition cursor-pointer shrink-0"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                          aria-hidden="true"
                        />
                        <span className="hidden sm:inline">Fetch Models</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {isCustomMode && canEdit && (
                <div className="flex items-center gap-2">
                  <label htmlFor={customModelInputId} className="sr-only">
                    Custom model ID for {meta.shortLabel}
                  </label>
                  <input
                    id={customModelInputId}
                    type="text"
                    value={customModelDraft[provider] ?? ""}
                    onChange={(e) =>
                      setCustomModelDraft((prev) => ({
                        ...prev,
                        [provider]: e.target.value,
                      }))
                    }
                    placeholder={`Enter custom ${meta.shortLabel} model ID...`}
                    className="flex-1 px-3 py-1.5 text-xs font-mono rounded-lg bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] border border-[#e4e6eb] dark:border-[#2a3942] outline-none"
                  />
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleSaveCustomModel(provider)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] disabled:opacity-50 text-white transition cursor-pointer"
                  >
                    Apply Model
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCustomModelMode((prev) => ({
                        ...prev,
                        [provider]: false,
                      }))
                    }
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#65676b] dark:text-[#8696a0] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* API Key Input Form */}
              {canEdit ? (
                <form
                  method="post"
                  onSubmit={(e) => void handleSaveKey(e, provider)}
                  noValidate
                  className="flex flex-col sm:flex-row sm:items-end gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <label
                      htmlFor={keyInputId}
                      className="block text-[11px] font-semibold text-[#65676b] dark:text-[#8696a0] mb-1"
                    >
                      {isConfigured
                        ? `Replace ${meta.shortLabel} API Key`
                        : `Enter ${meta.shortLabel} API Key (${meta.envVar})`}
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id={keyInputId}
                        name={`${provider}-ai-api-key`}
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
                            ? `Hide ${meta.shortLabel} key`
                            : `Show ${meta.shortLabel} key`
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
                        onClick={() => void handleRemoveKey(provider)}
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
                    ? `Configured with model ${selectedModel}.`
                    : `API key required: ask a Workspace Admin to configure ${meta.envVar} in Admin Dashboard → AI Providers.`}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
