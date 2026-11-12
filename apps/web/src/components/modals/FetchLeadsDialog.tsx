"use client";

import React, { useState, type RefObject } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  CornerDownLeft,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Phone,
  RefreshCw,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import {
  LEAD_PROVIDERS,
  LEAD_PROVIDER_META,
  type CryptoProject,
  type FetchLeadsDto,
  type FetchLeadsResult,
  type LeadProvider,
  type LeadProviderStatus,
  type ProjectContextItem,
} from "@/types/project";
import { ModalDialog } from "@/components/ui";

interface FetchLeadsDialogProps {
  dialogRef: RefObject<HTMLDialogElement | null>;
  project: CryptoProject;
  providerStatuses: LeadProviderStatus[];
  canWriteSettings: boolean;
  canWriteContexts: boolean;
  isFetching: boolean;
  onSaveProviderKey: (params: {
    provider: LeadProvider;
    apiKey: string;
  }) => Promise<unknown>;
  onDeleteProviderKey: (provider: LeadProvider) => Promise<unknown>;
  onFetchLeads: (dto: FetchLeadsDto) => Promise<FetchLeadsResult>;
  onToggleContext?: (contextId: string) => void;
  onDeleteContext?: (contextId: string) => void;
  onReferenceInPrompt?: (ctx: ProjectContextItem) => void;
}

function inferDomain(project: CryptoProject): string {
  const website = project.contexts.find((c) => c.type === "website");
  const candidate = website?.url ?? website?.value ?? "";
  if (!candidate) return "";
  try {
    const parsed = new URL(
      candidate.includes("://") ? candidate : `https://${candidate}`
    );
    return parsed.hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

export function FetchLeadsDialog({
  dialogRef,
  project,
  providerStatuses,
  canWriteSettings,
  canWriteContexts,
  isFetching,
  onSaveProviderKey,
  onDeleteProviderKey,
  onFetchLeads,
  onToggleContext,
  onDeleteContext,
  onReferenceInPrompt,
}: FetchLeadsDialogProps) {
  const [mode, setMode] = useState<"list" | "fetch">("list");
  const [selectedProvider, setSelectedProvider] =
    useState<LeadProvider>("apollo");
  const [domain, setDomain] = useState(() => inferDomain(project));
  const [rolesText, setRolesText] = useState(
    "Founder, CEO, Head of BD, Partnerships, Marketing"
  );
  const [limit, setLimit] = useState(10);
  const [draftApiKey, setDraftApiKey] = useState("");
  const [revealKey, setRevealKey] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultBanner, setResultBanner] = useState<string | null>(null);

  const availableLeads = project.contexts.filter((c) => c.type === "lead");
  const statusMap = new Map(providerStatuses.map((s) => [s.provider, s]));
  const activeStatus = statusMap.get(selectedProvider);
  const activeMeta = LEAD_PROVIDER_META[selectedProvider];
  const needsKey =
    activeMeta.requiresApiKey && !(activeStatus?.configured ?? false);

  const handleSaveKey = async () => {
    const trimmed = draftApiKey.trim();
    if (!trimmed) {
      setErrorMessage(`Please enter your ${activeMeta.shortLabel} API key.`);
      return;
    }
    setErrorMessage(null);
    setIsSavingKey(true);
    try {
      await onSaveProviderKey({ provider: selectedProvider, apiKey: trimmed });
      setDraftApiKey("");
      setResultBanner(
        `Saved ${activeMeta.shortLabel} API key (encrypted in database). Ready to fetch leads!`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to save lead provider key."
      );
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleRemoveKey = async () => {
    setErrorMessage(null);
    setIsSavingKey(true);
    try {
      await onDeleteProviderKey(selectedProvider);
      setResultBanner(`Removed workspace key for ${activeMeta.shortLabel}.`);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to remove API key."
      );
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setResultBanner(null);

    if (needsKey) {
      setErrorMessage(
        `${activeMeta.label} requires an API key (${activeMeta.envVar}). Set the API key below or switch to Built-in Web Scraper.`
      );
      return;
    }

    const roles = rolesText
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);

    try {
      const res = await onFetchLeads({
        provider: selectedProvider,
        ...(domain.trim() ? { domain: domain.trim() } : {}),
        companyName: project.name,
        ...(roles.length > 0 ? { roles } : {}),
        limit,
      });
      setResultBanner(res.message);
      setMode("list");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to fetch leads."
      );
    }
  };

  return (
    <ModalDialog
      dialogRef={dialogRef}
      title={
        mode === "list"
          ? `Project Leads — ${project.name}`
          : `Fetch Leads — ${project.name}`
      }
      subtitle={
        mode === "list"
          ? "Available decision-maker contacts saved in Company Context, or fetch more from providers"
          : "Configure a provider if needed and gather contacts into Company Context"
      }
      maxWidthClass="max-w-xl"
      onClose={() => {
        setMode("list");
        setErrorMessage(null);
        setResultBanner(null);
      }}
    >
      <div className="mt-3 space-y-3.5">
        <div aria-live="polite" className="space-y-2">
          {errorMessage && (
            <div
              role="alert"
              className="rounded-xl bg-rose-500/12 border border-rose-500/30 px-3 py-2 text-xs text-rose-700 dark:text-rose-300 font-medium"
            >
              {errorMessage}
            </div>
          )}
          {resultBanner && (
            <div className="rounded-xl bg-emerald-500/12 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
              {resultBanner}
            </div>
          )}
        </div>

        {mode === "list" ? (
          <>
            {/* Top summary & Fetch Leads CTA */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#e4e6eb] dark:border-[#2a3942]">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#050505] dark:text-[#e9edef]">
                <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>
                  Available Leads ({availableLeads.length})
                </span>
              </div>

              {canWriteContexts && (
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setResultBanner(null);
                    setMode("fetch");
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] text-white transition cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Fetch leads</span>
                </button>
              )}
            </div>

            {availableLeads.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#ccd0d5] dark:border-[#2a3942] bg-[#f8f9fa] dark:bg-[#111b21]/60 p-6 text-center space-y-3">
                <div className="mx-auto w-10 h-10 rounded-full bg-indigo-500/12 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#050505] dark:text-[#e9edef]">
                    No leads gathered yet for {project.name}
                  </p>
                  <p className="text-xs text-[#65676b] dark:text-[#8696a0] max-w-sm mx-auto">
                    Fetch decision-makers, emails, LinkedIn profiles, and handles from
                    Apollo, Hunter, Snov, Lusha, or the Built-in Web Scraper.
                  </p>
                </div>
                {canWriteContexts && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setResultBanner(null);
                      setMode("fetch");
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] text-white transition cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Fetch leads</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-[52dvh] overflow-y-auto scroller pr-1">
                {availableLeads.map((ctx) => {
                  const pData = (ctx.scrapedMetadata?.platformData ?? {}) as Record<
                    string,
                    unknown
                  >;
                  const email =
                    typeof pData["email"] === "string" ? pData["email"] : undefined;
                  const phone =
                    typeof pData["phone"] === "string" ? pData["phone"] : undefined;
                  const role =
                    typeof pData["role"] === "string" ? pData["role"] : undefined;
                  const linkedinUrl =
                    typeof pData["linkedinUrl"] === "string"
                      ? pData["linkedinUrl"]
                      : undefined;
                  const xHandle =
                    typeof pData["xHandle"] === "string"
                      ? pData["xHandle"]
                      : undefined;
                  const confidence =
                    typeof pData["confidence"] === "number"
                      ? pData["confidence"]
                      : undefined;

                  return (
                    <div
                      key={ctx.id}
                      className={`p-3 rounded-xl border transition ${
                        ctx.isActive
                          ? "bg-[#f0f2f5]/80 dark:bg-[#2a3942]/60 border-[#e4e6eb] dark:border-[#2a3942]"
                          : "bg-[#f8f9fa]/60 dark:bg-[#111b21]/50 border-transparent opacity-65"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-[#050505] dark:text-[#e9edef] truncate">
                              {ctx.title}
                            </span>
                            {ctx.updatedAt && (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-500/12 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold">
                                {ctx.updatedAt}
                              </span>
                            )}
                            {confidence !== undefined && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold">
                                {confidence}%
                              </span>
                            )}
                          </div>
                          {role && (
                            <p className="mt-0.5 text-[11px] font-medium text-[#65676b] dark:text-[#d1d7db]">
                              {role}
                            </p>
                          )}
                        </div>

                        {canWriteContexts && onToggleContext && (
                          <button
                            type="button"
                            onClick={() => onToggleContext(ctx.id)}
                            title={ctx.isActive ? "Active in chat context" : "Muted from chat"}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 cursor-pointer transition ${
                              ctx.isActive
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                : "bg-slate-500/15 text-slate-600 dark:text-slate-300"
                            }`}
                          >
                            {ctx.isActive ? "Active" : "Muted"}
                          </button>
                        )}
                      </div>

                      <div className="mt-2 flex items-center gap-2.5 flex-wrap text-[11px]">
                        {email ? (
                          <a
                            href={`mailto:${email}`}
                            className="inline-flex items-center gap-1 text-[#0084ff] hover:underline font-medium"
                          >
                            <Mail className="w-3 h-3 shrink-0" />
                            <span>{email}</span>
                          </a>
                        ) : (
                          <span className="text-[#65676b] dark:text-[#8696a0] font-mono">
                            {ctx.value}
                          </span>
                        )}

                        {phone && (
                          <span className="inline-flex items-center gap-1 text-[#050505] dark:text-[#d1d7db]">
                            <Phone className="w-3 h-3 shrink-0 text-[#00a884]" />
                            <span>{phone}</span>
                          </span>
                        )}

                        {linkedinUrl && (
                          <a
                            href={linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#0084ff] hover:underline"
                          >
                            <span>LinkedIn</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}

                        {xHandle && (
                          <span className="text-[#65676b] dark:text-[#8696a0]">
                            X: {xHandle}
                          </span>
                        )}
                      </div>

                      {(onReferenceInPrompt || (canWriteContexts && onDeleteContext)) && (
                        <div className="mt-2 pt-1.5 border-t border-[#e4e6eb]/70 dark:border-[#3b4a54]/60 flex items-center justify-end gap-3 text-[11px]">
                          {onReferenceInPrompt && (
                            <button
                              type="button"
                              onClick={() => onReferenceInPrompt(ctx)}
                              className="inline-flex items-center gap-1 font-medium text-[#0084ff] hover:underline cursor-pointer"
                            >
                              <CornerDownLeft className="w-3 h-3" />
                              <span>Use in chat</span>
                            </button>
                          )}
                          {canWriteContexts && onDeleteContext && (
                            <button
                              type="button"
                              onClick={() => onDeleteContext(ctx.id)}
                              className="inline-flex items-center gap-1 font-medium text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Remove</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e4e6eb] dark:border-[#2a3942]">
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-[#65676b] hover:bg-[#f0f2f5] dark:text-[#d1d7db] dark:hover:bg-[#2a3942] transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="flex items-center justify-between gap-2 pb-1">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setMode("list");
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0084ff] hover:underline cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Leads ({availableLeads.length})</span>
              </button>
            </div>

            {/* Provider Selector */}
            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-[#050505] dark:text-[#e9edef]">
                Choose Lead Provider
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {LEAD_PROVIDERS.map((prov) => {
                  const meta = LEAD_PROVIDER_META[prov];
                  const st = statusMap.get(prov);
                  const isSelected = selectedProvider === prov;
                  const isReady = !meta.requiresApiKey || Boolean(st?.configured);

                  return (
                    <button
                      key={prov}
                      type="button"
                      onClick={() => {
                        setSelectedProvider(prov);
                        setErrorMessage(null);
                        setResultBanner(null);
                        setDraftApiKey("");
                      }}
                      className={`text-left p-2.5 rounded-xl border transition cursor-pointer ${
                        isSelected
                          ? "border-[#0084ff] bg-[#e7f3ff]/70 dark:bg-[#0084ff]/15"
                          : "border-[#e4e6eb] dark:border-[#2a3942] bg-[#f0f2f5]/60 dark:bg-[#2a3942]/50 hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-bold text-[#050505] dark:text-[#e9edef] truncate">
                          {meta.shortLabel}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                            isReady
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          }`}
                        >
                          {isReady ? (
                            <>
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>{meta.requiresApiKey ? "Ready" : "Built-in"}</span>
                            </>
                          ) : (
                            <>
                              <KeyRound className="w-2.5 h-2.5" />
                              <span>Key needed</span>
                            </>
                          )}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-[#65676b] dark:text-[#8696a0] line-clamp-2">
                        {meta.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Inline API Key Prompt / Management for Selected Provider */}
            {activeMeta.requiresApiKey && (
              <div
                className={`rounded-xl p-3 space-y-2 border ${
                  needsKey
                    ? "bg-amber-500/10 border-amber-500/35"
                    : "bg-[#f0f2f5] dark:bg-[#2a3942] border-transparent"
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#050505] dark:text-[#e9edef]">
                    <KeyRound className="w-3.5 h-3.5 text-[#0084ff]" />
                    <span>
                      {activeMeta.label} API Key (
                      <code className="font-mono text-[11px]">{activeMeta.envVar}</code>)
                    </span>
                  </div>
                  {activeMeta.docsUrl && (
                    <a
                      href={activeMeta.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0084ff] hover:underline"
                    >
                      <span>API Docs</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {activeStatus?.configured ? (
                  <div className="flex items-center justify-between gap-2 text-[11px] text-emerald-700 dark:text-emerald-300">
                    <span>
                      Configured ({activeStatus.source}):{" "}
                      <code className="font-mono">{activeStatus.maskedKey}</code>
                    </span>
                    {canWriteSettings && activeStatus.source === "workspace" && (
                      <button
                        type="button"
                        disabled={isSavingKey}
                        onClick={() => void handleRemoveKey()}
                        className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove key</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-800 dark:text-amber-300">
                    API key required to query {activeMeta.shortLabel}.{" "}
                    {canWriteSettings
                      ? "Enter your key below to save it encrypted in your workspace."
                      : "Ask a Workspace Manager or Admin to configure this provider key."}
                  </p>
                )}

                {canWriteSettings && (
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type={revealKey ? "text" : "password"}
                        value={draftApiKey}
                        onChange={(e) => setDraftApiKey(e.target.value)}
                        placeholder={
                          activeStatus?.configured
                            ? `Replace ${activeMeta.shortLabel} API key...`
                            : activeMeta.keyPlaceholder
                        }
                        className="w-full pl-3 pr-8 py-1.5 text-xs rounded-lg bg-white dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setRevealKey((v) => !v)}
                        aria-label={revealKey ? "Hide API key" : "Show API key"}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#65676b] hover:text-[#050505] dark:hover:text-white cursor-pointer"
                      >
                        {revealKey ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={isSavingKey || !draftApiKey.trim()}
                      onClick={() => void handleSaveKey()}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-50 text-white transition cursor-pointer shrink-0"
                    >
                      {isSavingKey ? "Saving..." : "Save Key"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Query Parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-[#65676b] dark:text-[#8696a0] mb-1">
                  Target Company Domain
                </label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="e.g., irisnet.org"
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#65676b] dark:text-[#8696a0] mb-1">
                  Max Contacts
                </label>
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] outline-none"
                >
                  {[5, 10, 15, 25].map((n) => (
                    <option key={n} value={n}>
                      Up to {n} leads
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#65676b] dark:text-[#8696a0] mb-1">
                Target Roles / Titles (comma-separated)
              </label>
              <input
                type="text"
                value={rolesText}
                onChange={(e) => setRolesText(e.target.value)}
                placeholder="Founder, CEO, Head of BD, Partnerships, Marketing"
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e4e6eb] dark:border-[#2a3942]">
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-[#65676b] hover:bg-[#f0f2f5] dark:text-[#d1d7db] dark:hover:bg-[#2a3942] transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={isFetching}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] disabled:opacity-50 text-white transition cursor-pointer"
              >
                {isFetching ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <UserPlus className="w-3.5 h-3.5" />
                )}
                <span>
                  {isFetching
                    ? "Fetching Leads..."
                    : `Fetch Leads (${activeMeta.shortLabel})`}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </ModalDialog>
  );
}
