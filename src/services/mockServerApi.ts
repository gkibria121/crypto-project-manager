import {
  INITIAL_CHECKLIST_ITEMS,
  INITIAL_PROJECTS,
  INITIAL_PROMPT_TEMPLATES,
} from "@/data/mockProjects";
import {
  buildContextualAiResponse,
  evaluateChecklistItemAgainstProject,
  formatCurrentTimestamp,
  normalizeContextUrl,
} from "@/lib/ai-engine";
import {
  SOLID_AVATAR_COLORS,
  addContextFormSchema,
  checklistItemConfigSchema,
  cryptoProjectSchema,
  newProjectFormSchema,
  promptTemplateSchema,
  type AddContextFormValues,
  type ChecklistItemConfig,
  type CryptoProject,
  type NewProjectFormValues,
  type ProjectBusinessStatus,
  type ProjectChecklistItemState,
  type ProjectContextItem,
  type PromptTemplate,
} from "@/types/project";

interface MockDatabaseState {
  projects: CryptoProject[];
  promptTemplates: PromptTemplate[];
  checklistItems: ChecklistItemConfig[];
}

const db: MockDatabaseState = {
  projects: structuredClone(INITIAL_PROJECTS),
  promptTemplates: structuredClone(INITIAL_PROMPT_TEMPLATES),
  checklistItems: structuredClone(INITIAL_CHECKLIST_ITEMS),
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function updateProjectInDb(
  projectId: string,
  updater: (project: CryptoProject) => CryptoProject
): CryptoProject {
  const index = db.projects.findIndex((p) => p.id === projectId);
  if (index === -1) {
    throw new Error(`Project "${projectId}" not found in mock server state.`);
  }
  const updated = cryptoProjectSchema.parse(updater(db.projects[index]));
  db.projects = db.projects.map((p, i) => (i === index ? updated : p));
  return structuredClone(updated);
}

export const mockServerApi = {
  getInitialSnapshot(): MockDatabaseState {
    return {
      projects: structuredClone(db.projects),
      promptTemplates: structuredClone(db.promptTemplates),
      checklistItems: structuredClone(db.checklistItems),
    };
  },

  async fetchProjects(): Promise<CryptoProject[]> {
    await delay(40);
    return structuredClone(db.projects);
  },

  async fetchPromptTemplates(): Promise<PromptTemplate[]> {
    await delay(30);
    return structuredClone(db.promptTemplates);
  },

  async fetchChecklistItems(): Promise<ChecklistItemConfig[]> {
    await delay(30);
    return structuredClone(db.checklistItems);
  },

  async markProjectAsRead(projectId: string): Promise<CryptoProject> {
    await delay(20);
    return updateProjectInDb(projectId, (proj) => ({
      ...proj,
      unreadInsights: 0,
    }));
  },

  async createProject(rawInput: NewProjectFormValues): Promise<CryptoProject> {
    await delay(80);
    const input = newProjectFormSchema.parse(rawInput);

    const cleanTicker = input.ticker.startsWith("$")
      ? input.ticker.toUpperCase()
      : `$${input.ticker.toUpperCase()}`;

    const nowId = Date.now();
    const contexts: ProjectContextItem[] = [];

    if (input.website) {
      contexts.push({
        id: `ctx-${nowId}-web`,
        type: "website",
        title: "Official Website",
        value: input.website,
        url: input.website.startsWith("http")
          ? input.website
          : `https://${input.website}`,
        isActive: true,
        updatedAt: "Now",
      });
    }

    if (input.xHandle) {
      const cleanHandle = input.xHandle.startsWith("@")
        ? input.xHandle
        : `@${input.xHandle}`;
      contexts.push({
        id: `ctx-${nowId}-x`,
        type: "x_handle",
        title: "Official X",
        value: cleanHandle,
        url: `https://x.com/${cleanHandle.replace(/^@/, "")}`,
        isActive: true,
        updatedAt: "Now",
      });
    }

    if (input.linkedin) {
      contexts.push({
        id: `ctx-${nowId}-li`,
        type: "linkedin",
        title: "LinkedIn",
        value: input.linkedin,
        url: input.linkedin.startsWith("http")
          ? input.linkedin
          : `https://${input.linkedin}`,
        isActive: true,
        updatedAt: "Now",
      });
    }

    if (input.tagline) {
      contexts.push({
        id: `ctx-${nowId}-note`,
        type: "message",
        title: "Project Positioning",
        value: input.tagline,
        isActive: true,
        updatedAt: "Now",
      });
    }

    const newProject = cryptoProjectSchema.parse({
      id: `proj-${nowId}`,
      name: input.name,
      ticker: cleanTicker,
      chain: input.chain,
      stage: input.stage,
      businessStatus: input.businessStatus,
      avatarBg:
        SOLID_AVATAR_COLORS[
          Math.floor(Math.random() * SOLID_AVATAR_COLORS.length)
        ],
      logoUrl: input.logoUrl || undefined,
      tagline: input.tagline || `${input.chain} project (${input.stage})`,
      campaignBudget: "$25,000 / mo",
      sentimentScore: 90,
      isPinned: true,
      unreadInsights: 0,
      lastActivityTime: "Now",
      contexts,
      messages: [
        {
          id: `msg-${nowId}`,
          sender: "ai",
          content: `Chat initialized for **${input.name} (${cleanTicker})** with ${contexts.length} context items active.`,
          timestamp: "Now",
          usedContextIds: contexts.map((c) => c.id),
        },
      ],
    });

    db.projects = [newProject, ...db.projects];
    return structuredClone(newProject);
  },

  async updateBusinessStatus(params: {
    projectId: string;
    status: ProjectBusinessStatus;
  }): Promise<CryptoProject> {
    await delay(40);
    return updateProjectInDb(params.projectId, (proj) => ({
      ...proj,
      businessStatus: params.status,
      lastActivityTime: "Now",
    }));
  },

  async updateProjectLogo(params: {
    projectId: string;
    logoUrl: string | undefined;
  }): Promise<CryptoProject> {
    await delay(40);
    return updateProjectInDb(params.projectId, (proj) => ({
      ...proj,
      logoUrl: params.logoUrl,
    }));
  },

  async sendMessage(params: {
    projectId: string;
    content: string;
    template?: PromptTemplate;
  }): Promise<CryptoProject> {
    const { projectId, content, template } = params;
    const timestamp = formatCurrentTimestamp();

    // Record the admin message immediately in the server store
    const afterAdmin = updateProjectInDb(projectId, (proj) => ({
      ...proj,
      lastActivityTime: "Just now",
      messages: [
        ...proj.messages,
        {
          id: `msg-admin-${Date.now()}`,
          sender: "admin",
          content: content.trim(),
          timestamp,
        },
      ],
    }));

    // Simulate AI inference latency
    await delay(450);

    const enabledContexts = afterAdmin.contexts.filter((c) => c.isActive);
    const aiContent = buildContextualAiResponse(
      afterAdmin,
      content,
      enabledContexts,
      template
    );

    return updateProjectInDb(projectId, (proj) => ({
      ...proj,
      messages: [
        ...proj.messages,
        {
          id: `msg-ai-${Date.now()}`,
          sender: "ai",
          content: aiContent,
          timestamp: formatCurrentTimestamp(),
          usedContextIds: enabledContexts.map((c) => c.id),
          appliedSystemPromptTitle: template?.label,
        },
      ],
    }));
  },

  async resetConversation(projectId: string): Promise<CryptoProject> {
    await delay(40);
    return updateProjectInDb(projectId, (proj) => {
      const enabledContexts = proj.contexts.filter((c) => c.isActive);
      return {
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
      };
    });
  },

  async addContext(params: {
    projectId: string;
    values: AddContextFormValues;
  }): Promise<CryptoProject> {
    await delay(50);
    const validated = addContextFormSchema.parse(params.values);
    const newCtx: ProjectContextItem = {
      id: `ctx-${Date.now()}`,
      type: validated.type,
      title: validated.title,
      value: validated.value,
      url: normalizeContextUrl(validated.type, validated.value),
      summary: validated.summary || undefined,
      isActive: true,
      updatedAt: "Now",
    };

    return updateProjectInDb(params.projectId, (proj) => ({
      ...proj,
      contexts: [newCtx, ...proj.contexts],
    }));
  },

  async toggleContext(params: {
    projectId: string;
    contextId: string;
  }): Promise<CryptoProject> {
    await delay(30);
    return updateProjectInDb(params.projectId, (proj) => ({
      ...proj,
      contexts: proj.contexts.map((c) =>
        c.id === params.contextId ? { ...c, isActive: !c.isActive } : c
      ),
    }));
  },

  async toggleAllContexts(params: {
    projectId: string;
    enable: boolean;
  }): Promise<CryptoProject> {
    await delay(30);
    return updateProjectInDb(params.projectId, (proj) => ({
      ...proj,
      contexts: proj.contexts.map((c) => ({ ...c, isActive: params.enable })),
    }));
  },

  async deleteContext(params: {
    projectId: string;
    contextId: string;
  }): Promise<CryptoProject> {
    await delay(40);
    return updateProjectInDb(params.projectId, (proj) => ({
      ...proj,
      contexts: proj.contexts.filter((c) => c.id !== params.contextId),
    }));
  },

  async toggleChecklistItem(params: {
    projectId: string;
    itemId: string;
  }): Promise<CryptoProject> {
    await delay(30);
    return updateProjectInDb(params.projectId, (proj) => {
      const prevMap = proj.checklistState ?? {};
      const prevItem = prevMap[params.itemId];
      return {
        ...proj,
        checklistState: {
          ...prevMap,
          [params.itemId]: {
            ...prevItem,
            checked: !prevItem?.checked,
          },
        },
      };
    });
  },

  async scanAllChecklistItems(params: {
    projectId: string;
  }): Promise<CryptoProject> {
    await delay(120);
    return updateProjectInDb(params.projectId, (proj) => {
      const enabledContexts = proj.contexts.filter((c) => c.isActive);
      const nextState: Record<string, ProjectChecklistItemState> = {};
      const reportLines: string[] = [
        `### Checklist Scan Report — ${proj.name} (${proj.ticker})`,
      ];

      db.checklistItems.forEach((item) => {
        const res = evaluateChecklistItemAgainstProject(proj, item);
        nextState[item.id] = res;
        reportLines.push(
          `- **${item.label}** (${res.checked ? "Yes / Detected" : "Missing"}): *${item.scanPrompt}* — ${res.scanResultNote}`
        );
      });

      return {
        ...proj,
        lastActivityTime: "Just now",
        checklistState: nextState,
        messages: [
          ...proj.messages,
          {
            id: `msg-scan-${Date.now()}`,
            sender: "ai",
            content: reportLines.join("\n"),
            timestamp: formatCurrentTimestamp(),
            usedContextIds: enabledContexts.map((c) => c.id),
          },
        ],
      };
    });
  },

  async scanSingleChecklistItem(params: {
    projectId: string;
    item: ChecklistItemConfig;
  }): Promise<CryptoProject> {
    await delay(80);
    const { projectId, item } = params;
    return updateProjectInDb(projectId, (proj) => {
      const enabledContexts = proj.contexts.filter((c) => c.isActive);
      const res = evaluateChecklistItemAgainstProject(proj, item);
      const timestamp = formatCurrentTimestamp();
      const now = Date.now();

      return {
        ...proj,
        lastActivityTime: "Just now",
        checklistState: {
          ...(proj.checklistState ?? {}),
          [item.id]: res,
        },
        messages: [
          ...proj.messages,
          {
            id: `msg-chk-q-${now}`,
            sender: "admin",
            content: `Checklist check — ${item.label}: ${item.scanPrompt}`,
            timestamp,
          },
          {
            id: `msg-chk-a-${now + 1}`,
            sender: "ai",
            content: `### Checklist Result: ${item.label} — ${res.checked ? "Detected" : "Not Found"}\n- **Scanned Prompt:** "${item.scanPrompt}"\n- **Finding:** ${res.scanResultNote}`,
            timestamp,
            usedContextIds: enabledContexts.map((c) => c.id),
          },
        ],
      };
    });
  },

  async savePromptTemplate(
    template: PromptTemplate
  ): Promise<PromptTemplate[]> {
    await delay(30);
    const validated = promptTemplateSchema.parse(template);
    const exists = db.promptTemplates.some((t) => t.id === validated.id);
    db.promptTemplates = exists
      ? db.promptTemplates.map((t) => (t.id === validated.id ? validated : t))
      : [...db.promptTemplates, validated];
    return structuredClone(db.promptTemplates);
  },

  async deletePromptTemplate(id: string): Promise<PromptTemplate[]> {
    await delay(30);
    db.promptTemplates = db.promptTemplates.filter((t) => t.id !== id);
    return structuredClone(db.promptTemplates);
  },

  async saveChecklistItem(
    item: ChecklistItemConfig
  ): Promise<ChecklistItemConfig[]> {
    await delay(30);
    const validated = checklistItemConfigSchema.parse(item);
    const exists = db.checklistItems.some((i) => i.id === validated.id);
    db.checklistItems = exists
      ? db.checklistItems.map((i) => (i.id === validated.id ? validated : i))
      : [...db.checklistItems, validated];
    return structuredClone(db.checklistItems);
  },

  async deleteChecklistItem(id: string): Promise<ChecklistItemConfig[]> {
    await delay(30);
    db.checklistItems = db.checklistItems.filter((i) => i.id !== id);
    return structuredClone(db.checklistItems);
  },
};
