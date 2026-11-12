"use client";

import React, { useId, useState, type RefObject } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  AlertTriangle,
  CheckCircle2,
  CloudDownload,
  Globe,
  KeyRound,
  RefreshCw,
} from "lucide-react";
import {
  SYNC_PROVIDERS,
  SYNC_PROVIDER_META,
  type SyncProjectsDto,
  type SyncProjectsResponse,
  type SyncProvider,
  type SyncProviderStatus,
} from "@/types/project";
import { ModalDialog } from "@/components/ui";

interface SyncProjectsDialogProps {
  dialogRef: RefObject<HTMLDialogElement | null>;
  providerStatuses?: SyncProviderStatus[];
  onSyncProjects: (dto: SyncProjectsDto) => Promise<SyncProjectsResponse>;
}

const BATCH_SIZE_OPTIONS = [5, 10, 15] as const;

export function SyncProjectsDialog({
  dialogRef,
  providerStatuses = [],
  onSyncProjects,
}: SyncProjectsDialogProps) {
  const providerPrefixId = useId();
  const limitPrefixId = useId();
  const [syncError, setSyncError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = useForm<SyncProjectsDto>({
    defaultValues: {
      provider: "coingecko",
      limit: 5,
    },
  });

  const selectedProvider =
    (useWatch({ control, name: "provider" }) as SyncProvider | undefined) ??
    "coingecko";
  const selectedLimit = Number(useWatch({ control, name: "limit" }) ?? 5);

  const statusMap = new Map<SyncProvider, SyncProviderStatus>(
    providerStatuses.map((s) => [s.id, s])
  );

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    void handleSubmit(async (values) => {
      setSyncError(null);
      try {
        await onSyncProjects({
          provider: values.provider,
          limit: Number(values.limit) || 5,
        });
        dialogRef.current?.close();
      } catch (err) {
        setSyncError(
          err instanceof Error
            ? err.message
            : "Failed to sync projects from the selected provider."
        );
      }
    })(e);
  };

  return (
    <ModalDialog
      dialogRef={dialogRef}
      title="Sync Crypto Projects"
      subtitle="Import market-cap ranked crypto projects into the New state with Website, X, and LinkedIn context links."
      maxWidthClass="max-w-lg"
    >
      <form
        method="post"
        onSubmit={handleFormSubmit}
        noValidate
        className="space-y-4 mt-4"
      >
        <div aria-live="polite">
          {syncError && (
            <div
              role="alert"
              className="rounded-xl bg-rose-500/12 border border-rose-500/30 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300 font-medium flex items-start gap-2"
            >
              <AlertTriangle
                className="w-4 h-4 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>{syncError}</span>
            </div>
          )}
        </div>

        <fieldset className="space-y-2.5">
          <legend className="text-xs font-bold uppercase tracking-wider text-[#65676b] dark:text-[#8696a0] mb-1.5">
            Select Market Cap Provider <span aria-hidden="true">*</span>
          </legend>

          <div className="space-y-2">
            {SYNC_PROVIDERS.map((providerKey, index) => {
              const meta = SYNC_PROVIDER_META[providerKey];
              const status = statusMap.get(providerKey);
              const isConfigured = status?.configured ?? false;
              const isSelected = selectedProvider === providerKey;
              const radioId = `${providerPrefixId}-${providerKey}`;
              const descId = `${providerPrefixId}-${providerKey}-desc`;

              return (
                <div
                  key={providerKey}
                  className={`rounded-xl border p-3 transition ${
                    isSelected
                      ? "border-[#0084ff] bg-[#e7f3ff]/40 dark:bg-[#0084ff]/10"
                      : "border-[#e4e6eb] dark:border-[#2a3942] bg-[#f0f2f5]/60 dark:bg-[#111b21]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <input
                        id={radioId}
                        type="radio"
                        value={providerKey}
                        autoFocus={index === 0}
                        aria-describedby={descId}
                        {...register("provider", {
                          onChange: () => setSyncError(null),
                        })}
                        className="checkbox-native"
                      />
                      <label
                        htmlFor={radioId}
                        className="text-xs sm:text-sm font-bold text-[#050505] dark:text-[#e9edef] cursor-pointer"
                      >
                        {meta.label}
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
                          <span>API Key Ready</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-3 h-3" aria-hidden="true" />
                          <span>Requires {meta.envVar}</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div
                    id={descId}
                    className="pl-6 mt-1.5 space-y-1 text-[11px] text-[#65676b] dark:text-[#8696a0]"
                  >
                    <p>{meta.description}</p>
                    <div className="flex items-center gap-2 flex-wrap font-mono text-[10px]">
                      <span className="px-1.5 py-0.5 rounded bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] text-[#050505] dark:text-[#e9edef]">
                        .env: {meta.envVar}
                      </span>
                      <span>•</span>
                      <span>{meta.freeTierNote}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="space-y-2 pt-1">
          <legend className="text-xs font-bold uppercase tracking-wider text-[#65676b] dark:text-[#8696a0] mb-1">
            Projects to Sync (Batch Limit)
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {BATCH_SIZE_OPTIONS.map((size) => {
              const limitRadioId = `${limitPrefixId}-${size}`;
              const isSelected = selectedLimit === size;
              return (
                <div
                  key={size}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 border transition ${
                    isSelected
                      ? "border-[#0084ff] bg-[#e7f3ff]/40 dark:bg-[#0084ff]/10"
                      : "border-[#e4e6eb] dark:border-[#2a3942] bg-[#f0f2f5]/60 dark:bg-[#111b21]"
                  }`}
                >
                  <input
                    id={limitRadioId}
                    type="radio"
                    value={size}
                    {...register("limit", { valueAsNumber: true })}
                    className="checkbox-native"
                  />
                  <label
                    htmlFor={limitRadioId}
                    className="text-xs font-semibold cursor-pointer"
                  >
                    Top {size} projects
                  </label>
                </div>
              );
            })}
          </div>
        </fieldset>

        <div className="rounded-xl bg-[#f0f2f5] dark:bg-[#111b21] border border-[#e4e6eb] dark:border-[#2a3942] p-3 text-[11px] text-[#65676b] dark:text-[#8696a0] flex items-start gap-2.5">
          <Globe
            className="w-4 h-4 text-[#0084ff] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            New projects are placed in the{" "}
            <strong className="text-[#050505] dark:text-[#e9edef]">New</strong>{" "}
            pipeline status with active context links for{" "}
            <strong className="text-[#050505] dark:text-[#e9edef]">
              Official Website
            </strong>
            ,{" "}
            <strong className="text-[#050505] dark:text-[#e9edef]">
              X (Twitter)
            </strong>
            , and{" "}
            <strong className="text-[#050505] dark:text-[#e9edef]">
              LinkedIn
            </strong>
            . Existing projects are automatically skipped.
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e4e6eb] dark:border-[#2a3942]">
          <button
            type="button"
            onClick={() => {
              setSyncError(null);
              dialogRef.current?.close();
            }}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-[#65676b] dark:text-[#8696a0] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] disabled:opacity-50 text-white transition cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw
                  className="w-3.5 h-3.5 animate-spin"
                  aria-hidden="true"
                />
                <span>Syncing Projects...</span>
              </>
            ) : (
              <>
                <CloudDownload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Sync Projects</span>
              </>
            )}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
