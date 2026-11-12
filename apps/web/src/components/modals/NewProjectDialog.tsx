"use client";

import React, { useId, useRef, useState, type RefObject } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Trash2, Upload } from "lucide-react";
import {
  BUSINESS_STATUS_META,
  CREATABLE_BUSINESS_STATUS_ORDER,
  PROJECT_CHAINS,
  PROJECT_STAGES,
  SOLID_AVATAR_COLORS,
  newProjectFormSchema,
  type NewProjectFormValues,
} from "@/types/project";
import { ProjectAvatar } from "@/components/ProjectAvatar";
import { FormField, ModalDialog } from "@/components/ui";
import { readFileAsDataUrl } from "@/lib/file-utils";

interface NewProjectDialogProps {
  dialogRef: RefObject<HTMLDialogElement | null>;
  onCreateProject: (values: NewProjectFormValues) => Promise<void> | void;
}

const DEFAULT_VALUES: NewProjectFormValues = {
  name: "",
  ticker: "",
  chain: "Solana",
  stage: "Pre-TGE",
  businessStatus: "new",
  tagline: "",
  logoUrl: "",
  website: "",
  xHandle: "",
  linkedin: "",
};

export function NewProjectDialog({
  dialogRef,
  onCreateProject,
}: NewProjectDialogProps) {
  const newLogoFileId = useId();
  const newLogoUrlId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<NewProjectFormValues>({
    resolver: zodResolver(newProjectFormSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: DEFAULT_VALUES,
  });

  const watchedName = useWatch({ control, name: "name" }) ?? "";
  const watchedTicker = useWatch({ control, name: "ticker" }) ?? "";
  const watchedChain = useWatch({ control, name: "chain" }) ?? "Solana";
  const watchedLogoUrl = useWatch({ control, name: "logoUrl" }) ?? "";

  const handleNewLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    readFileAsDataUrl(
      file,
      (dataUrl) => {
        setUploadedFileName(file.name);
        setValue("logoUrl", dataUrl, {
          shouldDirty: true,
          shouldValidate: true,
        });
      },
      (message) => {
        setUploadError(message);
      }
    );
    e.target.value = "";
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    void handleSubmit(async (values) => {
      await onCreateProject(values);
      reset(DEFAULT_VALUES);
      setUploadedFileName(null);
      setUploadError(null);
      dialogRef.current?.close();
    })(e);
  };

  const previewTicker = watchedTicker.trim()
    ? watchedTicker.trim().toUpperCase()
    : "$TKN";

  return (
    <ModalDialog
      dialogRef={dialogRef}
      title="New Project"
      maxWidthClass="max-w-lg"
    >
      <form onSubmit={handleFormSubmit} noValidate className="space-y-3 mt-4">
        <div aria-live="polite">
          {uploadError && (
            <div
              role="alert"
              className="rounded-xl bg-rose-500/12 border border-rose-500/30 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300 font-medium"
            >
              {uploadError}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 p-3 rounded-xl bg-[#f0f2f5] dark:bg-[#2a3942]">
          <ProjectAvatar
            project={{
              name: watchedName.trim() || "New Project",
              ticker: previewTicker,
              chain: watchedChain,
              avatarBg: SOLID_AVATAR_COLORS[0],
              logoUrl: watchedLogoUrl.trim() || undefined,
            }}
            size="lg"
            onEditClick={() => fileInputRef.current?.click()}
            decorative={false}
          />
          <div className="flex-1 min-w-0 w-full space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <input
                ref={fileInputRef}
                id={newLogoFileId}
                name="new-project-logo-file"
                type="file"
                accept="image/*"
                onChange={handleNewLogoFile}
                className="visually-hidden"
              />
              <label
                htmlFor={newLogoFileId}
                className="inline-flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] text-white transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Upload photo</span>
              </label>

              {watchedLogoUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setUploadedFileName(null);
                    setUploadError(null);
                    setValue("logoUrl", "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-black/5 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Remove</span>
                </button>
              )}

              <label htmlFor={newLogoUrlId} className="visually-hidden">
                Image URL
              </label>
              <input
                id={newLogoUrlId}
                name="new-project-logo-url"
                type="text"
                inputMode="url"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                value={watchedLogoUrl.startsWith("data:") ? "" : watchedLogoUrl}
                onChange={(e) => {
                  setUploadedFileName(null);
                  setValue("logoUrl", e.target.value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
                placeholder={
                  watchedLogoUrl.startsWith("data:")
                    ? "Custom photo uploaded"
                    : "Or paste image URL..."
                }
                className="flex-1 min-w-36 px-2.5 py-2 sm:py-1.5 text-xs rounded-lg bg-white dark:bg-[#202c33] outline-none"
              />
            </div>

            {uploadedFileName && (
              <div
                aria-live="polite"
                className="text-[11px] inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400"
              >
                <CheckCircle2
                  className="w-3.5 h-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span className="truncate">Loaded {uploadedFileName}</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <FormField
            label="Project Name"
            required
            error={errors.name}
            className="sm:col-span-2"
          >
            {(a11yProps) => (
              <input
                {...a11yProps}
                {...register("name")}
                type="text"
                required
                autoFocus
                placeholder="e.g., Hyperion ZK"
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
              />
            )}
          </FormField>

          <FormField label="Ticker" required error={errors.ticker}>
            {(a11yProps) => (
              <input
                {...a11yProps}
                {...register("ticker")}
                type="text"
                required
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="$HYPR"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
              />
            )}
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <FormField label="Chain" error={errors.chain}>
            {(a11yProps) => (
              <select
                {...a11yProps}
                {...register("chain")}
                className="w-full px-3 py-2 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
              >
                {PROJECT_CHAINS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <FormField label="Stage" error={errors.stage}>
            {(a11yProps) => (
              <select
                {...a11yProps}
                {...register("stage")}
                className="w-full px-3 py-2 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
              >
                {PROJECT_STAGES.map((stg) => (
                  <option key={stg} value={stg}>
                    {stg}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <FormField
            label="Initial Status"
            hint="Starts in New; becomes Active automatically on chat, scrape, or admin action."
            error={errors.businessStatus}
          >
            {(a11yProps) => (
              <select
                {...a11yProps}
                {...register("businessStatus")}
                className="w-full px-3 py-2 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
              >
                {CREATABLE_BUSINESS_STATUS_ORDER.map((statusKey) => (
                  <option key={statusKey} value={statusKey}>
                    {BUSINESS_STATUS_META[statusKey].label}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        </div>

        <FormField label="Description / Notes" error={errors.tagline}>
          {(a11yProps) => (
            <input
              {...a11yProps}
              {...register("tagline")}
              type="text"
              placeholder="Short project summary..."
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
            />
          )}
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          <FormField
            label="Website URL"
            srOnlyLabel
            error={errors.website}
          >
            {(a11yProps) => (
              <input
                {...a11yProps}
                {...register("website")}
                type="text"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="Website URL"
                className="w-full px-2.5 py-2 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
              />
            )}
          </FormField>

          <FormField label="X Handle" srOnlyLabel error={errors.xHandle}>
            {(a11yProps) => (
              <input
                {...a11yProps}
                {...register("xHandle")}
                type="text"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="@XHandle"
                className="w-full px-2.5 py-2 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
              />
            )}
          </FormField>

          <FormField label="LinkedIn URL" srOnlyLabel error={errors.linkedin}>
            {(a11yProps) => (
              <input
                {...a11yProps}
                {...register("linkedin")}
                type="text"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="LinkedIn URL"
                className="w-full px-2.5 py-2 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
              />
            )}
          </FormField>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-[#65676b] dark:text-[#8696a0] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] disabled:opacity-50 text-white transition cursor-pointer"
          >
            Create
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
