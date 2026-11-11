"use client";

import React, { useCallback, useEffect, useId, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Check,
  Copy,
  Info,
  ListChecks,
  Plus,
  RotateCcw,
  Send,
  Settings,
} from "lucide-react";
import {
  BUSINESS_STATUS_META,
  BUSINESS_STATUS_ORDER,
  chatComposerFormSchema,
  type ChatComposerFormValues,
  type ChecklistItemConfig,
  type CryptoProject,
  type ProjectBusinessStatus,
  type PromptTemplate,
} from "@/types/project";
import { ProjectAvatar } from "@/components/ProjectAvatar";
import {
  ContextTypeIcon,
  FormattedMessageContent,
} from "@/components/ui";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useImeSafeSubmit } from "@/hooks/useImeSafeSubmit";

interface AiChatPaneProps {
  project: CryptoProject;
  promptTemplates: PromptTemplate[];
  checklistItems: ChecklistItemConfig[];
  draftPrompt: string;
  setDraftPrompt: React.Dispatch<React.SetStateAction<string>>;
  onSendMessage: (content: string, template?: PromptTemplate) => void;
  onResetConversation: () => void;
  onUpdateBusinessStatus: (status: ProjectBusinessStatus) => void;
  onOpenAddContextModal: () => void;
  onOpenEditLogoModal: () => void;
  onOpenChecklistModal: () => void;
  onOpenGlobalSettings: () => void;
  isContextPanelOpen: boolean;
  onToggleContextPanel: () => void;
  isAiTyping: boolean;
  isMobileHidden?: boolean;
  onBackToProjects?: () => void;
  totalUnreadCount?: number;
}

export function AiChatPane({
  project,
  promptTemplates,
  checklistItems,
  draftPrompt,
  setDraftPrompt,
  onSendMessage,
  onResetConversation,
  onUpdateBusinessStatus,
  onOpenAddContextModal,
  onOpenEditLogoModal,
  onOpenChecklistModal,
  onOpenGlobalSettings,
  isContextPanelOpen,
  onToggleContextPanel,
  isAiTyping,
  isMobileHidden = false,
  onBackToProjects,
  totalUnreadCount = 0,
}: AiChatPaneProps) {
  const chatInputId = useId();
  const statusSelectId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { copiedId, copy } = useCopyToClipboard();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
  } = useForm<ChatComposerFormValues>({
    resolver: zodResolver(chatComposerFormSchema),
    defaultValues: {
      content: draftPrompt,
    },
  });

  const watchedContent = useWatch({ control, name: "content" }) ?? "";

  useEffect(() => {
    setValue("content", draftPrompt, { shouldValidate: false });
  }, [draftPrompt, setValue]);

  const activeContexts = project.contexts.filter((c) => c.isActive);
  const checkedCount = checklistItems.filter(
    (item) => project.checklistState?.[item.id]?.checked
  ).length;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [project.id, project.messages.length, isAiTyping]);

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    void handleSubmit((values) => {
      onSendMessage(values.content);
      reset({ content: "" });
      setDraftPrompt("");
    })(e);
  };

  const triggerSubmit = useCallback(() => {
    formRef.current?.requestSubmit();
  }, []);

  const { onCompositionEnd, onKeyDown } = useImeSafeSubmit(triggerSubmit);

  const contentRegister = register("content", {
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDraftPrompt(e.target.value);
    },
  });

  return (
    <main
      className={`${
        isMobileHidden ? "hidden md:flex" : "flex"
      } flex-1 h-full flex-col min-w-0 bg-[#f0f2f5] dark:bg-[#0b141a]`}
    >
      {/* Responsive Messenger / WhatsApp Header */}
      <header className="min-h-15 px-2.5 sm:px-4 py-2 border-b border-[#e4e6eb] dark:border-[#222d34] bg-white dark:bg-[#202c33] flex items-center justify-between gap-2 sm:gap-4 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {onBackToProjects && (
            <button
              type="button"
              onClick={onBackToProjects}
              aria-label="Back to projects list"
              title="Back to projects"
              className="md:hidden relative w-9 h-9 -ml-1 rounded-full text-[#050505] dark:text-[#e9edef] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] flex items-center justify-center shrink-0 transition cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
              {totalUnreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-[#0084ff] text-white text-[10px] font-bold flex items-center justify-center">
                  {totalUnreadCount}
                </span>
              )}
            </button>
          )}

          <ProjectAvatar
            project={project}
            size="md"
            showOnlineDot
            onEditClick={onOpenEditLogoModal}
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <h2 className="font-semibold text-[14px] sm:text-[15px] text-[#050505] dark:text-[#e9edef] truncate">
                {project.name}
              </h2>
              <span className="text-[11px] sm:text-xs text-[#65676b] dark:text-[#8696a0] font-medium shrink-0">
                {project.ticker}
                <span className="hidden sm:inline"> · {project.chain}</span>
              </span>
            </div>

            {/* Subtitle Row: Inline Business Status Selector + Active Contexts Count */}
            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-[#65676b] dark:text-[#8696a0] min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  BUSINESS_STATUS_META[project.businessStatus].dotClass
                }`}
              />
              <label htmlFor={statusSelectId} className="sr-only">
                Project business status
              </label>
              <select
                id={statusSelectId}
                name="project-business-status"
                value={project.businessStatus}
                onChange={(e) =>
                  onUpdateBusinessStatus(
                    e.target.value as ProjectBusinessStatus
                  )
                }
                className="status-auto-select bg-transparent font-medium text-xs text-[#050505] dark:text-[#e9edef] outline-none cursor-pointer"
              >
                {BUSINESS_STATUS_ORDER.map((statusKey) => (
                  <option
                    key={statusKey}
                    value={statusKey}
                    className="bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef]"
                  >
                    {BUSINESS_STATUS_META[statusKey].label}
                  </option>
                ))}
              </select>
              <span className="shrink-0">·</span>
              <span className="truncate">
                {activeContexts.length}/{project.contexts.length}{" "}
                <span className="hidden sm:inline">contexts active</span>
                <span className="sm:hidden">ctx</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Header Icon Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenChecklistModal}
            title="Check project feature checklist"
            className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold bg-[#f0f2f5] hover:bg-[#e4e6eb] dark:bg-[#2a3942] dark:hover:bg-[#374045] text-[#050505] dark:text-[#e9edef] transition cursor-pointer"
          >
            <ListChecks className="w-4 h-4 text-[#0084ff] shrink-0" />
            <span>
              <span className="hidden sm:inline">Checklist </span>(
              {checkedCount}/{checklistItems.length})
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenGlobalSettings}
            title="Edit system prompts & global checklist"
            aria-label="Edit system prompts and global checklist"
            className="w-9 h-9 rounded-full text-[#65676b] dark:text-[#8696a0] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] flex items-center justify-center transition cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onResetConversation}
            title="Clear chat"
            aria-label="Clear chat"
            className="w-9 h-9 rounded-full text-[#65676b] dark:text-[#8696a0] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] flex items-center justify-center transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onToggleContextPanel}
            title={isContextPanelOpen ? "Hide project info" : "Show project info"}
            aria-label="Toggle project context panel"
            className={`w-9 h-9 rounded-full flex items-center justify-center transition cursor-pointer ${
              isContextPanelOpen
                ? "bg-[#e7f3ff] text-[#0084ff] dark:bg-[#0084ff]/20 dark:text-[#4599ff]"
                : "text-[#65676b] dark:text-[#8696a0] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942]"
            }`}
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Messenger / WhatsApp Message Stream */}
      <div className="flex-1 overflow-y-auto scroller px-3 sm:px-6 py-3 sm:py-4 space-y-3">
        {project.messages.map((msg, index) => {
          const isAdmin = msg.sender === "admin";
          const isInitialTarget = index === project.messages.length - 1;
          const referencedContexts = project.contexts.filter((c) =>
            msg.usedContextIds?.includes(c.id)
          );

          return (
            <div
              key={msg.id}
              style={
                isInitialTarget
                  ? ({ scrollInitialTarget: "nearest" } as React.CSSProperties)
                  : undefined
              }
              className={`flex items-end gap-2 min-w-0 ${
                isAdmin ? "justify-end" : "justify-start"
              }`}
            >
              {!isAdmin && (
                <div className="hidden xs:block sm:block shrink-0">
                  <ProjectAvatar project={project} size="sm" decorative />
                </div>
              )}

              <div
                className={`max-w-[90%] sm:max-w-xl min-w-0 flex flex-col ${
                  isAdmin ? "items-end" : "items-start"
                }`}
              >
                {/* Message Bubble */}
                <div
                  className={`w-full min-w-0 break-words rounded-2xl px-3.5 py-2.5 shadow-2xs ${
                    isAdmin
                      ? "bg-[#0084ff] text-white rounded-br-xs"
                      : "bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] rounded-bl-xs border border-[#e4e6eb]/60 dark:border-transparent"
                  }`}
                >
                  <FormattedMessageContent content={msg.content} />

                  {/* Subtle Inline Footer: Context Pills + Copy + Timestamp */}
                  <div
                    className={`flex items-center justify-between gap-2 sm:gap-3 mt-1.5 pt-1 text-[11px] flex-wrap ${
                      isAdmin
                        ? "text-white/80 justify-end"
                        : "text-[#65676b] dark:text-[#8696a0] border-t border-[#f0f2f5] dark:border-[#2a3942]"
                    }`}
                  >
                    {!isAdmin && referencedContexts.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap min-w-0">
                        {referencedContexts.map((ctx) => (
                          <span
                            key={ctx.id}
                            title={`${ctx.title}: ${ctx.value}`}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#f0f2f5] dark:bg-[#2a3942] text-[10px] text-[#65676b] dark:text-[#d1d7db]"
                          >
                            <ContextTypeIcon type={ctx.type} variant="sm" />
                            <span className="max-w-24 truncate">
                              {ctx.title}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 ml-auto shrink-0">
                      {!isAdmin && (
                        <button
                          type="button"
                          onClick={() => copy(msg.id, msg.content)}
                          className="inline-flex items-center gap-1 hover:text-[#050505] dark:hover:text-white transition cursor-pointer"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-[#00a884]" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      )}
                      <span>{msg.timestamp}</span>
                    </div>
                  </div>
                </div>

                {/* Global Editable System Prompt Chips (Shown on the latest AI message) */}
                {!isAdmin && index === project.messages.length - 1 && (
                  <div className="chip-wrap-balance items-center gap-1.5 mt-2">
                    {promptTemplates.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => onSendMessage(tpl.label, tpl)}
                        title={`System Prompt: ${tpl.systemPrompt}`}
                        className="px-3 py-1.5 sm:py-1 rounded-full text-xs font-medium text-left bg-white hover:bg-[#e4e6eb]/60 dark:bg-[#202c33] dark:hover:bg-[#2a3942] text-[#0084ff] dark:text-[#4599ff] border border-[#e4e6eb] dark:border-[#2a3942] transition cursor-pointer"
                      >
                        {tpl.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={onOpenGlobalSettings}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 sm:py-1 rounded-full text-[11px] font-medium text-[#65676b] hover:text-[#050505] dark:text-[#8696a0] dark:hover:text-[#e9edef] transition cursor-pointer"
                    >
                      <Settings className="w-3 h-3" />
                      <span>Edit prompts</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isAiTyping && (
          <div className="flex items-center gap-2">
            <ProjectAvatar project={project} size="sm" decorative />
            <div className="px-3.5 py-2 rounded-2xl bg-white dark:bg-[#202c33] text-xs text-[#65676b] dark:text-[#8696a0]">
              Typing...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Single-Row Messenger / WhatsApp Composer Footer */}
      <div className="px-2.5 sm:px-3 pt-2 pb-[max(0.625rem,env(safe-area-inset-bottom))] bg-white dark:bg-[#202c33] border-t border-[#e4e6eb] dark:border-[#222d34] shrink-0">
        <form
          ref={formRef}
          onSubmit={handleFormSubmit}
          noValidate
          className="flex items-end gap-1.5 sm:gap-2"
        >
          <button
            type="button"
            onClick={onOpenAddContextModal}
            title="Add project context or link"
            aria-label="Add project context or link"
            className="w-10 h-10 sm:w-9 sm:h-9 rounded-full text-[#0084ff] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] flex items-center justify-center shrink-0 transition cursor-pointer"
          >
            <Plus className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0 rounded-3xl bg-[#f0f2f5] dark:bg-[#2a3942] px-3.5 sm:px-4 py-2 flex items-center">
            <label htmlFor={chatInputId} className="sr-only">
              Type a message
            </label>
            <textarea
              id={chatInputId}
              {...contentRegister}
              onCompositionEnd={onCompositionEnd}
              onKeyDown={onKeyDown}
              placeholder={`Message ${project.name} (${activeContexts.length} contexts active)...`}
              className="chat-auto-textarea bg-transparent text-base sm:text-[14px] text-[#050505] dark:text-[#e9edef] placeholder:text-[#65676b] dark:placeholder:text-[#8696a0] outline-none resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={!watchedContent.trim()}
            aria-label="Send message"
            className="w-10 h-10 sm:w-9 sm:h-9 rounded-full bg-[#0084ff] hover:bg-[#0073e6] disabled:opacity-40 disabled:pointer-events-none text-white flex items-center justify-center shrink-0 transition cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </main>
  );
}
