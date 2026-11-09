"use client";

import React, { type RefObject } from "react";
import { CheckCheck, Play, Settings } from "lucide-react";
import type { ChecklistItemConfig, CryptoProject } from "@/types/project";
import { ModalDialog } from "@/components/ui";

interface ProjectChecklistDialogProps {
  dialogRef: RefObject<HTMLDialogElement | null>;
  project: CryptoProject;
  checklistItems: ChecklistItemConfig[];
  onToggleChecklistItem: (itemId: string) => void;
  onScanAllChecklistItems: () => void;
  onScanSingleItemInChat: (item: ChecklistItemConfig) => void;
  onOpenGlobalSettings: () => void;
}

export function ProjectChecklistDialog({
  dialogRef,
  project,
  checklistItems,
  onToggleChecklistItem,
  onScanAllChecklistItems,
  onScanSingleItemInChat,
  onOpenGlobalSettings,
}: ProjectChecklistDialogProps) {
  const completedCount = checklistItems.filter(
    (item) => project.checklistState?.[item.id]?.checked
  ).length;

  return (
    <ModalDialog
      dialogRef={dialogRef}
      title={`Project Feature Checklist (${completedCount}/${checklistItems.length})`}
      subtitle={`${project.name} (${project.ticker}) · Global checklist items`}
      maxWidthClass="max-w-lg"
    >
      <div className="flex items-center justify-between gap-2 my-3 p-3 rounded-xl bg-[#f0f2f5] dark:bg-[#2a3942]">
        <div className="text-xs text-[#65676b] dark:text-[#d1d7db]">
          Scan each item prompt against <strong>{project.name}</strong>{" "}
          contexts.
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onScanAllChecklistItems}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] text-white transition cursor-pointer"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Scan All Prompts</span>
          </button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto scroller divide-y divide-[#e4e6eb] dark:divide-[#2a3942]">
        {checklistItems.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#65676b] dark:text-[#8696a0]">
            No checklist items configured. Add items in Global Settings.
          </div>
        ) : (
          checklistItems.map((item) => {
            const state = project.checklistState?.[item.id];
            const isChecked = Boolean(state?.checked);

            return (
              <div
                key={item.id}
                className="py-2.5 flex items-start justify-between gap-3"
              >
                <label className="flex items-start gap-3 flex-1 min-w-0 min-h-11 py-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggleChecklistItem(item.id)}
                    className="checkbox-native mt-0.5 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#050505] dark:text-[#e9edef]">
                        {item.label}
                      </span>
                      {state?.scannedAt && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            isChecked
                              ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
                              : "bg-amber-500/12 text-amber-700 dark:text-amber-400"
                          }`}
                        >
                          {isChecked ? "Detected" : "Not found"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#65676b] dark:text-[#8696a0] mt-0.5">
                      Prompt: “{item.scanPrompt}”
                    </p>
                    {state?.scanResultNote && (
                      <p className="text-[11px] text-[#050505] dark:text-[#d1d7db] mt-1 bg-[#f0f2f5] dark:bg-[#111b21] px-2.5 py-1 rounded-lg">
                        {state.scanResultNote}
                      </p>
                    )}
                  </div>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    dialogRef.current?.close();
                    onScanSingleItemInChat(item);
                  }}
                  title="Ask this checklist prompt in chat"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#0084ff] hover:bg-[#e7f3ff] dark:hover:bg-[#0084ff]/20 shrink-0 mt-1 transition cursor-pointer"
                >
                  <Play className="w-3 h-3" />
                  <span>Ask AI</span>
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between pt-3 mt-2 border-t border-[#e4e6eb] dark:border-[#2a3942]">
        <button
          type="button"
          onClick={() => {
            dialogRef.current?.close();
            onOpenGlobalSettings();
          }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0084ff] hover:underline cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Edit Checklist & System Prompts (Global Settings)</span>
        </button>

        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#f0f2f5] dark:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] transition cursor-pointer"
        >
          Done
        </button>
      </div>
    </ModalDialog>
  );
}
