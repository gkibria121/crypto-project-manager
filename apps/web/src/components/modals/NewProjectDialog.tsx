"use client";

import React, { useId, type RefObject } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Upload } from "lucide-react";
import {
  BUSINESS_STATUS_META,
  BUSINESS_STATUS_ORDER,
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
  onCreateProject: (values: NewProjectFormValues) => void;
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
    readFileAsDataUrl(file, (dataUrl) => {
      setValue("logoUrl", dataUrl, { shouldDirty: true, shouldValidate: true });
    });
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    void handleSubmit((values) => {
      onCreateProject(values);
      reset(DEFAULT_VALUES);
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
            decorative
          />
          <div className="flex-1 min-w-0 w-full">
            <div className="flex items-center gap-2 flex-wrap">
              <input
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
                <Upload className="w-3.5 h-3.5" />
                <span>Upload photo</span>
              </label>

              <label htmlFor={newLogoUrlId} className="sr-only">
                Image URL
              </label>
              <input
                id={newLogoUrlId}
                name="new-project-logo-url"
                type="url"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={watchedLogoUrl.startsWith("data:") ? "" : watchedLogoUrl}
                onChange={(e) =>
                  setValue("logoUrl", e.target.value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                placeholder="Or paste image URL..."
                className="flex-1 min-w-36 px-2.5 py-2 sm:py-1.5 text-xs rounded-lg bg-white dark:bg-[#202c33] outline-none"
              />
            </div>
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
                autoCapitalize="off"
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

          <FormField label="Status" error={errors.businessStatus}>
            {(a11yProps) => (
              <select
                {...a11yProps}
                {...register("businessStatus")}
                className="w-full px-3 py-2 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
              >
                {BUSINESS_STATUS_ORDER.map((statusKey) => (
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
                autoCapitalize="off"
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
                autoCapitalize="off"
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
                autoCapitalize="off"
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
