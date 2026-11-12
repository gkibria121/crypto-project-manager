"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ArrowLeft,
  AtSign,
  Bot,
  Check,
  Copy,
  Cpu,
  Info,
  KeyRound,
  Layers,
  ListChecks,
  Lock,
  Plus,
  RotateCcw,
  Send,
  Settings,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import {
  AI_PROVIDER_META,
  type AiConfigurationSummary,
  type AuthUser,
  BUSINESS_STATUS_META,
  BUSINESS_STATUS_ORDER,
  chatComposerFormSchema,
  type ChatComposerFormValues,
  type ChatMentionSuggestion,
  type ChecklistItemConfig,
  type CryptoProject,
  hasPermission,
  type McpOverview,
  type ProjectBusinessStatus,
  type PromptTemplate,
  USER_ROLE_META,
} from "@/types/project";
import { ProjectAvatar } from "@/components/ProjectAvatar";
import {
  ContextTypeIcon,
  FormattedMessageContent,
  PaginationBar,
} from "@/components/ui";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useImeSafeSubmit } from "@/hooks/useImeSafeSubmit";
import { usePagination } from "@/hooks/usePagination";

export interface SendChatPayload {
  content: string;
  template?: PromptTemplate;
  contextIds?: string[];
  includeProjectSummary?: boolean;
}

interface AiChatPaneProps {
  project: CryptoProject;
  currentUser: AuthUser;
  aiConfig?: AiConfigurationSummary;
  isAiConfigLoading?: boolean;
  mcpOverview?: McpOverview;
  mentionSuggestions?: ChatMentionSuggestion[];
  promptTemplates: PromptTemplate[];
  checklistItems: ChecklistItemConfig[];
  draftPrompt: string;
  setDraftPrompt: React.Dispatch<React.SetStateAction<string>>;
  attachedContextIds: string[];
  setAttachedContextIds: React.Dispatch<React.SetStateAction<string[]>>;
  includeProjectSummary: boolean;
  setIncludeProjectSummary: React.Dispatch<React.SetStateAction<boolean>>;
  onSendMessage: (payload: SendChatPayload) => Promise<void>;
  sendMessageError?: string | null;
  sendMessageErrorCode?: string | null;
  onClearSendError?: () => void;
  onResetConversation: () => void;
  onUpdateBusinessStatus: (status: ProjectBusinessStatus) => void;
  onOpenAddContextModal: () => void;
  onOpenEditLogoModal: () => void;
  onOpenChecklistModal: () => void;
  onOpenGlobalSettings: () => void;
  onOpenAiSettings?: () => void;
  onOpenMcpSettings?: () => void;
  isContextPanelOpen: boolean;
  onToggleContextPanel: () => void;
  isAiTyping: boolean;
  isMobileHidden?: boolean;
  onBackToProjects?: () => void;
  totalUnreadCount?: number;
}

export function AiChatPane({
  project,
  currentUser,
  aiConfig,
  isAiConfigLoading = false,
  mcpOverview,
  mentionSuggestions = [],
  promptTemplates,
  checklistItems,
  draftPrompt,
  setDraftPrompt,
  attachedContextIds,
  setAttachedContextIds,
  includeProjectSummary,
  setIncludeProjectSummary,
  onSendMessage,
  sendMessageError,
  sendMessageErrorCode,
  onClearSendError,
  onResetConversation,
  onUpdateBusinessStatus,
  onOpenAddContextModal,
  onOpenEditLogoModal,
  onOpenChecklistModal,
  onOpenGlobalSettings,
  onOpenAiSettings,
  onOpenMcpSettings,
  isContextPanelOpen,
  onToggleContextPanel,
  isAiTyping,
  isMobileHidden = false,
  onBackToProjects,
  totalUnreadCount = 0,
}: AiChatPaneProps) {
  const canUpdateProject = hasPermission(currentUser, "projects:update");
  const canWriteChat = hasPermission(currentUser, "chat:write");
  const canWriteContexts = hasPermission(currentUser, "contexts:write");
  const canWriteSettings = hasPermission(currentUser, "settings:write");
  const isAdminUser =
    currentUser.role === "admin" || hasPermission(currentUser, "users:write");

  const chatInputId = useId();
  const statusSelectId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionHighlightIdx, setMentionHighlightIdx] = useState(0);

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

  const validAttachedIds = attachedContextIds.filter((id) =>
    project.contexts.some((c) => c.id === id)
  );
  const attachedContexts = project.contexts.filter((c) =>
    validAttachedIds.includes(c.id)
  );
  const totalAttachedCount =
    attachedContexts.length + (includeProjectSummary ? 1 : 0);

  const checkedCount = checklistItems.filter(
    (item) => project.checklistState?.[item.id]?.checked
  ).length;
  const messagesPagination = usePagination(project.messages, {
    initialPageSize: 20,
    pageSizeOptions: [10, 20, 50, 100],
    resetKey: project.id,
    initialPageStrategy: "last",
  });
  const latestMessageId = project.messages[project.messages.length - 1]?.id;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [project.id, project.messages.length, isAiTyping]);

  const needsApiKey =
    (!isAiConfigLoading && aiConfig !== undefined && !aiConfig.hasConfiguredProvider) ||
    sendMessageErrorCode === "AI_API_KEY_REQUIRED";

  const activeProviderLabel =
    aiConfig?.activeProvider && aiConfig.hasConfiguredProvider
      ? `${AI_PROVIDER_META[aiConfig.activeProvider].shortLabel}${
          aiConfig.activeModel ? ` · ${aiConfig.activeModel}` : ""
        }`
      : null;

  const dispatchMessage = async (
    content: string,
    template?: PromptTemplate
  ) => {
    onClearSendError?.();
    try {
      await onSendMessage({
        content,
        template,
        ...(validAttachedIds.length > 0
          ? { contextIds: validAttachedIds }
          : {}),
        ...(includeProjectSummary ? { includeProjectSummary: true } : {}),
      });
      reset({ content: "" });
      setDraftPrompt("");
      setAttachedContextIds([]);
      setIncludeProjectSummary(false);
      setIsAttachMenuOpen(false);
    } catch {
      // Error surfaced via sendMessageError; keep user draft intact.
    }
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    void handleSubmit(async (values) => {
      await dispatchMessage(values.content);
    })(e);
  };

  const triggerSubmit = useCallback(() => {
    formRef.current?.requestSubmit();
  }, []);

  const { onCompositionEnd, onKeyDown: imeKeyDown } =
    useImeSafeSubmit(triggerSubmit);

  const filteredMentions =
    mentionQuery !== null
      ? mentionSuggestions.filter((item) => {
          const q = mentionQuery.toLowerCase();
          return (
            item.tag.toLowerCase().includes(q) ||
            item.label.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q)
          );
        })
      : [];

  const updateMentionQueryFromValue = (val: string, cursorPos?: number) => {
    const pos = cursorPos ?? val.length;
    const beforeCursor = val.slice(0, pos);
    const match = beforeCursor.match(/(?:^|[\s(,;])@([a-zA-Z0-9_-]*)$/);
    if (match) {
      setMentionQuery(match[1] ?? "");
      setMentionHighlightIdx(0);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMentionTag = (tag: string) => {
    const current = watchedContent;
    const el = textareaRef.current;
    const cursorPos = el?.selectionStart ?? current.length;
    const beforeCursor = current.slice(0, cursorPos);
    const afterCursor = current.slice(cursorPos);

    let nextValue: string;
    let nextCursor: number;
    const match = beforeCursor.match(/(?:^|[\s(,;])@([a-zA-Z0-9_-]*)$/);
    if (match) {
      const replaceStart = beforeCursor.length - (match[1]?.length ?? 0) - 1;
      const prefix = beforeCursor.slice(0, replaceStart);
      nextValue = `${prefix}${tag} ${afterCursor}`;
      nextCursor = prefix.length + tag.length + 1;
    } else {
      const needsSpace =
        beforeCursor.length > 0 && !/\s$/.test(beforeCursor);
      const inserted = `${needsSpace ? " " : ""}${tag} `;
      nextValue = `${beforeCursor}${inserted}${afterCursor}`;
      nextCursor = beforeCursor.length + inserted.length;
    }

    setValue("content", nextValue, { shouldValidate: true });
    setDraftPrompt(nextValue);
    setMentionQuery(null);

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextCursor, nextCursor);
      }
    });
  };

  const handleTextareaKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (mentionQuery !== null && filteredMentions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionHighlightIdx((prev) => (prev + 1) % filteredMentions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionHighlightIdx(
          (prev) =>
            (prev - 1 + filteredMentions.length) % filteredMentions.length
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const chosen =
          filteredMentions[mentionHighlightIdx] ?? filteredMentions[0];
        if (chosen) insertMentionTag(chosen.tag);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
    imeKeyDown(e);
  };

  const contentRegister = register("content", {
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      setDraftPrompt(next);
      updateMentionQueryFromValue(next, e.target.selectionStart ?? next.length);
      if (sendMessageError) onClearSendError?.();
    },
  });

  const toggleAttachedContext = (contextId: string) => {
    setAttachedContextIds((prev) =>
      prev.includes(contextId)
        ? prev.filter((id) => id !== contextId)
        : [...prev, contextId]
    );
  };

  const handleOpenConfigureKey = () => {
    if (onOpenAiSettings) {
      onOpenAiSettings();
    } else {
      onOpenGlobalSettings();
    }
  };

  return (
    <main
      className={`${
        isMobileHidden ? "hidden md:flex" : "flex"
      } flex-1 h-full flex-col min-w-0 bg-[#f0f2f5] dark:bg-[#0b141a]`}
    >
      {/* Header */}
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
            onEditClick={canUpdateProject ? onOpenEditLogoModal : undefined}
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

            {/* Subtitle Row: Inline Business Status + Active AI Model */}
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
                disabled={!canUpdateProject}
                onChange={(e) =>
                  onUpdateBusinessStatus(
                    e.target.value as ProjectBusinessStatus
                  )
                }
                className="status-auto-select bg-transparent font-medium text-xs text-[#050505] dark:text-[#e9edef] outline-none cursor-pointer disabled:cursor-default"
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
              {activeProviderLabel ? (
                <span className="inline-flex items-center gap-1 truncate text-[#00a884] dark:text-emerald-400 font-medium">
                  <Sparkles className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{activeProviderLabel}</span>
                </span>
              ) : !isAiConfigLoading ? (
                <button
                  type="button"
                  onClick={
                    canWriteSettings ? handleOpenConfigureKey : undefined
                  }
                  className={`inline-flex items-center gap-1 truncate text-amber-600 dark:text-amber-400 font-semibold ${
                    canWriteSettings ? "hover:underline cursor-pointer" : "cursor-default"
                  }`}
                >
                  <KeyRound className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span>API Key Needed</span>
                </button>
              ) : (
                <span className="truncate">AI Chat</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Header Icon Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {mcpOverview && (
            <button
              type="button"
              onClick={
                canWriteSettings
                  ? onOpenMcpSettings ?? onOpenGlobalSettings
                  : undefined
              }
              title={`MCP Servers active (${mcpOverview.totalTools} tools discovered). Click to inspect or manage MCP servers.`}
              className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 transition ${
                canWriteSettings
                  ? "hover:bg-emerald-500/20 cursor-pointer"
                  : "cursor-default"
              }`}
            >
              <Cpu className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>MCP · {mcpOverview.totalTools} tools</span>
            </button>
          )}

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

          {canWriteSettings && (
            <button
              type="button"
              onClick={onOpenGlobalSettings}
              title="AI providers, system prompts & global checklist"
              aria-label="Global settings"
              className="w-9 h-9 rounded-full text-[#65676b] dark:text-[#8696a0] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] flex items-center justify-center transition cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          {canWriteChat && (
            <button
              type="button"
              onClick={onResetConversation}
              title="New chat / Clear conversation"
              aria-label="Clear chat"
              className="w-9 h-9 rounded-full text-[#65676b] dark:text-[#8696a0] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] flex items-center justify-center transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

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

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto scroller px-3 sm:px-6 py-3 sm:py-4 space-y-3">
        {/* Missing API Key Prompt */}
        {needsApiKey && (
          <div
            role="alert"
            className="max-w-2xl mx-auto rounded-2xl border border-amber-500/40 bg-amber-500/10 dark:bg-amber-500/15 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                <KeyRound className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-[#050505] dark:text-[#e9edef]">
                  API Key Required to Start Chatting
                </h3>
                <p className="text-xs text-[#65676b] dark:text-[#d1d7db] leading-relaxed">
                  {canWriteSettings
                    ? "No AI provider API key is configured. Add your Google AI Studio (Gemini), OpenAI, Anthropic, Groq, or OpenRouter API key to activate the chatbot."
                    : "No AI provider API key is configured yet. Ask a Workspace Admin to set an API key (e.g., Google AI Studio) in Admin Dashboard → AI Providers."}
                </p>
              </div>
            </div>

            {canWriteSettings && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleOpenConfigureKey}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] text-white transition cursor-pointer"
                >
                  Set API Key
                </button>
                {isAdminUser && (
                  <Link
                    href="/admin?section=ai"
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] text-[#050505] dark:text-[#e9edef] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] transition"
                  >
                    Admin Dashboard
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {project.messages.length > 10 && (
          <div className="pb-2 border-b border-[#e4e6eb] dark:border-[#222d34]">
            <PaginationBar
              variant="compact"
              meta={messagesPagination.meta}
              pageSizeOptions={messagesPagination.pageSizeOptions}
              onPageChange={messagesPagination.setPage}
              onPageSizeChange={messagesPagination.setPageSize}
              itemLabel="messages"
              ariaLabel="Chat messages pagination"
              hideWhenSinglePage={project.messages.length <= 10}
            />
          </div>
        )}

        {/* Clean Empty State */}
        {project.messages.length === 0 && !isAiTyping && (
          <div className="max-w-xl mx-auto py-10 px-4 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#0084ff]/12 text-[#0084ff] flex items-center justify-center mx-auto">
              <Bot className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#050505] dark:text-[#e9edef]">
                How can I help you today?
              </h3>
              <p className="text-xs text-[#65676b] dark:text-[#8696a0] max-w-md mx-auto leading-relaxed">
                This session retains your conversation history automatically.
                Type{" "}
                <code className="font-mono text-[#0084ff]">@context</code> for
                company info or{" "}
                <code className="font-mono text-[#0084ff]">@linkedin</code>,{" "}
                <code className="font-mono text-[#0084ff]">@website</code>,{" "}
                <code className="font-mono text-[#0084ff]">@x</code>,{" "}
                <code className="font-mono text-[#0084ff]">@scrape</code> to let
                the chatbot fetch backend context and scrape links via MCP
                tools.
              </p>
            </div>

            {canWriteChat && (
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {["@context", "@linkedin", "@website", "@x", "@scrape"].map(
                  (tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => insertMentionTag(tag)}
                      className="px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-[#e7f3ff]/80 hover:bg-[#e7f3ff] dark:bg-[#0084ff]/15 dark:hover:bg-[#0084ff]/25 text-[#0084ff] dark:text-[#4599ff] transition cursor-pointer"
                    >
                      {tag}
                    </button>
                  )
                )}
              </div>
            )}

            {canWriteChat && promptTemplates.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
                {promptTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    disabled={isAiTyping}
                    onClick={() => void dispatchMessage(tpl.label, tpl)}
                    title={`System Prompt: ${tpl.systemPrompt}`}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-white hover:bg-[#e4e6eb]/60 dark:bg-[#202c33] dark:hover:bg-[#2a3942] text-[#0084ff] dark:text-[#4599ff] border border-[#e4e6eb] dark:border-[#2a3942] disabled:opacity-50 transition cursor-pointer"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messagesPagination.items.map((msg) => {
          const isAdmin = msg.sender === "admin";
          const isLatestMessage = msg.id === latestMessageId;
          const referencedContexts = project.contexts.filter((c) =>
            msg.usedContextIds?.includes(c.id)
          );

          return (
            <div
              key={msg.id}
              style={
                isLatestMessage
                  ? ({ scrollInitialTarget: "nearest" } as React.CSSProperties)
                  : undefined
              }
              className={`flex items-end gap-2 min-w-0 ${
                isAdmin ? "justify-end" : "justify-start"
              }`}
            >
              {!isAdmin && (
                <div className="hidden xs:block sm:block shrink-0 w-7 h-7 rounded-full bg-[#0084ff]/15 text-[#0084ff] flex items-center justify-center">
                  <Bot className="w-4 h-4" aria-hidden="true" />
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

                  {/* Footer: Attached Context Pills (only if explicitly provided) + Model + Copy + Timestamp */}
                  <div
                    className={`flex items-center justify-between gap-2 sm:gap-3 mt-1.5 pt-1 text-[11px] flex-wrap ${
                      isAdmin
                        ? "text-white/80 justify-end"
                        : "text-[#65676b] dark:text-[#8696a0] border-t border-[#f0f2f5] dark:border-[#2a3942]"
                    }`}
                  >
                    {(referencedContexts.length > 0 ||
                      (msg.mcpToolsUsed && msg.mcpToolsUsed.length > 0) ||
                      (msg.resolvedTags && msg.resolvedTags.length > 0)) && (
                      <div className="flex items-center gap-1 flex-wrap min-w-0">
                        {msg.resolvedTags?.map((tag) => (
                          <span
                            key={`tag-${tag}`}
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              isAdmin
                                ? "bg-white/15 text-white"
                                : "bg-[#e7f3ff] dark:bg-[#0084ff]/20 text-[#0084ff] dark:text-[#4599ff]"
                            }`}
                          >
                            {tag}
                          </span>
                        ))}
                        {referencedContexts.map((ctx) => (
                          <span
                            key={ctx.id}
                            title={`${ctx.title}: ${ctx.value}`}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${
                              isAdmin
                                ? "bg-white/15 text-white"
                                : "bg-[#f0f2f5] dark:bg-[#2a3942] text-[#65676b] dark:text-[#d1d7db]"
                            }`}
                          >
                            <ContextTypeIcon type={ctx.type} variant="sm" />
                            <span className="max-w-24 truncate">
                              {ctx.title}
                            </span>
                          </span>
                        ))}
                        {!isAdmin &&
                          msg.mcpToolsUsed?.map((tool) => (
                            <span
                              key={`mcp-${tool}`}
                              title={`Executed via MCP tool: ${tool}`}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                            >
                              <Wrench className="w-2.5 h-2.5" aria-hidden="true" />
                              <span>{tool}</span>
                            </span>
                          ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 ml-auto shrink-0">
                      {!isAdmin && msg.model && (
                        <span className="font-mono text-[10px] opacity-80">
                          {msg.model}
                        </span>
                      )}
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

                {/* Quick Prompt Chips on Latest AI Message */}
                {!isAdmin && canWriteChat && isLatestMessage && (
                  <div className="chip-wrap-balance items-center gap-1.5 mt-2">
                    {promptTemplates.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        disabled={isAiTyping}
                        onClick={() => void dispatchMessage(tpl.label, tpl)}
                        title={`System Prompt: ${tpl.systemPrompt}`}
                        className="px-3 py-1.5 sm:py-1 rounded-full text-xs font-medium text-left bg-white hover:bg-[#e4e6eb]/60 dark:bg-[#202c33] dark:hover:bg-[#2a3942] text-[#0084ff] dark:text-[#4599ff] border border-[#e4e6eb] dark:border-[#2a3942] disabled:opacity-50 transition cursor-pointer"
                      >
                        {tpl.label}
                      </button>
                    ))}
                    {canWriteSettings && (
                      <button
                        type="button"
                        onClick={onOpenGlobalSettings}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 sm:py-1 rounded-full text-[11px] font-medium text-[#65676b] hover:text-[#050505] dark:text-[#8696a0] dark:hover:text-[#e9edef] transition cursor-pointer"
                      >
                        <Settings className="w-3 h-3" />
                        <span>Edit prompts</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isAiTyping && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#0084ff]/15 text-[#0084ff] flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="px-3.5 py-2 rounded-2xl bg-white dark:bg-[#202c33] text-xs text-[#65676b] dark:text-[#8696a0]">
              Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer Footer */}
      <div className="relative px-2.5 sm:px-3 pt-2 pb-[max(0.625rem,env(safe-area-inset-bottom))] bg-white dark:bg-[#202c33] border-t border-[#e4e6eb] dark:border-[#222d34] shrink-0 space-y-2">
        {/* Inline Send Error Banner */}
        {sendMessageError && (
          <div
            role="alert"
            className="rounded-xl bg-rose-500/12 border border-rose-500/30 px-3 py-2 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{sendMessageError}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {sendMessageErrorCode === "AI_API_KEY_REQUIRED" &&
                canWriteSettings && (
                  <button
                    type="button"
                    onClick={handleOpenConfigureKey}
                    className="px-2 py-1 rounded-lg bg-[#0084ff] text-white text-[11px] font-semibold cursor-pointer"
                  >
                    Set API Key
                  </button>
                )}
              <button
                type="button"
                onClick={() => onClearSendError?.()}
                aria-label="Dismiss error"
                className="p-0.5 hover:opacity-75 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Live @Mention Autocomplete Popover */}
        {mentionQuery !== null && canWriteChat && (
          <div
            role="listbox"
            aria-label="Context and MCP tag suggestions"
            className="absolute bottom-full left-3 right-3 sm:right-auto sm:w-md mb-2 rounded-2xl bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] shadow-xl p-2 z-30 max-h-64 overflow-y-auto scroller space-y-1"
          >
            <div className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#65676b] dark:text-[#8696a0]">
              <span>Backend @Tags & MCP Tools</span>
              <span>↑↓ Navigate · Enter to insert</span>
            </div>
            {filteredMentions.length === 0 ? (
              <div className="px-2.5 py-2 text-xs text-[#65676b] dark:text-[#8696a0]">
                No matching @tag found.
              </div>
            ) : (
              filteredMentions.map((item, idx) => {
                const isSelected = idx === mentionHighlightIdx;
                return (
                  <button
                    key={item.tag}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMentionTag(item.tag);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-xl flex items-start justify-between gap-2 transition cursor-pointer ${
                      isSelected
                        ? "bg-[#e7f3ff] dark:bg-[#0084ff]/20"
                        : "hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942]"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-[#0084ff] dark:text-[#4599ff]">
                          {item.tag}
                        </span>
                        <span className="text-xs font-semibold text-[#050505] dark:text-[#e9edef] truncate">
                          {item.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#65676b] dark:text-[#8696a0] truncate">
                        {item.description}
                      </p>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                        item.isReady
                          ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                          : "bg-slate-500/12 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {item.availableCount > 0
                        ? `${item.availableCount} ready`
                        : item.category}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Explicit Attached Context Popover */}
        {isAttachMenuOpen && canWriteChat && (
          <div className="absolute bottom-full left-3 right-3 sm:right-auto sm:w-96 mb-2 rounded-2xl bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] shadow-xl p-3 space-y-2.5 z-20">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#050505] dark:text-[#e9edef]">
                Attach Context to This Message
              </span>
              <button
                type="button"
                onClick={() => setIsAttachMenuOpen(false)}
                aria-label="Close attach context menu"
                className="p-1 rounded-lg text-[#65676b] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-[#65676b] dark:text-[#8696a0]">
              Only items you check below are sent to the AI with your message.
            </p>
            <div className="max-h-56 overflow-y-auto scroller space-y-1.5 pr-1">
              <label className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeProjectSummary}
                  onChange={(e) => setIncludeProjectSummary(e.target.checked)}
                  className="checkbox-native mt-0.5 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#050505] dark:text-[#e9edef]">
                    Project Overview ({project.name})
                  </div>
                  <div className="text-[11px] text-[#65676b] dark:text-[#8696a0] truncate">
                    {project.ticker} · {project.chain} · {project.stage}
                  </div>
                </div>
              </label>

              {project.contexts.map((ctx) => {
                const isChecked = validAttachedIds.includes(ctx.id);
                return (
                  <label
                    key={ctx.id}
                    className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleAttachedContext(ctx.id)}
                      className="checkbox-native mt-0.5 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#050505] dark:text-[#e9edef]">
                        <ContextTypeIcon type={ctx.type} variant="sm" />
                        <span className="truncate">{ctx.title}</span>
                      </div>
                      <div className="text-[11px] text-[#65676b] dark:text-[#8696a0] truncate">
                        {ctx.value}
                      </div>
                    </div>
                  </label>
                );
              })}

              {project.contexts.length === 0 && (
                <div className="text-[11px] text-[#65676b] dark:text-[#8696a0] px-2 py-1">
                  No project links or notes saved yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Attached Context Chips */}
        {totalAttachedCount > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap px-1">
            {includeProjectSummary && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#e7f3ff] dark:bg-[#0084ff]/20 text-[#0084ff] dark:text-[#4599ff]">
                <span>Project Overview</span>
                <button
                  type="button"
                  onClick={() => setIncludeProjectSummary(false)}
                  aria-label="Remove project overview attachment"
                  className="hover:opacity-75 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {attachedContexts.map((ctx) => (
              <span
                key={ctx.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#f0f2f5] dark:bg-[#2a3942] text-[#050505] dark:text-[#e9edef]"
              >
                <ContextTypeIcon type={ctx.type} variant="sm" />
                <span className="max-w-36 truncate">{ctx.title}</span>
                <button
                  type="button"
                  onClick={() => toggleAttachedContext(ctx.id)}
                  aria-label={`Remove ${ctx.title} attachment`}
                  className="hover:opacity-75 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {canWriteChat ? (
          <form
            ref={formRef}
            onSubmit={handleFormSubmit}
            noValidate
            className="flex items-end gap-1.5 sm:gap-2"
          >
            <button
              type="button"
              onClick={() => {
                setIsAttachMenuOpen(false);
                if (mentionQuery !== null) {
                  setMentionQuery(null);
                } else {
                  setMentionQuery("");
                  setMentionHighlightIdx(0);
                }
              }}
              title="Insert @context, @linkedin, @website, @x, or @scrape tag"
              aria-label="Browse @tags from backend"
              className={`w-10 h-10 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 transition cursor-pointer ${
                mentionQuery !== null
                  ? "bg-[#e7f3ff] text-[#0084ff] dark:bg-[#0084ff]/20 dark:text-[#4599ff]"
                  : "text-[#65676b] dark:text-[#8696a0] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942]"
              }`}
            >
              <AtSign className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsAttachMenuOpen((prev) => !prev)}
              title="Attach project context to this message"
              aria-label="Attach project context to this message"
              aria-expanded={isAttachMenuOpen}
              className={`w-10 h-10 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 transition cursor-pointer ${
                totalAttachedCount > 0 || isAttachMenuOpen
                  ? "bg-[#e7f3ff] text-[#0084ff] dark:bg-[#0084ff]/20 dark:text-[#4599ff]"
                  : "text-[#65676b] dark:text-[#8696a0] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942]"
              }`}
            >
              <Layers className="w-4 h-4" />
            </button>

            {canWriteContexts && (
              <button
                type="button"
                onClick={onOpenAddContextModal}
                title="Save new project link or note"
                aria-label="Add project context or link"
                className="w-10 h-10 sm:w-9 sm:h-9 rounded-full text-[#0084ff] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] flex items-center justify-center shrink-0 transition cursor-pointer"
              >
                <Plus className="w-5 h-5" />
              </button>
            )}

            <div className="flex-1 min-w-0 rounded-3xl bg-[#f0f2f5] dark:bg-[#2a3942] px-3.5 sm:px-4 py-2 flex items-center">
              <label htmlFor={chatInputId} className="sr-only">
                Type a message
              </label>
              <textarea
                id={chatInputId}
                {...contentRegister}
                ref={(el) => {
                  contentRegister.ref(el);
                  textareaRef.current = el;
                }}
                onCompositionEnd={onCompositionEnd}
                onKeyDown={handleTextareaKeyDown}
                placeholder={
                  totalAttachedCount > 0
                    ? `Message AI (${totalAttachedCount} context${totalAttachedCount > 1 ? "s" : ""} attached)...`
                    : "Message AI... (type @ for @context, @linkedin, @website, @scrape)"
                }
                className="chat-auto-textarea bg-transparent text-base sm:text-[14px] text-[#050505] dark:text-[#e9edef] placeholder:text-[#65676b] dark:placeholder:text-[#8696a0] outline-none resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={!watchedContent.trim() || isAiTyping}
              aria-label="Send message"
              className="w-10 h-10 sm:w-9 sm:h-9 rounded-full bg-[#0084ff] hover:bg-[#0073e6] disabled:opacity-40 disabled:pointer-events-none text-white flex items-center justify-center shrink-0 transition cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <div className="py-2 px-3 rounded-xl bg-[#f0f2f5] dark:bg-[#2a3942] text-xs text-[#65676b] dark:text-[#8696a0] flex items-center justify-center gap-2">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>
              Your role (
              <strong className="font-semibold text-[#050505] dark:text-[#e9edef]">
                {USER_ROLE_META[currentUser.role].label}
              </strong>
              ) has read-only access to AI chat.
            </span>
          </div>
        )}
      </div>
    </main>
  );
}
