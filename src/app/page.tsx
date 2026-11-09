"use client";

import React, { useRef, useState } from "react";
import { INITIAL_PROJECTS } from "@/data/mockProjects";
import {
  BUSINESS_STATUS_META,
  CryptoProject,
  ProjectBusinessStatus,
  ProjectContextItem,
} from "@/types/project";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { AiChatPane } from "@/components/AiChatPane";
import { ContextInspector } from "@/components/ContextInspector";
import {
  AddContextDialog,
  NewProjectDialog,
  UpdateProjectLogoDialog,
} from "@/components/Modals";

function buildContextualAiResponse(
  project: CryptoProject,
  userPrompt: string,
  activeContexts: ProjectContextItem[]
): { content: string; suggestions: string[] } {
  const websiteCtx = activeContexts.find((c) => c.type === "website");
  const xCtx = activeContexts.find((c) => c.type === "x_handle");
  const linkedinCtx = activeContexts.find((c) => c.type === "linkedin");
  const noteCtx = activeContexts.find((c) => c.type === "message");
  const statusMeta = BUSINESS_STATUS_META[project.businessStatus];

  const lower = userPrompt.toLowerCase();

  if (lower.includes("linkedin") || lower.includes("institutional")) {
    return {
      content: `### LinkedIn Institutional Campaign — ${project.name} (${project.ticker})
Grounded on ${linkedinCtx ? `\`${linkedinCtx.value}\`` : "your B2B positioning"}${websiteCtx ? ` and \`${websiteCtx.value}\`` : ""}:

> **Why Institutional Capital Is Moving to ${project.name} on ${project.chain}**
> ${project.tagline}.
> ${noteCtx ? `Key Focus: ${noteCtx.value}` : ""}

- **Executive Hook:** Highlight verifiable on-chain performance and enterprise-grade architecture.
- **Credibility Anchor:** Reference ${linkedinCtx ? linkedinCtx.summary : "core engineering pedigree"} and invite liquidity partners to review docs at \`${websiteCtx?.value || "our portal"}\`.
- **CTA:** "DM our BD desk or visit \`${websiteCtx?.value || project.ticker}\` for institutional onboarding."`,
      suggestions: [
        "Adapt this LinkedIn post into a 4-tweet X thread",
        "Write a cold DM for institutional market makers",
        "Generate executive founder quote",
      ],
    };
  }

  if (lower.includes("kol") || lower.includes("dm") || lower.includes("outreach")) {
    return {
      content: `### Tier-1 KOL Outreach Kit — ${project.name} (${project.ticker})
Tailored for ${xCtx ? `\`${xCtx.value}\`` : project.ticker} (${project.stage} on ${project.chain}):

- **DM Option 1 (High-Signal Alpha Analyst):**
  "Hey [Name] — been following your ${project.chain} coverage. We're scaling **${project.name} (${project.ticker})**: ${project.tagline.toLowerCase()}. ${noteCtx ? noteCtx.value : ""} Would love to share early access + data room at \`${websiteCtx?.value || "our site"}\`."
- **DM Option 2 (Ecosystem Threader):**
  "GM! We're preparing our next catalyst on \`${xCtx?.value || project.ticker}\` and setting aside partner allocations for high-conviction creators. Open to a 10-min brief?"`,
      suggestions: [
        "Create a KOL talking-points brief",
        "Draft follow-up bump message after 48h",
        "Write an X thread to pin before KOL wave",
      ],
    };
  }

  return {
    content: `### Coordinated Campaign Strategy — ${project.name} (${project.ticker})
Synthesized from **${activeContexts.length} active project contexts** • Business State: **${statusMeta.label}** (${activeContexts.map((c) => c.title).join(", ") || "General Project Profile"}):

### 1. X / Crypto Twitter Angle ${xCtx ? `(\`${xCtx.value}\`)` : ""}
- **Hook:** "${project.name} (${project.ticker}) is redefining ${project.chain}: ${project.tagline}."
- **Narrative Alignment:** ${noteCtx ? noteCtx.value : "Focus on verifiable traction, community ownership, and ecosystem composability."}
- **Destination CTA:** Drive traffic directly to \`${websiteCtx?.value || "official portal"}\`.

### 2. LinkedIn & Partner Angle ${linkedinCtx ? `(\`${linkedinCtx.value}\`)` : ""}
> Position **${project.name}** as institutional-grade ${project.chain} infrastructure during the **${project.stage}** phase, backed by transparent metrics and ecosystem integrations.`,
    suggestions: [
      "Expand section 1 into a 5-part X thread",
      "Draft Telegram announcement for community",
      "Create LinkedIn founder thought-leadership post",
    ],
  };
}

export default function CryptoMessengerDashboard() {
  const [projects, setProjects] = useState<CryptoProject[]>(INITIAL_PROJECTS);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    INITIAL_PROJECTS[0].id
  );
  const [draftPrompt, setDraftPrompt] = useState("");
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(true);
  const [isAiTyping, setIsAiTyping] = useState(false);

  const addContextDialogRef = useRef<HTMLDialogElement | null>(null);
  const newProjectDialogRef = useRef<HTMLDialogElement | null>(null);
  const editLogoDialogRef = useRef<HTMLDialogElement | null>(null);

  const activeProject =
    projects.find((p) => p.id === selectedProjectId) ?? projects[0];

  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, unreadInsights: 0 } : p))
    );
  };

  const handleSendMessage = (content: string) => {
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
      const aiReply = buildContextualAiResponse(
        currentProject,
        content,
        enabledContexts
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
                    content: aiReply.content,
                    timestamp: new Date().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                    usedContextIds: enabledContexts.map((c) => c.id),
                    suggestedActions: aiReply.suggestions,
                  },
                ],
              }
            : proj
        )
      );
      setIsAiTyping(false);
    }, 550);
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
                  content: `Thread cleared. I have **${enabledContexts.length} active context sources** loaded for **${proj.name} (${proj.ticker})**. What campaign asset should we build next?`,
                  timestamp: "Just now",
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
      updatedAt: "Just now",
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
        ? `${prev} (Using context "${ctx.title}": ${ctx.value})`
        : `Using our "${ctx.title}" context (${ctx.value}), draft a campaign post that highlights `
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
              lastActivityTime: "Just now",
            }
          : proj
      )
    );
  };

  return (
    <div className="h-dvh w-full overflow-hidden flex bg-white dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef]">
      {/* Left Sidebar: Crypto Projects List (Messenger Contacts Style) */}
      <ProjectSidebar
        projects={projects}
        selectedProjectId={activeProject.id}
        onSelectProject={handleSelectProject}
        onUpdateBusinessStatus={handleUpdateBusinessStatus}
        onOpenNewProjectModal={() => newProjectDialogRef.current?.showModal()}
      />

      {/* Center Section: AI Marketing Agent Chat Box */}
      <AiChatPane
        project={activeProject}
        draftPrompt={draftPrompt}
        setDraftPrompt={setDraftPrompt}
        onSendMessage={handleSendMessage}
        onResetConversation={handleResetConversation}
        onUpdateBusinessStatus={(status) =>
          handleUpdateBusinessStatus(activeProject.id, status)
        }
        onOpenAddContextModal={() => addContextDialogRef.current?.showModal()}
        onOpenEditLogoModal={() => editLogoDialogRef.current?.showModal()}
        isContextPanelOpen={isContextPanelOpen}
        onToggleContextPanel={() => setIsContextPanelOpen((v) => !v)}
        isAiTyping={isAiTyping}
      />

      {/* Right Sidebar: Project Contexts (Websites, LinkedIn, X Handles, Pinned Messages) */}
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

      {/* Native Accessible Modals */}
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
    </div>
  );
}
