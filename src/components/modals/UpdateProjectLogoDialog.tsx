"use client";

import React, { useEffect, useId, type RefObject } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2, Upload } from "lucide-react";
import {
  updateProjectLogoFormSchema,
  type CryptoProject,
  type UpdateProjectLogoFormValues,
} from "@/types/project";
import {
  PRESET_PROJECT_LOGOS,
  ProjectAvatar,
} from "@/components/ProjectAvatar";
import { FormField, ModalDialog } from "@/components/ui";
import { readFileAsDataUrl } from "@/lib/file-utils";

interface UpdateProjectLogoDialogProps {
  dialogRef: RefObject<HTMLDialogElement | null>;
  project: CryptoProject;
  onUpdateLogo: (logoUrl: string | undefined) => void;
}

export function UpdateProjectLogoDialog({
  dialogRef,
  project,
  onUpdateLogo,
}: UpdateProjectLogoDialogProps) {
  const fileInputId = useId();

  const {
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProjectLogoFormValues>({
    resolver: zodResolver(updateProjectLogoFormSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      logoUrl: project.logoUrl ?? "",
    },
  });

  useEffect(() => {
    reset({ logoUrl: project.logoUrl ?? "" });
  }, [project.id, project.logoUrl, reset]);

  const previewUrl = useWatch({ control, name: "logoUrl" }) ?? "";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readFileAsDataUrl(file, (dataUrl) => {
      setValue("logoUrl", dataUrl, { shouldDirty: true, shouldValidate: true });
    });
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    void handleSubmit((values) => {
      const trimmed = values.logoUrl.trim();
      onUpdateLogo(trimmed ? trimmed : undefined);
      dialogRef.current?.close();
    })(e);
  };

  return (
    <ModalDialog
      dialogRef={dialogRef}
      title="Project Photo"
      subtitle={`${project.name} (${project.ticker})`}
      maxWidthClass="max-w-md"
    >
      <form onSubmit={handleFormSubmit} noValidate className="space-y-4 mt-4">
        <div className="flex items-center gap-4 p-3.5 rounded-xl bg-[#f0f2f5] dark:bg-[#2a3942]">
          <ProjectAvatar
            project={{
              ...project,
              logoUrl: previewUrl.trim() || undefined,
            }}
            size="xl"
            showOnlineDot
            decorative={false}
          />

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <input
                id={fileInputId}
                name="project-logo-file"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="visually-hidden"
              />
              <label
                htmlFor={fileInputId}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] text-white transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload photo</span>
              </label>

              {previewUrl && (
                <button
                  type="button"
                  onClick={() =>
                    setValue("logoUrl", "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-black/5 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              )}
            </div>
            <p className="text-[11px] text-[#65676b] dark:text-[#8696a0]">
              PNG, JPG, SVG, or WebP.
            </p>
          </div>
        </div>

        <FormField label="Image URL" error={errors.logoUrl}>
          {(a11yProps) => (
            <input
              {...a11yProps}
              name="project-logo-url"
              type="url"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={previewUrl.startsWith("data:") ? "" : previewUrl}
              onChange={(e) =>
                setValue("logoUrl", e.target.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              placeholder="https://..."
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] outline-none"
            />
          )}
        </FormField>

        <div>
          <span className="block text-xs font-semibold mb-1.5 text-[#65676b] dark:text-[#8696a0]">
            Default Icons
          </span>
          <div className="grid grid-cols-4 gap-2">
            {PRESET_PROJECT_LOGOS.map((preset) => {
              const isSelected = previewUrl === preset.url;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    setValue("logoUrl", preset.url, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-[11px] font-medium transition cursor-pointer ${
                    isSelected
                      ? "border-[#0084ff] bg-[#e7f3ff] text-[#0084ff] dark:bg-[#0084ff]/20 dark:text-[#4599ff]"
                      : "border-[#e4e6eb] dark:border-[#2a3942] text-[#65676b] dark:text-[#8696a0]"
                  }`}
                >
                  <img
                    src={preset.url}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover"
                  />
                  <span className="truncate w-full text-center">
                    {preset.label}
                  </span>
                </button>
              );
            })}
          </div>
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
            Save
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
