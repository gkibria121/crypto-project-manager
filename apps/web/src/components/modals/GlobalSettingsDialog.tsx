"use client";

import React, { useState, type RefObject } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import {
  checklistItemFormSchema,
  promptTemplateFormSchema,
  type ChecklistItemConfig,
  type ChecklistItemFormValues,
  type PromptTemplate,
  type PromptTemplateFormValues,
} from "@/types/project";
import {
  FilterChip,
  FormField,
  ModalDialog,
  PaginationBar,
} from "@/components/ui";
import { usePagination } from "@/hooks/usePagination";

interface GlobalSettingsDialogProps {
  dialogRef: RefObject<HTMLDialogElement | null>;
  promptTemplates: PromptTemplate[];
  onSavePromptTemplate: (template: PromptTemplate) => void;
  onDeletePromptTemplate: (id: string) => void;
  checklistItems: ChecklistItemConfig[];
  onSaveChecklistItem: (item: ChecklistItemConfig) => void;
  onDeleteChecklistItem: (id: string) => void;
}

export function GlobalSettingsDialog({
  dialogRef,
  promptTemplates,
  onSavePromptTemplate,
  onDeletePromptTemplate,
  checklistItems,
  onSaveChecklistItem,
  onDeleteChecklistItem,
}: GlobalSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<"prompts" | "checklist">(
    "prompts"
  );

  const promptsPagination = usePagination(promptTemplates, {
    initialPageSize: 4,
    pageSizeOptions: [4, 8, 15, 25],
  });

  const checklistPagination = usePagination(checklistItems, {
    initialPageSize: 4,
    pageSizeOptions: [4, 8, 15, 25],
  });

  const promptForm = useForm<PromptTemplateFormValues>({
    resolver: zodResolver(promptTemplateFormSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      label: "",
      systemPrompt: "",
    },
  });

  const checklistForm = useForm<ChecklistItemFormValues>({
    resolver: zodResolver(checklistItemFormSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      label: "",
      scanPrompt: "",
    },
  });

  const handleAddPromptSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    void promptForm.handleSubmit((values) => {
      onSavePromptTemplate({
        id: `tpl-${Date.now()}`,
        label: values.label,
        systemPrompt: values.systemPrompt,
      });
      promptForm.reset();
    })(e);
  };

  const handleAddChecklistSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    void checklistForm.handleSubmit((values) => {
      onSaveChecklistItem({
        id: `chk-${Date.now()}`,
        label: values.label,
        scanPrompt: values.scanPrompt,
      });
      checklistForm.reset();
    })(e);
  };

  return (
    <ModalDialog
      dialogRef={dialogRef}
      title="Global Settings"
      subtitle="Manage system prompts and feature checklist items across all projects"
      maxWidthClass="max-w-2xl"
    >
      <div className="flex items-center gap-2 mt-3 pb-3 border-b border-[#e4e6eb] dark:border-[#2a3942] overflow-x-auto scroller">
        <FilterChip
          active={activeTab === "prompts"}
          onClick={() => setActiveTab("prompts")}
        >
          System Prompts ({promptTemplates.length})
        </FilterChip>
        <FilterChip
          active={activeTab === "checklist"}
          onClick={() => setActiveTab("checklist")}
        >
          Global Checklist ({checklistItems.length})
        </FilterChip>
      </div>

      {activeTab === "prompts" ? (
        <div className="mt-4 space-y-4">
          <div className="max-h-72 overflow-y-auto scroller space-y-3 pr-1">
            {promptsPagination.items.map((tpl) => (
              <div
                key={tpl.id}
                className="p-3 rounded-xl bg-[#f0f2f5] dark:bg-[#2a3942] space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    aria-label="Prompt action title"
                    value={tpl.label}
                    onChange={(e) =>
                      onSavePromptTemplate({
                        ...tpl,
                        label: e.target.value,
                      })
                    }
                    className="flex-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => onDeletePromptTemplate(tpl.id)}
                    aria-label={`Remove ${tpl.label}`}
                    title="Delete prompt template"
                    className="p-1.5 rounded-lg text-[#65676b] hover:text-rose-600 dark:text-[#8696a0] dark:hover:text-rose-400 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <textarea
                    rows={2}
                    aria-label={`System prompt for ${tpl.label}`}
                    value={tpl.systemPrompt}
                    onChange={(e) =>
                      onSavePromptTemplate({
                        ...tpl,
                        systemPrompt: e.target.value,
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-[#111b21] text-[#65676b] dark:text-[#d1d7db] outline-none resize-none"
                  />
                </div>
              </div>
            ))}
          </div>

          <PaginationBar
            variant="compact"
            meta={promptsPagination.meta}
            pageSizeOptions={promptsPagination.pageSizeOptions}
            onPageChange={promptsPagination.setPage}
            onPageSizeChange={promptsPagination.setPageSize}
            itemLabel="prompts"
            ariaLabel="System prompt templates pagination"
            hideWhenSinglePage
          />

          <form
            onSubmit={handleAddPromptSubmit}
            noValidate
            className="p-3.5 rounded-xl border border-[#e4e6eb] dark:border-[#2a3942] space-y-2.5"
          >
            <span className="block text-xs font-semibold text-[#050505] dark:text-[#e9edef]">
              Add New Prompt Action
            </span>

            <FormField
              label="Button label"
              srOnlyLabel
              required
              error={promptForm.formState.errors.label}
            >
              {(a11yProps) => (
                <input
                  {...a11yProps}
                  {...promptForm.register("label")}
                  type="text"
                  required
                  placeholder="Button title (e.g., Draft Tokenomics Summary Thread)"
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
                />
              )}
            </FormField>

            <FormField
              label="System prompt instructions"
              srOnlyLabel
              required
              error={promptForm.formState.errors.systemPrompt}
            >
              {(a11yProps) => (
                <textarea
                  {...a11yProps}
                  {...promptForm.register("systemPrompt")}
                  rows={2}
                  required
                  placeholder="System prompt instructions sent to AI when clicked..."
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none resize-none"
                />
              )}
            </FormField>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={promptForm.formState.isSubmitting}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] disabled:opacity-50 text-white transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Prompt</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="max-h-72 overflow-y-auto scroller space-y-2.5 pr-1">
            {checklistPagination.items.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-[#f0f2f5] dark:bg-[#2a3942] space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    aria-label="Checklist item name"
                    value={item.label}
                    onChange={(e) =>
                      onSaveChecklistItem({
                        ...item,
                        label: e.target.value,
                      })
                    }
                    className="flex-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => onDeleteChecklistItem(item.id)}
                    aria-label={`Remove ${item.label}`}
                    title="Remove checklist item"
                    className="p-1.5 rounded-lg text-[#65676b] hover:text-rose-600 dark:text-[#8696a0] dark:hover:text-rose-400 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <input
                    type="text"
                    aria-label={`Scan prompt for ${item.label}`}
                    value={item.scanPrompt}
                    onChange={(e) =>
                      onSaveChecklistItem({
                        ...item,
                        scanPrompt: e.target.value,
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-[#111b21] text-[#65676b] dark:text-[#d1d7db] outline-none"
                  />
                </div>
              </div>
            ))}
          </div>

          <PaginationBar
            variant="compact"
            meta={checklistPagination.meta}
            pageSizeOptions={checklistPagination.pageSizeOptions}
            onPageChange={checklistPagination.setPage}
            onPageSizeChange={checklistPagination.setPageSize}
            itemLabel="checklist items"
            ariaLabel="Global checklist items pagination"
            hideWhenSinglePage
          />

          <form
            onSubmit={handleAddChecklistSubmit}
            noValidate
            className="p-3.5 rounded-xl border border-[#e4e6eb] dark:border-[#2a3942] space-y-2.5"
          >
            <span className="block text-xs font-semibold text-[#050505] dark:text-[#e9edef]">
              Add Global Checklist Item (Applies to all projects)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <FormField
                label="Feature name"
                srOnlyLabel
                required
                error={checklistForm.formState.errors.label}
              >
                {(a11yProps) => (
                  <input
                    {...a11yProps}
                    {...checklistForm.register("label")}
                    type="text"
                    required
                    placeholder="e.g., Telegram Bot or MCP Server"
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
                  />
                )}
              </FormField>

              <FormField
                label="Scan prompt question"
                srOnlyLabel
                required
                error={checklistForm.formState.errors.scanPrompt}
                className="sm:col-span-2"
              >
                {(a11yProps) => (
                  <input
                    {...a11yProps}
                    {...checklistForm.register("scanPrompt")}
                    type="text"
                    required
                    placeholder="e.g., Does this project have a Telegram bot?"
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
                  />
                )}
              </FormField>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={checklistForm.formState.isSubmitting}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] disabled:opacity-50 text-white transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add to Global Checklist</span>
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex justify-end pt-3 mt-3 border-t border-[#e4e6eb] dark:border-[#2a3942]">
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] text-white transition cursor-pointer"
        >
          Done
        </button>
      </div>
    </ModalDialog>
  );
}
