"use client";

import React, { useRef, useState } from "react";
import {
  INITIAL_CHECKLIST_ITEMS,
  INITIAL_PROJECTS,
  INITIAL_PROMPT_TEMPLATES,
} from "@/data/mockProjects";
import {
  BUSINESS_STATUS_META,
  ChecklistItemConfig,
  CryptoProject,
  ProjectBusinessStatus,
  ProjectChecklistItemState,
  ProjectContextItem,
  PromptTemplate,
} from "@/types/project";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { AiChatPane } from "@/components/AiChatPane";
import { ContextInspector } from "@/components/ContextInspector";
import {
  AddContextDialog,
  GlobalSettingsDialog,
  NewProjectDialog,
  ProjectChecklistDialog,
  UpdateProjectLogoDialog,
} from "@/components/Modals";

function evaluateChecklistItemAgainstProject(
  project: CryptoProject,
  item: ChecklistItemConfig
): ProjectChecklistItemState {
  const corpus = [
    project.name,
    project.tagline,
    ...project.contexts.map(
      (c) => `${c.type} ${c.title} ${c.value} ${c.summary || ""}`
    ),
  ]
    .join(" ")
    .toLowerCase();

  const q = `${item.label} ${item.scanPrompt}`.toLowerCase();

  let detected = false;
  let note = "";

  if (q.includes("telegram") || q.includes("bot")) {
    const tgCtx = project.contexts.find((c) => c.type === "telegram");
    detected = Boolean(tgCtx) || corpus.includes("t.me") || corpus.includes("bot");
    note = detected
      ? `Found Telegram presence (${tgCtx?.value || "t.me link"}) in project contexts.`
      : "No Telegram bot or t.me link found in project contexts — opportunity to pitch a Telegram community/trading bot.";
  } else if (q.includes("mcp")) {
    detected =
      corpus.includes("mcp") ||
      corpus.includes("agent") ||
      corpus.includes("inference") ||
      corpus.includes("sdk");
    note = detected
      ? "Agentic / SDK infrastructure detected in project positioning; compatible with MCP server deployment."
      : "No MCP server mentioned in contexts — high-value opportunity to build an MCP server for AI agent access.";
  } else if (q.includes("chatgpt") || q.includes("ai platform")) {
    detected =
      corpus.includes("ai") ||
      corpus.includes("chatgpt") ||
      corpus.includes("deepmind") ||
      corpus.includes("agent");
    note = detected
      ? "AI positioning found in contexts; ready for ChatGPT / AI platform plugin listing."
      : "Not currently indexed for ChatGPT / AI platform integrations.";
  } else if (q.includes("sdk") || q.includes("api") || q.includes("doc")) {
    detected =
      corpus.includes("sdk") ||
      corpus.includes("docs") ||
      corpus.includes("litepaper") ||
      corpus.includes("app");
    note = detected
      ? "Developer documentation / portal reference found in website contexts."
      : "No public SDK or API documentation link found in active contexts.";
  } else if (
    q.includes("analytics") ||
    q.includes("dune") ||
    q.includes("tvl") ||
    q.includes("node")
  ) {
    detected =
      corpus.includes("tvl") ||
      corpus.includes("node") ||
      corpus.includes("vault") ||
      corpus.includes("140m") ||
      corpus.includes("25m");
    note = detected
      ? "On-chain metrics / TVL / node telemetry referenced in project contexts."
      : "No public Dune or on-chain analytics dashboard linked yet.";
  } else {
    const keywords = item.label
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);
    detected = keywords.some((kw) => corpus.includes(kw));
    note = detected
      ? `Matched "${item.label}" in project contexts.`
      : `No reference to "${item.label}" found in current project contexts.`;
  }

  return {
    checked: detected,
    scanResultNote: note,
    scannedAt: "Just now",
  };
}

function buildContextualAiResponse(
  project: CryptoProject,
  userPrompt: string,
  activeContexts: ProjectContextItem[],
  template?: PromptTemplate
): string {
  const websiteCtx = activeContexts.find((c) => c.type === "website");
  const xCtx = activeContexts.find((c) => c.type === "x_handle");
  const linkedinCtx = activeContexts.find((c) => c.type === "linkedin");
  const noteCtx = activeContexts.find((c) => c.type === "message");
  const statusMeta = BUSINESS_STATUS_META[project.businessStatus];

  const lower = `${userPrompt} ${template?.label || ""} ${template?.systemPrompt || ""}`.toLowerCase();

  const systemInstructionHeader = template
    ? `> **Applied System Prompt (${template.label}):** ${template.systemPrompt}\n\n`
    : "";

  if (lower.includes("4-tweet") || lower.includes("thread")) {
    return `${systemInstructionHeader}### 4-Tweet X Thread — ${project.name} (${project.ticker})
- **1/4:** ${project.name} (${project.ticker}) is scaling on ${project.chain}: ${project.tagline}.
- **2/4:** Grounded in our latest positioning${linkedinCtx ? ` (\`${linkedinCtx.value}\`)` : ""}: ${noteCtx ? noteCtx.value : "built for institutional-grade execution and verifiable throughput."}
- **3/4:** Follow ${xCtx ? `\`${xCtx.value}\`` : project.ticker} as we progress through our **${project.stage}** phase.
- **4/4:** Explore the docs and live metrics at \`${websiteCtx?.value || "our official portal"}\`.`;
  }

  if (lower.includes("market maker") || lower.includes("cold dm")) {
    return `${systemInstructionHeader}### Institutional Market Maker Cold DM — ${project.name} (${project.ticker})
"Hi [Name] — reaching out from the **${project.name} (${project.ticker})** team on ${project.chain}.

${project.tagline}. ${noteCtx ? noteCtx.value : ""}

We are currently in **${project.stage}** (${statusMeta.label}) and onboarding institutional liquidity partners. Full documentation is live at \`${websiteCtx?.value || "our portal"}\`${linkedinCtx ? ` and \`${linkedinCtx.value}\`` : ""}. Open to sharing our liquidity brief this week?"`;
  }

  if (lower.includes("founder quote") || lower.includes("executive")) {
    return `${systemInstructionHeader}### Executive Founder Quote — ${project.name} (${project.ticker})
> "${project.name} was engineered on ${project.chain} to solve a fundamental gap: ${project.tagline.toLowerCase()}. ${noteCtx ? noteCtx.value : "Our focus is delivering verifiable utility and deep ecosystem composability."}"
> — **Founder, ${project.name} (${project.ticker})**`;
  }

  return `${systemInstructionHeader}### ${project.name} (${project.ticker}) — Campaign Output
Synthesized from **${activeContexts.length} active contexts** (${activeContexts.map((c) => c.title).join(", ") || "Project Profile"}):

- **X / Social (${xCtx?.value || project.ticker}):** "${project.name} (${project.ticker}) on ${project.chain} — ${project.tagline}."
- **Key Context Directive:** ${noteCtx ? noteCtx.value : "Emphasize core product traction and verifiable metrics."}
- **Primary Link:** \`${websiteCtx?.value || linkedinCtx?.value || "N/A"}\``;
}

export default function CryptoMessengerDashboard() {
  const [projects, setProjects] = useState<CryptoProject[]>(INITIAL_PROJECTS);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    INITIAL_PROJECTS[0].id
  );
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>(
    INITIAL_PROMPT_TEMPLATES
  );
  const [checklistItems, setChecklistItems] = useState<ChecklistItemConfig[]>(
    INITIAL_CHECKLIST_ITEMS
  );

  const [draftPrompt, setDraftPrompt] = useState("");
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(true);
  const [isAiTyping, setIsAiTyping] = useState(false);

  const addContextDialogRef = useRef<HTMLDialogElement | null>(null);
  const newProjectDialogRef = useRef<HTMLDialogElement | null>(null);
  const editLogoDialogRef = useRef<HTMLDialogElement | null>(null);
  const checklistDialogRef = useRef<HTMLDialogElement | null>(null);
  const globalSettingsDialogRef = useRef<HTMLDialogElement | null>(null);

  const activeProject =
    projects.find((p) => p.id === selectedProjectId) ?? projects[0];

  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, unreadInsights: 0 } : p))
    );
  };

  const handleSendMessage = (content: string, template?: PromptTemplate) => {
    const adminMsgId = `msg-admin-${Date.now()}`;
    const currentProject = activeProject;
    const enabledContexts = currentProject.contexts.filter((c) => c.isActive);

    setProjects((prev) =>
      prev.map((proj) =>
        proj.id === currentProject.id
          ? {
              ...proj,
              lastActivityTime: "Just now",
              messages: [
                ...proj.messages,
                {
                  id: adminMsgId,
                  sender: "admin",
                  content,
                  timestamp: new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                },
              ],
            }
          : proj
      )
    );

    setIsAiTyping(true);
    setTimeout(() => {
      const aiContent = buildContextualAiResponse(
        currentProject,
        content,
        enabledContexts,
        template
      );

      setProjects((prev) =>
        prev.map((proj) =>
          proj.id === currentProject.id
            ? {
                ...proj,
                messages: [
                  ...proj.messages,
                  {
                    id: `msg-ai-${Date.now()}`,
                    sender: "ai",
                    content: aiContent,
                    timestamp: new Date().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                    usedContextIds: enabledContexts.map((c) => c.id),
                  },
                ],
              }
            : proj
        )
      );
      setIsAiTyping(false);
    }, 450);
  };

  const handleToggleChecklistItem = (itemId: string) => {
    setProjects((prev) =>
      prev.map((proj) => {
        if (proj.id !== activeProject.id) return proj;
        const prevMap = proj.checklistState ?? {};
        const prevItem = prevMap[itemId];
        return {
          ...proj,
          checklistState: {
            ...prevMap,
            [itemId]: {
              ...prevItem,
              checked: !prevItem?.checked,
            },
          },
        };
      })
    );
  };

  const handleScanAllChecklistItems = () => {
    const currentProject = activeProject;
    const enabledContexts = currentProject.contexts.filter((c) => c.isActive);
    const nextState: Record<string, ProjectChecklistItemState> = {};

    const reportLines: string[] = [
      `### Checklist Scan Report — ${currentProject.name} (${currentProject.ticker})`,
    ];

    checklistItems.forEach((item) => {
      const res = evaluateChecklistItemAgainstProject(currentProject, item);
      nextState[item.id] = res;
      reportLines.push(
        `- **${item.label}** (${res.checked ? "Yes / Detected" : "Missing"}): *${item.scanPrompt}* — ${res.scanResultNote}`
      );
    });

    setProjects((prev) =>
      prev.map((proj) =>
        proj.id === currentProject.id
          ? {
              ...proj,
              lastActivityTime: "Just now",
              checklistState: nextState,
              messages: [
                ...proj.messages,
                {
                  id: `msg-scan-${Date.now()}`,
                  sender: "ai",
                  content: reportLines.join("\n"),
                  timestamp: new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                  usedContextIds: enabledContexts.map((c) => c.id),
                },
              ],
            }
          : proj
      )
    );
  };

  const handleScanSingleItemInChat = (item: ChecklistItemConfig) => {
    const currentProject = activeProject;
    const enabledContexts = currentProject.contexts.filter((c) => c.isActive);
    const res = evaluateChecklistItemAgainstProject(currentProject, item);

    setProjects((prev) =>
      prev.map((proj) =>
        proj.id === currentProject.id
          ? {
              ...proj,
              lastActivityTime: "Just now",
              checklistState: {
                ...(proj.checklistState ?? {}),
                [item.id]: res,
              },
              messages: [
                ...proj.messages,
                {
                  id: `msg-chk-q-${Date.now()}`,
                  sender: "admin",
                  content: `Checklist check — ${item.label}: ${item.scanPrompt}`,
                  timestamp: new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                },
                {
                  id: `msg-chk-a-${Date.now() + 1}`,
                  sender: "ai",
                  content: `### Checklist Result: ${item.label} — ${res.checked ? "Detected" : "Not Found"}\n- **Scanned Prompt:** "${item.scanPrompt}"\n- **Finding:** ${res.scanResultNote}`,
                  timestamp: new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                  usedContextIds: enabledContexts.map((c) => c.id),
                },
              ],
            }
          : proj
      )
    );
  };

  const handleSavePromptTemplate = (updated: PromptTemplate) => {
    setPromptTemplates((prev) => {
      const exists = prev.some((t) => t.id === updated.id);
      if (exists) {
        return prev.map((t) => (t.id === updated.id ? updated : t));
      }
      return [...prev, updated];
    });
  };

  const handleDeletePromptTemplate = (id: string) => {
    setPromptTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSaveChecklistItem = (updated: ChecklistItemConfig) => {
    setChecklistItems((prev) => {
      const exists = prev.some((i) => i.id === updated.id);
      if (exists) {
        return prev.map((i) => (i.id === updated.id ? updated : i));
      }
      return [...prev, updated];
    });
  };

  const handleDeleteChecklistItem = (id: string) => {
    setChecklistItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleResetConversation = () => {
    const enabledContexts = activeProject.contexts.filter((c) => c.isActive);
    setProjects((prev) =>
      prev.map((proj) =>
        proj.id === activeProject.id
          ? {
              ...proj,
              messages: [
                {
                  id: `msg-reset-${Date.now()}`,
                  sender: "ai",
                  content: `Chat cleared for **${proj.name} (${proj.ticker})** (${enabledContexts.length} contexts active).`,
                  timestamp: "Now",
                  usedContextIds: enabledContexts.map((c) => c.id),
                },
              ],
            }
          : proj
      )
    );
  };

  const handleToggleContext = (contextId: string) => {
    setProjects((prev) =>
      prev.map((proj) =>
        proj.id === activeProject.id
          ? {
              ...proj,
              contexts: proj.contexts.map((c) =>
                c.id === contextId ? { ...c, isActive: !c.isActive } : c
              ),
            }
          : proj
      )
    );
  };

  const handleToggleAllContexts = (enable: boolean) => {
    setProjects((prev) =>
      prev.map((proj) =>
        proj.id === activeProject.id
          ? {
              ...proj,
              contexts: proj.contexts.map((c) => ({ ...c, isActive: enable })),
            }
          : proj
      )
    );
  };

  const handleDeleteContext = (contextId: string) => {
    setProjects((prev) =>
      prev.map((proj) =>
        proj.id === activeProject.id
          ? {
              ...proj,
              contexts: proj.contexts.filter((c) => c.id !== contextId),
            }
          : proj
      )
    );
  };

  const handleAddContext = (
    item: Omit<ProjectContextItem, "id" | "updatedAt">
  ) => {
    const newCtx: ProjectContextItem = {
      ...item,
      id: `ctx-${Date.now()}`,
      updatedAt: "Now",
    };

    setProjects((prev) =>
      prev.map((proj) =>
        proj.id === activeProject.id
          ? {
              ...proj,
              contexts: [newCtx, ...proj.contexts],
            }
          : proj
      )
    );
  };

  const handleReferenceInPrompt = (ctx: ProjectContextItem) => {
    if (!ctx.isActive) {
      handleToggleContext(ctx.id);
    }
    setDraftPrompt((prev) =>
      prev
        ? `${prev} (${ctx.title}: ${ctx.value})`
        : `Using ${ctx.title} (${ctx.value}), `
    );
  };

  const handleCreateProject = (newProj: CryptoProject) => {
    setProjects((prev) => [newProj, ...prev]);
    setSelectedProjectId(newProj.id);
  };

  const handleUpdateProjectLogo = (logoUrl: string | undefined) => {
    setProjects((prev) =>
      prev.map((proj) =>
        proj.id === activeProject.id ? { ...proj, logoUrl } : proj
      )
    );
  };

  const handleUpdateBusinessStatus = (
    projectId: string,
    status: ProjectBusinessStatus
  ) => {
    setProjects((prev) =>
      prev.map((proj) =>
        proj.id === projectId
          ? {
              ...proj,
              businessStatus: status,
              lastActivityTime: "Now",
            }
          : proj
      )
    );
  };

  return (
    <div className="h-dvh w-full overflow-hidden flex bg-white dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef]">
      {/* Left Sidebar: Crypto Projects List */}
      <ProjectSidebar
        projects={projects}
        selectedProjectId={activeProject.id}
        onSelectProject={handleSelectProject}
        onUpdateBusinessStatus={handleUpdateBusinessStatus}
        onOpenNewProjectModal={() => newProjectDialogRef.current?.showModal()}
        onOpenGlobalSettings={() =>
          globalSettingsDialogRef.current?.showModal()
        }
      />

      {/* Center Section: AI Chat */}
      <AiChatPane
        project={activeProject}
        promptTemplates={promptTemplates}
        checklistItems={checklistItems}
        draftPrompt={draftPrompt}
        setDraftPrompt={setDraftPrompt}
        onSendMessage={handleSendMessage}
        onResetConversation={handleResetConversation}
        onUpdateBusinessStatus={(status) =>
          handleUpdateBusinessStatus(activeProject.id, status)
        }
        onOpenAddContextModal={() => addContextDialogRef.current?.showModal()}
        onOpenEditLogoModal={() => editLogoDialogRef.current?.showModal()}
        onOpenChecklistModal={() => checklistDialogRef.current?.showModal()}
        onOpenGlobalSettings={() =>
          globalSettingsDialogRef.current?.showModal()
        }
        isContextPanelOpen={isContextPanelOpen}
        onToggleContextPanel={() => setIsContextPanelOpen((v) => !v)}
        isAiTyping={isAiTyping}
      />

      {/* Right Sidebar: Project Contexts */}
      {isContextPanelOpen && (
        <ContextInspector
          project={activeProject}
          onUpdateBusinessStatus={(status) =>
            handleUpdateBusinessStatus(activeProject.id, status)
          }
          onToggleContext={handleToggleContext}
          onToggleAllContexts={handleToggleAllContexts}
          onDeleteContext={handleDeleteContext}
          onReferenceInPrompt={handleReferenceInPrompt}
          onOpenAddContextModal={() => addContextDialogRef.current?.showModal()}
          onOpenEditLogoModal={() => editLogoDialogRef.current?.showModal()}
        />
      )}

      {/* Modals */}
      <AddContextDialog
        dialogRef={addContextDialogRef}
        projectName={activeProject.name}
        onAddContext={handleAddContext}
      />

      <NewProjectDialog
        dialogRef={newProjectDialogRef}
        onCreateProject={handleCreateProject}
      />

      <UpdateProjectLogoDialog
        dialogRef={editLogoDialogRef}
        project={activeProject}
        onUpdateLogo={handleUpdateProjectLogo}
      />

      <ProjectChecklistDialog
        dialogRef={checklistDialogRef}
        project={activeProject}
        checklistItems={checklistItems}
        onToggleChecklistItem={handleToggleChecklistItem}
        onScanAllChecklistItems={handleScanAllChecklistItems}
        onScanSingleItemInChat={handleScanSingleItemInChat}
        onOpenGlobalSettings={() =>
          globalSettingsDialogRef.current?.showModal()
        }
      />

      <GlobalSettingsDialog
        dialogRef={globalSettingsDialogRef}
        promptTemplates={promptTemplates}
        onSavePromptTemplate={handleSavePromptTemplate}
        onDeletePromptTemplate={handleDeletePromptTemplate}
        checklistItems={checklistItems}
        onSaveChecklistItem={handleSaveChecklistItem}
        onDeleteChecklistItem={handleDeleteChecklistItem}
      />
    </div>
  );
}
