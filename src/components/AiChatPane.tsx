"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import {
  BUSINESS_STATUS_META,
  ChecklistItemConfig,
  CryptoProject,
  ProjectBusinessStatus,
  ProjectContextItem,
  PromptTemplate,
} from "@/types/project";
import { ProjectAvatar } from "@/components/ProjectAvatar";
import {
  Send,
  Globe,
  AtSign,
  Briefcase,
  MessageSquareText,
  Copy,
  Check,
  Plus,
  Info,
  RotateCcw,
  SendHorizontal,
  ListChecks,
  Settings,
} from "lucide-react";

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
}

function getContextIcon(type: ProjectContextItem["type"]) {
  switch (type) {
    case "website":
      return <Globe className="w-3 h-3 text-[#65676b] dark:text-[#8696a0]" />;
    case "x_handle":
      return <AtSign className="w-3 h-3 text-[#65676b] dark:text-[#8696a0]" />;
    case "linkedin":
      return (
        <Briefcase className="w-3 h-3 text-[#65676b] dark:text-[#8696a0]" />
      );
    case "telegram":
      return (
        <SendHorizontal className="w-3 h-3 text-[#65676b] dark:text-[#8696a0]" />
      );
    case "message":
      return (
        <MessageSquareText className="w-3 h-3 text-[#65676b] dark:text-[#8696a0]" />
      );
  }
}

function FormattedMessageContent({ content }: { content: string }) {
  const lines = content.split("\n");

  const formatInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={idx} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={idx}
            className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono text-[12px]"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-1.5 text-[14px] leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        if (trimmed.startsWith("### ")) {
          return (
            <h3
              key={idx}
              className="text-[13px] font-semibold text-[#050505] dark:text-[#e9edef] pt-1"
            >
              {trimmed.replace("### ", "")}
            </h3>
          );
        }

        if (trimmed.startsWith("- ")) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="w-1 h-1 rounded-full bg-current mt-2 shrink-0 opacity-60" />
              <p className="flex-1">{formatInline(trimmed.slice(2))}</p>
            </div>
          );
        }

        if (trimmed.startsWith("> ")) {
          return (
            <blockquote
              key={idx}
              className="border-l-2 border-[#0084ff] pl-3 py-0.5 my-1 text-[#65676b] dark:text-[#d1d7db]"
            >
              {formatInline(trimmed.slice(2))}
            </blockquote>
          );
        }

        return <p key={idx}>{formatInline(line)}</p>;
      })}
    </div>
  );
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
}: AiChatPaneProps) {
  const chatInputId = useId();
  const statusSelectId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastCompositionEndAtRef = useRef<number | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const activeContexts = project.contexts.filter((c) => c.isActive);
  const checkedCount = checklistItems.filter(
    (item) => project.checklistState?.[item.id]?.checked
  ).length;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [project.id, project.messages.length, isAiTyping]);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMsgId(id);
      setTimeout(() => setCopiedMsgId(null), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = draftPrompt.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setDraftPrompt("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      if (e.nativeEvent.isComposing || e.keyCode === 229) {
        return;
      }

      if (
        lastCompositionEndAtRef.current !== null &&
        Math.abs(e.timeStamp - lastCompositionEndAtRef.current) < 50
      ) {
        return;
      }

      formRef.current?.requestSubmit();
    }
  };

  return (
    <main className="flex-1 h-full flex flex-col min-w-0 bg-[#f0f2f5] dark:bg-[#0b141a]">
      {/* Single Compact Messenger / WhatsApp Header (< 12% viewport height) */}
      <header className="h-15 px-4 border-b border-[#e4e6eb] dark:border-[#222d34] bg-white dark:bg-[#202c33] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <ProjectAvatar
            project={project}
            size="md"
            showOnlineDot
            onEditClick={onOpenEditLogoModal}
          />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-[15px] text-[#050505] dark:text-[#e9edef] truncate">
                {project.name}
              </h2>
              <span className="text-xs text-[#65676b] dark:text-[#8696a0] font-medium">
                {project.ticker} · {project.chain}
              </span>
            </div>

            {/* Subtitle Row: Inline Business Status Selector + Active Contexts Count */}
            <div className="flex items-center gap-1.5 text-xs text-[#65676b] dark:text-[#8696a0]">
              <span
                className={`w-2 h-2 rounded-full ${
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
                className="status-auto-select bg-transparent font-medium text-[#050505] dark:text-[#e9edef] outline-none cursor-pointer"
              >
                <option
                  value="new"
                  className="bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef]"
                >
                  New
                </option>
                <option
                  value="contacted"
                  className="bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef]"
                >
                  Contacted
                </option>
                <option
                  value="collaborated"
                  className="bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef]"
                >
                  Collaborated
                </option>
                <option
                  value="completed"
                  className="bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef]"
                >
                  Completed
                </option>
                <option
                  value="unresponsive"
                  className="bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef]"
                >
                  Unresponsive
                </option>
                <option
                  value="archived"
                  className="bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef]"
                >
                  Archived
                </option>
              </select>
              <span>·</span>
              <span>
                {activeContexts.length} of {project.contexts.length} contexts
                active
              </span>
            </div>
          </div>
        </div>

        {/* Right Header Icon Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenChecklistModal}
            title="Check project feature checklist"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#f0f2f5] hover:bg-[#e4e6eb] dark:bg-[#2a3942] dark:hover:bg-[#374045] text-[#050505] dark:text-[#e9edef] transition cursor-pointer"
          >
            <ListChecks className="w-4 h-4 text-[#0084ff]" />
            <span>
              Checklist ({checkedCount}/{checklistItems.length})
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
      <div className="flex-1 overflow-y-auto scroller px-4 sm:px-6 py-4 space-y-3">
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
              className={`flex items-end gap-2 ${
                isAdmin ? "justify-end" : "justify-start"
              }`}
            >
              {!isAdmin && (
                <ProjectAvatar project={project} size="sm" decorative />
              )}

              <div
                className={`max-w-xl flex flex-col ${
                  isAdmin ? "items-end" : "items-start"
                }`}
              >
                {/* Message Bubble */}
                <div
                  className={`rounded-2xl px-3.5 py-2.5 shadow-2xs ${
                    isAdmin
                      ? "bg-[#0084ff] text-white rounded-br-xs"
                      : "bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] rounded-bl-xs border border-[#e4e6eb]/60 dark:border-transparent"
                  }`}
                >
                  <FormattedMessageContent content={msg.content} />

                  {/* Subtle Inline Footer: Context Pills + Copy + Timestamp */}
                  <div
                    className={`flex items-center justify-between gap-3 mt-1.5 pt-1 text-[11px] ${
                      isAdmin
                        ? "text-white/80 justify-end"
                        : "text-[#65676b] dark:text-[#8696a0] border-t border-[#f0f2f5] dark:border-[#2a3942]"
                    }`}
                  >
                    {!isAdmin && referencedContexts.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {referencedContexts.map((ctx) => (
                          <span
                            key={ctx.id}
                            title={`${ctx.title}: ${ctx.value}`}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#f0f2f5] dark:bg-[#2a3942] text-[10px] text-[#65676b] dark:text-[#d1d7db]"
                          >
                            {getContextIcon(ctx.type)}
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
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="inline-flex items-center gap-1 hover:text-[#050505] dark:hover:text-white transition cursor-pointer"
                        >
                          {copiedMsgId === msg.id ? (
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
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    {promptTemplates.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => onSendMessage(tpl.label, tpl)}
                        title={`System Prompt: ${tpl.systemPrompt}`}
                        className="px-3 py-1 rounded-full text-xs font-medium bg-white hover:bg-[#e4e6eb]/60 dark:bg-[#202c33] dark:hover:bg-[#2a3942] text-[#0084ff] dark:text-[#4599ff] border border-[#e4e6eb] dark:border-[#2a3942] transition cursor-pointer"
                      >
                        {tpl.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={onOpenGlobalSettings}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-[#65676b] hover:text-[#050505] dark:text-[#8696a0] dark:hover:text-[#e9edef] transition cursor-pointer"
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
      <div className="px-3 py-2.5 bg-white dark:bg-[#202c33] border-t border-[#e4e6eb] dark:border-[#222d34] shrink-0">
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="flex items-end gap-2"
        >
          <button
            type="button"
            onClick={onOpenAddContextModal}
            title="Add project context or link"
            aria-label="Add project context or link"
            className="w-9 h-9 rounded-full text-[#0084ff] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] flex items-center justify-center shrink-0 transition cursor-pointer"
          >
            <Plus className="w-5 h-5" />
          </button>

          <div className="flex-1 rounded-3xl bg-[#f0f2f5] dark:bg-[#2a3942] px-4 py-2 flex items-center">
            <label htmlFor={chatInputId} className="sr-only">
              Type a message
            </label>
            <textarea
              id={chatInputId}
              value={draftPrompt}
              onChange={(e) => setDraftPrompt(e.target.value)}
              onCompositionEnd={(e) => {
                lastCompositionEndAtRef.current = e.timeStamp;
              }}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${project.name} (${activeContexts.length} contexts active)...`}
              className="chat-auto-textarea bg-transparent text-[14px] text-[#050505] dark:text-[#e9edef] placeholder:text-[#65676b] dark:placeholder:text-[#8696a0] outline-none resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={!draftPrompt.trim()}
            aria-label="Send message"
            className="w-9 h-9 rounded-full bg-[#0084ff] hover:bg-[#0073e6] disabled:opacity-40 disabled:pointer-events-none text-white flex items-center justify-center shrink-0 transition cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </main>
  );
}
