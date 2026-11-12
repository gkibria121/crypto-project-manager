"use client";

import React, {
  useEffect,
  useId,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Trash2, Upload } from "lucide-react";
import {
  BUSINESS_STATUS_META,
  BUSINESS_STATUS_ORDER,
  PROJECT_CHAINS,
  PROJECT_STAGES,
  SOLID_AVATAR_COLORS,
  updateProjectFormSchema,
  type CryptoProject,
  type UpdateProjectFormValues,
} from "@/types/project";
import {
  PRESET_PROJECT_LOGOS,
  ProjectAvatar,
} from "@/components/ProjectAvatar";
import { FormField, ModalDialog } from "@/components/ui";
import { readFileAsDataUrl } from "@/lib/file-utils";

interface EditProjectDialogProps {
  dialogRef: RefObject<HTMLDialogElement | null>;
  project: CryptoProject | null;
  onUpdateProject: (
    projectId: string,
    values: UpdateProjectFormValues
  ) => Promise<void> | void;
}

const AVATAR_COLOR_LABELS: Record<string, string> = {
  "bg-[#1d4ed8]": "Royal Blue",
  "bg-[#00a884]": "Emerald",
  "bg-[#0f172a]": "Midnight Slate",
  "bg-[#334155]": "Graphite",
  "bg-[#0369a1]": "Ocean Cyan",
};

function buildFormValuesFromProject(
  project: CryptoProject | null
): UpdateProjectFormValues {
  if (!project) {
    return {
      name: "",
      ticker: "",
      chain: "Solana",
      stage: "Pre-TGE",
      businessStatus: "new",
      tagline: "",
      campaignBudget: "$25,000 / mo",
      sentimentScore: 90,
      isPinned: false,
      avatarBg: SOLID_AVATAR_COLORS[0],
      logoUrl: "",
      website: "",
      xHandle: "",
      linkedin: "",
      telegram: "",
    };
  }

  const websiteCtx = project.contexts.find((c) => c.type === "website");
  const xCtx = project.contexts.find((c) => c.type === "x_handle");
  const linkedinCtx = project.contexts.find((c) => c.type === "linkedin");
  const telegramCtx = project.contexts.find((c) => c.type === "telegram");

  return {
    name: project.name,
    ticker: project.ticker,
    chain: project.chain,
    stage: project.stage,
    businessStatus: project.businessStatus,
    tagline: project.tagline,
    campaignBudget: project.campaignBudget,
    sentimentScore: project.sentimentScore,
    isPinned: Boolean(project.isPinned),
    avatarBg: project.avatarBg || SOLID_AVATAR_COLORS[0],
    logoUrl: project.logoUrl ?? "",
    website: websiteCtx?.value ?? "",
    xHandle: xCtx?.value ?? "",
    linkedin: linkedinCtx?.value ?? "",
    telegram: telegramCtx?.value ?? "",
  };
}

export function EditProjectDialog({
  dialogRef,
  project,
  onUpdateProject,
}: EditProjectDialogProps) {
  const editLogoFileId = useId();
  const isPinnedCheckboxId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentProjectId = project?.id ?? "";
  const [uploadMeta, setUploadMeta] = useState<{
    projectId: string;
    fileName: string | null;
    uploadError: string | null;
    submitError: string | null;
  }>({
    projectId: "",
    fileName: null,
    uploadError: null,
    submitError: null,
  });

  const uploadedFileName =
    uploadMeta.projectId === currentProjectId ? uploadMeta.fileName : null;
  const uploadError =
    uploadMeta.projectId === currentProjectId ? uploadMeta.uploadError : null;
  const submitError =
    uploadMeta.projectId === currentProjectId ? uploadMeta.submitError : null;

  const setUploadedFileName = (fileName: string | null) =>
    setUploadMeta((prev) => ({
      ...(prev.projectId === currentProjectId
        ? prev
        : { fileName: null, uploadError: null, submitError: null }),
      projectId: currentProjectId,
      fileName,
    }));

  const setUploadError = (error: string | null) =>
    setUploadMeta((prev) => ({
      ...(prev.projectId === currentProjectId
        ? prev
        : { fileName: null, uploadError: null, submitError: null }),
      projectId: currentProjectId,
      uploadError: error,
    }));

  const setSubmitError = (error: string | null) =>
    setUploadMeta((prev) => ({
      ...(prev.projectId === currentProjectId
        ? prev
        : { fileName: null, uploadError: null, submitError: null }),
      projectId: currentProjectId,
      submitError: error,
    }));

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProjectFormValues>({
    resolver: zodResolver(updateProjectFormSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: buildFormValuesFromProject(project),
  });

  useEffect(() => {
    reset(buildFormValuesFromProject(project));
  }, [project, reset]);

  const watchedName = useWatch({ control, name: "name" }) ?? "";
  const watchedTicker = useWatch({ control, name: "ticker" }) ?? "";
  const watchedChain = useWatch({ control, name: "chain" }) ?? "Solana";
  const watchedBusinessStatus =
    useWatch({ control, name: "businessStatus" }) ?? "new";
  const watchedAvatarBg =
    useWatch({ control, name: "avatarBg" }) ?? SOLID_AVATAR_COLORS[0];
  const watchedLogoUrl = useWatch({ control, name: "logoUrl" }) ?? "";

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      if (!project) return;
      setSubmitError(null);
      try {
        await onUpdateProject(project.id, values);
        dialogRef.current?.close();
      } catch (err) {
        setSubmitError(
          err instanceof Error
            ? err.message
            : "Failed to save project changes."
        );
      }
    })(e);
  };

  const previewTicker = watchedTicker.trim()
    ? watchedTicker.trim().toUpperCase()
    : "$TKN";

  const chainOptions = PROJECT_CHAINS.includes(
    watchedChain as (typeof PROJECT_CHAINS)[number]
  )
    ? PROJECT_CHAINS
    : [watchedChain, ...PROJECT_CHAINS];

  return (
    <ModalDialog
      dialogRef={dialogRef}
      title="Edit Project Info & Profile"
      subtitle={
        project
          ? `Update profile photo, branding, pipeline details, and social links for ${project.name} (${project.ticker})`
          : "Update project details and profile"
      }
      maxWidthClass="max-w-xl"
    >
      <form
        method="post"
        onSubmit={handleFormSubmit}
        noValidate
        className="space-y-4 mt-4"
      >
        {/* Live error feedback inside modal */}
        <div aria-live="polite">
          {(uploadError || submitError) && (
            <div
              role="alert"
              className="rounded-xl bg-rose-500/12 border border-rose-500/30 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300 font-medium"
            >
              {uploadError || submitError}
            </div>
          )}
        </div>

        {/* Section 1: Project Profile Photo, Preset Icons & Avatar Color */}
        <fieldset className="rounded-xl bg-[#f0f2f5] dark:bg-[#111b21] border border-[#e4e6eb] dark:border-[#2a3942] p-3.5 space-y-3">
          <legend className="px-1 text-xs font-bold uppercase tracking-wider text-[#65676b] dark:text-[#8696a0]">
            Project Profile & Branding
          </legend>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3.5">
            <ProjectAvatar
              project={{
                name: watchedName.trim() || project?.name || "Project",
                ticker: previewTicker,
                chain: watchedChain,
                avatarBg: watchedAvatarBg,
                logoUrl: watchedLogoUrl.trim() || undefined,
                businessStatus: watchedBusinessStatus,
              }}
              size="xl"
              showOnlineDot
              onEditClick={() => fileInputRef.current?.click()}
              decorative={false}
            />

            <div className="flex-1 min-w-0 space-y-2 w-full">
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  ref={fileInputRef}
                  id={editLogoFileId}
                  name="edit-project-logo-file"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFileChange}
                  className="visually-hidden"
                />
                <label
                  htmlFor={editLogoFileId}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] text-white transition cursor-pointer"
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
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Remove photo</span>
                  </button>
                )}
              </div>

              <div aria-live="polite" className="text-[11px]">
                {uploadedFileName ? (
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2
                      className="w-3.5 h-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="truncate">
                      Loaded {uploadedFileName} — click Save Changes below to
                      apply
                    </span>
                  </span>
                ) : (
                  <span className="text-[#65676b] dark:text-[#8696a0]">
                    Supports PNG, JPG, SVG, WebP, or GIF.
                  </span>
                )}
              </div>

              <FormField label="Profile Image URL" error={errors.logoUrl}>
                {(a11yProps) => (
                  <input
                    {...a11yProps}
                    name="edit-project-logo-url"
                    type="text"
                    inputMode="url"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={
                      watchedLogoUrl.startsWith("data:") ? "" : watchedLogoUrl
                    }
                    onChange={(e) => {
                      setUploadedFileName(null);
                      setValue("logoUrl", e.target.value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                    placeholder={
                      watchedLogoUrl.startsWith("data:")
                        ? "Custom image uploaded (or paste https:// URL to replace)"
                        : "https://example.com/logo.png"
                    }
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] border border-[#e4e6eb] dark:border-[#2a3942] outline-none"
                  />
                )}
              </FormField>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <span className="block text-[11px] font-semibold mb-1.5 text-[#65676b] dark:text-[#8696a0]">
                Preset Profile Logos
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {PRESET_PROJECT_LOGOS.map((preset) => {
                  const isSelected = watchedLogoUrl === preset.url;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setUploadedFileName(null);
                        setUploadError(null);
                        setValue("logoUrl", preset.url, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }}
                      aria-pressed={isSelected}
                      className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border text-[10px] font-medium transition cursor-pointer ${
                        isSelected
                          ? "border-[#0084ff] bg-[#e7f3ff] text-[#0084ff] dark:bg-[#0084ff]/20 dark:text-[#4599ff]"
                          : "border-[#e4e6eb] dark:border-[#2a3942] bg-white dark:bg-[#202c33] text-[#65676b] dark:text-[#8696a0]"
                      }`}
                    >
                      <img
                        src={preset.url}
                        alt=""
                        width={24}
                        height={24}
                        className="w-6 h-6 block aspect-square rounded-full object-cover"
                      />
                      <span className="truncate w-full text-center">
                        {preset.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="block text-[11px] font-semibold mb-1.5 text-[#65676b] dark:text-[#8696a0]">
                Fallback Badge Color (when no photo)
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {SOLID_AVATAR_COLORS.map((colorClass) => {
                  const isSelected =
                    !watchedLogoUrl && watchedAvatarBg === colorClass;
                  const colorLabel =
                    AVATAR_COLOR_LABELS[colorClass] ?? colorClass;
                  return (
                    <button
                      key={colorClass}
                      type="button"
                      onClick={() => {
                        setUploadedFileName(null);
                        setValue("avatarBg", colorClass, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                        if (watchedLogoUrl) {
                          setValue("logoUrl", "", {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }
                      }}
                      aria-label={`Use ${colorLabel} badge background`}
                      aria-pressed={isSelected}
                      title={colorLabel}
                      className={`w-7 h-7 rounded-full ${colorClass} flex items-center justify-center text-white text-[10px] font-bold transition cursor-pointer ${
                        isSelected
                          ? "ring-2 ring-offset-2 ring-[#0084ff] dark:ring-offset-[#111b21]"
                          : "opacity-80 hover:opacity-100"
                      }`}
                    >
                      {isSelected ? "✓" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </fieldset>

        {/* Section 2: Project Core Info & Governance Metrics */}
        <fieldset className="space-y-3">
          <legend className="text-xs font-bold uppercase tracking-wider text-[#65676b] dark:text-[#8696a0] mb-1">
            Project Information & Pipeline
          </legend>

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
                  placeholder="e.g., Aetheris AI Network"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
                />
              )}
            </FormField>

            <FormField
              label="Ticker (max 12 chars)"
              required
              error={errors.ticker}
            >
              {(a11yProps) => (
                <input
                  {...a11yProps}
                  {...register("ticker")}
                  type="text"
                  required
                  maxLength={12}
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="$AETH"
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
                />
              )}
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <FormField label="Chain" required error={errors.chain}>
              {(a11yProps) => (
                <select
                  {...a11yProps}
                  {...register("chain")}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
                >
                  {chainOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField label="Stage" required error={errors.stage}>
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
              label="Pipeline Status"
              required
              error={errors.businessStatus}
            >
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

          <FormField
            label="Positioning Tagline / Summary"
            error={errors.tagline}
          >
            {(a11yProps) => (
              <input
                {...a11yProps}
                {...register("tagline")}
                type="text"
                placeholder="One-line protocol summary and positioning..."
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
              />
            )}
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <FormField
              label="Campaign Budget"
              required
              error={errors.campaignBudget}
            >
              {(a11yProps) => (
                <input
                  {...a11yProps}
                  {...register("campaignBudget")}
                  type="text"
                  required
                  placeholder="$25,000 / mo"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
                />
              )}
            </FormField>

            <FormField
              label="Sentiment Score (0–100)"
              required
              error={errors.sentimentScore}
            >
              {(a11yProps) => (
                <input
                  {...a11yProps}
                  {...register("sentimentScore", { valueAsNumber: true })}
                  type="number"
                  min={0}
                  max={100}
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
                />
              )}
            </FormField>
          </div>

          <div className="flex items-center gap-2 pt-0.5">
            <input
              id={isPinnedCheckboxId}
              type="checkbox"
              {...register("isPinned")}
              className="checkbox-native rounded"
            />
            <label
              htmlFor={isPinnedCheckboxId}
              className="text-xs font-medium text-[#050505] dark:text-[#e9edef] cursor-pointer"
            >
              Pin project to top of workspace sidebar
            </label>
          </div>
        </fieldset>

        {/* Section 3: Official Social & Web Profile Channels */}
        <fieldset className="space-y-2.5 pt-1 border-t border-[#e4e6eb] dark:border-[#2a3942]">
          <legend className="text-xs font-bold uppercase tracking-wider text-[#65676b] dark:text-[#8696a0] pt-2">
            Official Social & Web Profile Links
          </legend>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <FormField label="Official Website" error={errors.website}>
              {(a11yProps) => (
                <input
                  {...a11yProps}
                  {...register("website")}
                  type="text"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="https://project.network"
                  className="w-full px-2.5 py-2 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
                />
              )}
            </FormField>

            <FormField label="X (Twitter) Handle" error={errors.xHandle}>
              {(a11yProps) => (
                <input
                  {...a11yProps}
                  {...register("xHandle")}
                  type="text"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="@ProjectHandle"
                  className="w-full px-2.5 py-2 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
                />
              )}
            </FormField>

            <FormField label="LinkedIn URL" error={errors.linkedin}>
              {(a11yProps) => (
                <input
                  {...a11yProps}
                  {...register("linkedin")}
                  type="text"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="linkedin.com/company/project"
                  className="w-full px-2.5 py-2 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
                />
              )}
            </FormField>

            <FormField label="Telegram Community" error={errors.telegram}>
              {(a11yProps) => (
                <input
                  {...a11yProps}
                  {...register("telegram")}
                  type="text"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="t.me/ProjectOfficial"
                  className="w-full px-2.5 py-2 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
                />
              )}
            </FormField>
          </div>
        </fieldset>

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
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] disabled:opacity-50 text-white transition cursor-pointer"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
