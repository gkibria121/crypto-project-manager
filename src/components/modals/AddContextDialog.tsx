"use client";

import React, { type RefObject } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AtSign,
  Briefcase,
  Globe,
  MessageSquareText,
  SendHorizontal,
} from "lucide-react";
import {
  addContextFormSchema,
  type AddContextFormValues,
  type ContextType,
} from "@/types/project";
import { FormField, ModalDialog } from "@/components/ui";

interface AddContextDialogProps {
  dialogRef: RefObject<HTMLDialogElement | null>;
  projectName: string;
  onAddContext: (values: AddContextFormValues) => void;
}

const CONTEXT_TYPE_OPTIONS: {
  id: ContextType;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "x_handle",
    label: "X",
    icon: <AtSign className="w-3.5 h-3.5" />,
  },
  {
    id: "website",
    label: "Website",
    icon: <Globe className="w-3.5 h-3.5" />,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    icon: <Briefcase className="w-3.5 h-3.5" />,
  },
  {
    id: "telegram",
    label: "Telegram",
    icon: <SendHorizontal className="w-3.5 h-3.5" />,
  },
  {
    id: "message",
    label: "Note",
    icon: <MessageSquareText className="w-3.5 h-3.5" />,
  },
];

export function AddContextDialog({
  dialogRef,
  projectName,
  onAddContext,
}: AddContextDialogProps) {
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<AddContextFormValues>({
    resolver: zodResolver(addContextFormSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      type: "x_handle",
      title: "",
      value: "",
      summary: "",
    },
  });

  const selectedType = useWatch({ control, name: "type" }) ?? "x_handle";

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    void handleSubmit((values) => {
      onAddContext(values);
      reset({
        type: selectedType,
        title: "",
        value: "",
        summary: "",
      });
      dialogRef.current?.close();
    })(e);
  };

  return (
    <ModalDialog
      dialogRef={dialogRef}
      title="Add Context"
      subtitle={projectName}
      maxWidthClass="max-w-md"
    >
      <form onSubmit={handleFormSubmit} noValidate className="space-y-3.5 mt-4">
        <fieldset>
          <legend className="block text-xs font-semibold mb-1.5 text-[#65676b] dark:text-[#8696a0]">
            Type
          </legend>
          <div className="grid grid-cols-5 gap-1.5">
            {CONTEXT_TYPE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() =>
                  setValue("type", option.id, { shouldValidate: true })
                }
                aria-pressed={selectedType === option.id}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-[11px] font-medium transition cursor-pointer ${
                  selectedType === option.id
                    ? "bg-[#e7f3ff] text-[#0084ff] dark:bg-[#0084ff]/20 dark:text-[#4599ff] font-semibold"
                    : "bg-[#f0f2f5] dark:bg-[#2a3942] text-[#65676b] dark:text-[#8696a0]"
                }`}
              >
                {option.icon}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <FormField label="Title" required error={errors.title}>
          {(a11yProps) => (
            <input
              {...a11yProps}
              {...register("title")}
              type="text"
              required
              autoFocus
              placeholder={
                selectedType === "x_handle"
                  ? "Official X Handle"
                  : selectedType === "linkedin"
                    ? "Company LinkedIn"
                    : selectedType === "website"
                      ? "Website & Docs"
                      : "Campaign Brief"
              }
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] outline-none"
            />
          )}
        </FormField>

        <FormField
          label={selectedType === "message" ? "Message / Note" : "Link or Handle"}
          required
          error={errors.value}
        >
          {(a11yProps) =>
            selectedType === "message" ? (
              <textarea
                {...a11yProps}
                {...register("value")}
                required
                rows={3}
                placeholder="Enter campaign instructions or context note..."
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] outline-none resize-none"
              />
            ) : (
              <input
                {...a11yProps}
                {...register("value")}
                type="text"
                required
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder={
                  selectedType === "x_handle"
                    ? "@handle"
                    : selectedType === "linkedin"
                      ? "linkedin.com/company/..."
                      : "https://..."
                }
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] outline-none"
              />
            )
          }
        </FormField>

        <FormField label="Notes (Optional)" error={errors.summary}>
          {(a11yProps) => (
            <input
              {...a11yProps}
              {...register("summary")}
              type="text"
              placeholder="Optional summary or tone note"
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] outline-none"
            />
          )}
        </FormField>

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
