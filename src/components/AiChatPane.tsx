"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import {
  BUSINESS_STATUS_META,
  CryptoProject,
  ProjectBusinessStatus,
  ProjectContextItem,
} from "@/types/project";
import { ProjectAvatar } from "@/components/ProjectAvatar";
import {
  Sparkles,
  Send,
  Globe,
  AtSign,
  Briefcase,
  MessageSquareText,
  Copy,
  Check,
  SlidersHorizontal,
  PlusCircle,
  PanelRightOpen,
  RotateCcw,
  SendHorizontal,
} from "lucide-react";

interface AiChatPaneProps {
  project: CryptoProject;
  draftPrompt: string;
  setDraftPrompt: React.Dispatch<React.SetStateAction<string>>;
  onSendMessage: (content: string) => void;
  onResetConversation: () => void;
  onUpdateBusinessStatus: (status: ProjectBusinessStatus) => void;
  onOpenAddContextModal: () => void;
  onOpenEditLogoModal: () => void;
  isContextPanelOpen: boolean;
  onToggleContextPanel: () => void;
  isAiTyping: boolean;
}

const QUICK_PROMPTS = [
  {
    label: "🧵 X Viral Thread",
    prompt:
      "Draft a high-conviction 5-part X (Twitter) thread leveraging our active website positioning, X handle tone, and campaign brief.",
  },
  {
    label: "💼 LinkedIn Partner Post",
    prompt:
      "Write an institutional LinkedIn post tailored for Web3 VCs, market makers, and enterprise partners using our LinkedIn and website context.",
  },
  {
    label: "🤝 Tier-1 KOL Outreach DM",
    prompt:
      "Create 3 personalized X/Telegram DM outreach templates to pitch Tier-1 crypto KOLs on our upcoming catalyst.",
  },
  {
    label: "📣 Community Raid & Shill Kit",
    prompt:
      "Generate a community announcement + 4 talking-point bullets our ambassadors can use on X and Telegram without sounding robotic.",
  },
];

function getContextIcon(type: ProjectContextItem["type"]) {
  switch (type) {
    case "website":
      return <Globe className="w-3 h-3 text-sky-500" />;
    case "x_handle":
      return <AtSign className="w-3 h-3 text-slate-900 dark:text-white" />;
    case "linkedin":
      return <Briefcase className="w-3 h-3 text-blue-600 dark:text-blue-400" />;
    case "telegram":
      return <SendHorizontal className="w-3 h-3 text-cyan-500" />;
    case "message":
      return <MessageSquareText className="w-3 h-3 text-amber-500" />;
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
            className="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 font-mono text-[11px] text-indigo-600 dark:text-indigo-300"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        if (trimmed.startsWith("### ")) {
          return (
            <h3
              key={idx}
              className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 pt-2"
            >
              {trimmed.replace("### ", "")}
            </h3>
          );
        }

        if (trimmed.startsWith("- ")) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 shrink-0" />
              <p className="flex-1">{formatInline(trimmed.slice(2))}</p>
            </div>
          );
        }

        if (trimmed.startsWith("> ")) {
          return (
            <blockquote
              key={idx}
              className="border-l-2 border-indigo-500 pl-3 py-1 my-1 italic text-slate-600 dark:text-slate-300 bg-indigo-500/5 rounded-r-lg"
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
  draftPrompt,
  setDraftPrompt,
  onSendMessage,
  onResetConversation,
  onUpdateBusinessStatus,
  onOpenAddContextModal,
  onOpenEditLogoModal,
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

  // IME-safe Enter-to-submit following modern-web-guidance (ime-safe-enter-submit)
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
    <main className="flex-1 h-full flex flex-col min-w-0 bg-slate-50/50 dark:bg-slate-950">
      {/* Messenger-style Conversation Header */}
      <header className="px-5 py-3 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3.5 min-w-0">
          <ProjectAvatar
            project={project}
            size="md"
            showOnlineDot
            onEditClick={onOpenEditLogoModal}
          />

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-base text-slate-900 dark:text-white truncate">
                {project.name}
              </h2>
              <span className="px-2 py-0.5 text-[11px] font-mono font-semibold rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                {project.ticker}
              </span>
              <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {project.chain} • {project.stage}
              </span>

              {/* Business Status Selector Badge */}
              <div
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] font-semibold ${
                  BUSINESS_STATUS_META[project.businessStatus].badgeClass
                }`}
              >
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
                  className="status-auto-select bg-transparent font-semibold outline-none cursor-pointer"
                >
                  <option
                    value="new"
                    className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  >
                    New Lead
                  </option>
                  <option
                    value="contacted"
                    className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  >
                    Contacted
                  </option>
                  <option
                    value="collaborated"
                    className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  >
                    Collaborated
                  </option>
                  <option
                    value="completed"
                    className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  >
                    Completed
                  </option>
                  <option
                    value="unresponsive"
                    className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  >
                    Unresponsive
                  </option>
                  <option
                    value="archived"
                    className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  >
                    Archived
                  </option>
                </select>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {project.tagline}
            </p>
          </div>
        </div>

        {/* Right Header Actions & Context Drawer Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenAddContextModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-300 border border-indigo-500/25 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Context</span>
          </button>

          <button
            type="button"
            onClick={onResetConversation}
            title="Reset AI Chat Thread"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onToggleContextPanel}
            title={
              isContextPanelOpen
                ? "Hide Project Context Sidebar"
                : "Show Project Context Sidebar"
            }
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              isContextPanelOpen
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 border-transparent"
                : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800"
            }`}
          >
            <PanelRightOpen className="w-3.5 h-3.5" />
            <span>Contexts ({activeContexts.length})</span>
          </button>
        </div>
      </header>

      {/* Active Context Banner (Shows Admin what contexts AI is grounded on right now) */}
      <div className="px-5 py-2 bg-indigo-500/5 border-b border-indigo-500/15 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 shrink-0">
            <SlidersHorizontal className="w-3 h-3" />
            AI Grounded In:
          </span>
          {activeContexts.length === 0 ? (
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
              No active contexts enabled — toggle contexts on the right panel for tailored crypto responses.
            </span>
          ) : (
            <div className="flex items-center gap-1.5">
              {activeContexts.map((ctx) => (
                <span
                  key={ctx.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap shadow-2xs"
                >
                  {getContextIcon(ctx.type)}
                  <span>{ctx.title}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Messenger Chat Thread Area */}
      <div className="flex-1 overflow-y-auto scroller px-4 sm:px-6 py-5 space-y-5">
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
              className={`flex items-end gap-3 ${
                isAdmin ? "justify-end" : "justify-start"
              }`}
            >
              {/* AI Agent Avatar on Left */}
              {!isAdmin && (
                <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-500 flex items-center justify-center text-white shadow-sm shrink-0 mb-1">
                  <Sparkles className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-2xl flex flex-col ${
                  isAdmin ? "items-end" : "items-start"
                }`}
              >
                {/* Sender & Context Citation Pills */}
                <div className="flex items-center gap-2 mb-1 px-1 flex-wrap">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {isAdmin
                      ? "Admin (You)"
                      : `${project.ticker} Marketing AI Agent`}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {msg.timestamp}
                  </span>
                  {!isAdmin && referencedContexts.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {referencedContexts.map((ctx) => (
                        <span
                          key={ctx.id}
                          title={`Grounded on: ${ctx.title} (${ctx.value})`}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20"
                        >
                          {getContextIcon(ctx.type)}
                          <span className="max-w-28 truncate">{ctx.title}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`rounded-2xl px-4 py-3 shadow-xs relative group ${
                    isAdmin
                      ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-br-xs"
                      : "bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/90 text-slate-800 dark:text-slate-100 rounded-bl-xs"
                  }`}
                >
                  <FormattedMessageContent content={msg.content} />

                  {/* Copy Button for AI Messages */}
                  {!isAdmin && (
                    <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition cursor-pointer"
                      >
                        {copiedMsgId === msg.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-500">Copied copy</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy campaign copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Suggested Follow-up Actions from AI */}
                {!isAdmin &&
                  msg.suggestedActions &&
                  msg.suggestedActions.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      {msg.suggestedActions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => onSendMessage(suggestion)}
                          className="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50/90 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25 transition cursor-pointer"
                        >
                          ✨ {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            </div>
          );
        })}

        {isAiTyping && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-500 flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-4 h-4 animate-spin" />
            </div>
            <div className="px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <span>
                Synthesizing {activeContexts.length} active{" "}
                <strong>{project.ticker}</strong> contexts...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Messenger Composer Footer */}
      <div className="p-3 sm:p-4 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 shrink-0">
        {/* Quick Campaign Prompt Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2.5">
          {QUICK_PROMPTS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setDraftPrompt(item.prompt)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-indigo-950/70 text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-300 border border-slate-200/70 dark:border-slate-800 transition whitespace-nowrap cursor-pointer"
            >
              {item.label}
            </button>
          ))}
        </div>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="relative rounded-2xl bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 focus-within:border-indigo-500/70 focus-within:bg-white dark:focus-within:bg-slate-900 transition p-2.5 shadow-2xs"
        >
          <label htmlFor={chatInputId} className="sr-only">
            Message {project.name} AI Marketing Agent
          </label>
          <textarea
            id={chatInputId}
            value={draftPrompt}
            onChange={(e) => setDraftPrompt(e.target.value)}
            onCompositionEnd={(e) => {
              lastCompositionEndAtRef.current = e.timeStamp;
            }}
            onKeyDown={handleKeyDown}
            placeholder={`Talk to AI with ${project.name} (${project.ticker}) contexts... (Press Enter to send, Shift+Enter for new line)`}
            className="chat-auto-textarea bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none resize-none px-1.5"
          />

          <div className="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-slate-200/60 dark:border-slate-800/60">
            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {activeContexts.length} of {project.contexts.length} project
                contexts active
              </span>
              <span className="hidden sm:inline text-slate-400">
                • Toggle or add links/notes in the right sidebar
              </span>
            </div>

            <button
              type="submit"
              disabled={!draftPrompt.trim()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-white shadow-sm transition cursor-pointer"
            >
              <span>Send to AI</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
