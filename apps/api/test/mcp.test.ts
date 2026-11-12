import { describe, expect, it } from "bun:test";
import {
  buildProjectMentionSuggestions,
  parseMentionTags,
} from "../src/mcp/mcp-mentions.helper.js";
import { McpService } from "../src/mcp/mcp.service.js";
import { ChatService } from "../src/chat/chat.service.js";
import { sanitizeJsonSchemaForGemini } from "../src/chat/mcp-tool-adapter.helper.js";
import { LeadsService } from "../src/leads/leads.service.js";
import { ScraperService } from "../src/scraper/scraper.service.js";
import { AiProvidersService } from "../src/settings/ai-providers.service.js";
import { SettingsService } from "../src/settings/settings.service.js";

describe("MCP Server, @Tag Resolution, and Chatbot Tool-Calling Integration", () => {
  const now = new Date("2026-11-12T12:00:00.000Z");

  function createHarness() {
    const aiConfigsStore: Array<Record<string, unknown>> = [];
    const chatMessagesStore: Array<Record<string, unknown>> = [];
    const scrapeJobsStore: Array<Record<string, unknown>> = [];
    const scrapedPagesStore: Array<Record<string, unknown>> = [];
    const mcpServersStore: Array<Record<string, unknown>> = [];
    const agencyProfileStore: Array<Record<string, unknown>> = [];
    const leadConfigsStore: Array<Record<string, unknown>> = [];

    const projectRecord: Record<string, unknown> = {
      id: "proj-mcp-1",
      name: "Aetheris AI Network",
      ticker: "$AETH",
      chain: "Solana",
      stage: "Pre-TGE",
      businessStatus: "new",
      avatarBg: "bg-[#1d4ed8]",
      logoUrl: null,
      tagline: "Decentralized GPU inference mesh",
      campaignBudget: "$45,000 / mo",
      sentimentScore: 94,
      platformRanks: null,
      tags: ["DePIN", "AI"],
      isPinned: true,
      unreadInsights: 0,
      lastActivityTime: "Now",
      lastScrapedAt: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
      contexts: [
        {
          id: "ctx-web-1",
          projectId: "proj-mcp-1",
          type: "website",
          title: "Official Website & Docs",
          value: "https://aetheris.example",
          url: "https://aetheris.example",
          summary: "Sub-200ms verifiable AI inference on Solana",
          isActive: true,
          updatedAtLabel: "Now",
          scrapeStatus: null,
          lastScrapedAt: null,
          scrapedMetadata: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "ctx-li-1",
          projectId: "proj-mcp-1",
          type: "linkedin",
          title: "Company & Founders LinkedIn",
          value: "linkedin.com/company/aetheris-labs",
          url: "https://linkedin.com/company/aetheris-labs",
          summary: "Ex-DeepMind & Solana Labs engineers, institutional AI infra.",
          isActive: true,
          updatedAtLabel: "Now",
          scrapeStatus: "completed",
          lastScrapedAt: now,
          scrapedMetadata: {
            reachable: true,
            title: "Aetheris Labs — LinkedIn Organization",
            description: "Institutional GPU mesh for Web3 agents",
            signals: ["ai_integration", "developer_sdk"],
            headings: [],
            socialLinks: { linkedin: "https://linkedin.com/company/aetheris-labs" },
          },
          createdAt: now,
          updatedAt: now,
        },
      ],
      checklistStates: [
        {
          id: "st-1",
          projectId: "proj-mcp-1",
          checklistItemId: "chk-mcp-server",
          checked: true,
          scanResultNote: "MCP signal detected",
          scannedAtLabel: "Now",
          updatedAt: now,
        },
      ],
    };

    const checklistItemsStore = [
      {
        id: "chk-mcp-server",
        label: "MCP Server",
        category: "ai",
        scanPrompt: "Does it have an MCP server?",
        isRequired: false,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const ormMock = {
      public: {
        AiProviderConfig: {
          all: async () => [...aiConfigsStore],
          where: ({ provider }: { provider: string }) => ({
            first: async () =>
              aiConfigsStore.find((r) => r["provider"] === provider) ?? null,
          }),
          upsert: async (args: {
            create: Record<string, unknown>;
            update: Record<string, unknown>;
          }) => {
            const existing = aiConfigsStore.find(
              (r) => r["provider"] === args.create["provider"]
            );
            if (existing) {
              Object.assign(existing, args.update, { updatedAt: new Date() });
              return existing;
            }
            const created = {
              ...args.create,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            aiConfigsStore.push(created);
            return created;
          },
        },
        ScraperProviderConfig: {
          all: async () => [],
        },
        LeadProviderConfig: {
          all: async () => [...leadConfigsStore],
          upsert: async (args: {
            create: Record<string, unknown>;
            update: Record<string, unknown>;
          }) => {
            const existing = leadConfigsStore.find(
              (r) => r["provider"] === args.create["provider"]
            );
            if (existing) {
              Object.assign(existing, args.update, { updatedAt: new Date() });
              return existing;
            }
            const created = {
              ...args.create,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            leadConfigsStore.push(created);
            return created;
          },
          where: ({ provider }: { provider: string }) => ({
            delete: async () => {
              const idx = leadConfigsStore.findIndex(
                (r) => r["provider"] === provider
              );
              if (idx >= 0) leadConfigsStore.splice(idx, 1);
              return null;
            },
          }),
        },
        McpServerConfig: {
          all: async () => [...mcpServersStore],
          orderBy: () => ({ all: async () => [...mcpServersStore] }),
        },
        AgencyProfile: {
          where: ({ id }: { id: string }) => ({
            first: async () =>
              agencyProfileStore.find((r) => r["id"] === id) ?? null,
          }),
          upsert: async (args: {
            create: Record<string, unknown>;
            update: Record<string, unknown>;
          }) => {
            const existing = agencyProfileStore.find(
              (r) => r["id"] === args.create["id"]
            );
            if (existing) {
              Object.assign(existing, args.update, { updatedAt: new Date() });
              return existing;
            }
            const created = {
              ...args.create,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            agencyProfileStore.push(created);
            return created;
          },
        },
        ChecklistItem: {
          orderBy: () => ({ all: async () => [...checklistItemsStore] }),
        },
        AuditLog: {
          create: async (data: Record<string, unknown>) => data,
        },
        PromptTemplate: {
          where: () => ({ first: async () => null }),
        },
        Project: {
          orderBy: () => ({ all: async () => [projectRecord] }),
          select: () => ({
            where: ({ id }: { id: string }) => ({
              first: async () =>
                id === projectRecord["id"] ? projectRecord : null,
            }),
          }),
          include: () => ({
            include: () => ({
              include: () => ({
                where: ({ id }: { id: string }) => ({
                  first: async () =>
                    id === projectRecord["id"]
                      ? {
                          ...projectRecord,
                          messages: [...chatMessagesStore].sort(
                            (a, b) =>
                              (a["createdAt"] as Date).getTime() -
                              (b["createdAt"] as Date).getTime()
                          ),
                        }
                      : null,
                }),
              }),
            }),
          }),
          where: ({ id }: { id: string }) => ({
            update: async (patch: Record<string, unknown>) => {
              if (id === projectRecord["id"]) {
                Object.assign(projectRecord, patch);
              }
              return projectRecord;
            },
          }),
        },
        ProjectContext: {
          create: async (data: Record<string, unknown>) => {
            const contexts = projectRecord["contexts"] as Array<
              Record<string, unknown>
            >;
            const created = {
              scrapeStatus: null,
              lastScrapedAt: null,
              scrapedMetadata: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              ...data,
            };
            contexts.push(created);
            return created;
          },
          where: (filter: Record<string, unknown>) => ({
            first: async () => {
              const contexts = projectRecord["contexts"] as Array<
                Record<string, unknown>
              >;
              return (
                contexts.find((c) =>
                  Object.entries(filter).every(([k, v]) => c[k] === v)
                ) ?? null
              );
            },
            all: async () => projectRecord["contexts"],
            update: async (patch: Record<string, unknown>) => {
              const contexts = projectRecord["contexts"] as Array<
                Record<string, unknown>
              >;
              const match = contexts.find((c) => c["id"] === filter["id"]);
              if (match) Object.assign(match, patch);
              return match ?? null;
            },
          }),
        },
        ScrapeJob: {
          where: () => ({
            orderBy: () => ({
              limit: () => ({ all: async () => [...scrapeJobsStore] }),
            }),
            update: async (patch: Record<string, unknown>) => {
              const job = scrapeJobsStore[scrapeJobsStore.length - 1];
              if (job) Object.assign(job, patch);
              return job ?? null;
            },
          }),
          create: async (data: Record<string, unknown>) => {
            const job = {
              id: `job-${scrapeJobsStore.length + 1}`,
              createdAt: new Date(),
              ...data,
            };
            scrapeJobsStore.push(job);
            return job;
          },
        },
        ScrapedPage: {
          where: () => ({
            orderBy: () => ({
              limit: () => ({ all: async () => [...scrapedPagesStore] }),
            }),
          }),
          createAll: async (rows: Array<Record<string, unknown>>) => {
            const inserted = rows.map((r, idx) => ({
              id: `page-${scrapedPagesStore.length + idx + 1}`,
              scrapedAt: new Date(),
              ...r,
            }));
            scrapedPagesStore.push(...inserted);
            return inserted;
          },
        },
        ChatMessage: {
          where: ({ projectId }: { projectId: string }) => ({
            orderBy: () => ({
              all: async () =>
                chatMessagesStore
                  .filter((m) => m["projectId"] === projectId)
                  .sort(
                    (a, b) =>
                      (a["createdAt"] as Date).getTime() -
                      (b["createdAt"] as Date).getTime()
                  ),
            }),
            deleteAll: async () => {
              chatMessagesStore.length = 0;
              return [];
            },
          }),
          create: async (data: Record<string, unknown>) => {
            chatMessagesStore.push(data);
            return data;
          },
        },
      },
    };

    const prismaMock = {
      db: {
        orm: ormMock,
        transaction: async (
          fn: (tx: { orm: typeof ormMock }) => Promise<unknown>
        ) => fn({ orm: ormMock }),
      },
    };

    const configMock = {
      get: (key: string) => {
        if (key === "JWT_SECRET") return "test-jwt-secret-key-2026-unit";
        if (key === "SCRAPER_SERVICE_URL") return "http://scraper.local:8001";
        if (key === "SCRAPER_API_KEY") return "internal-test-key";
        if (key === "SCRAPER_TIMEOUT_MS") return 15000;
        if (key === "GEMINI_MODEL") return "gemini-3.5-flash-lite";
        if (key === "OPENAI_MODEL") return "gpt-4o-mini";
        return "";
      },
    };

    const scraperService = new ScraperService(
      prismaMock as never,
      configMock as never
    );
    const leadsService = new LeadsService(
      prismaMock as never,
      scraperService,
      configMock as never
    );
    const mcpService = new McpService(
      prismaMock as never,
      scraperService,
      configMock as never,
      leadsService
    );
    const aiProvidersService = new AiProvidersService(
      prismaMock as never,
      configMock as never
    );
    const settingsService = new SettingsService(prismaMock as never);
    const chatService = new ChatService(
      prismaMock as never,
      aiProvidersService,
      mcpService
    );

    return {
      mcpService,
      leadsService,
      aiProvidersService,
      settingsService,
      chatService,
      projectRecord,
      chatMessagesStore,
      scrapedPagesStore,
    };
  }

  it("parses @tags cleanly without matching email addresses", () => {
    const tags = parseMentionTags(
      "Check @context and @linkedin and @scrape https://aetheris.example, email hello@aetheris.network"
    );
    expect(tags).toEqual(["context", "linkedin", "scrape"]);
  });

  it("sanitizes JSON schema into Gemini-compatible OpenAPI schema", () => {
    const cleaned = sanitizeJsonSchemaForGemini({
      type: "object",
      $schema: "http://json-schema.org/draft-07/schema#",
      additionalProperties: false,
      properties: {
        url: { type: "string", description: "Target URL" },
        levels: { type: ["integer", "null"], default: 2 },
      },
      required: ["url"],
    });
    expect(cleaned?.["$schema"]).toBeUndefined();
    expect(cleaned?.["additionalProperties"]).toBeUndefined();
    expect(cleaned?.["type"]).toBe("OBJECT");
    const props = cleaned?.["properties"] as Record<string, Record<string, unknown>>;
    expect(props["levels"]?.["type"]).toBe("INTEGER");
    expect(props["levels"]?.["nullable"]).toBe(true);
  });

  it("initializes built-in MCP server, knows tools from the start, and resolves @context & @linkedin", async () => {
    const { mcpService } = createHarness();
    await mcpService.onModuleInit();

    const overview = await mcpService.listServers();
    expect(overview.servers).toHaveLength(1);
    expect(overview.servers[0]?.id).toBe("pulseos-builtin");
    expect(overview.servers[0]?.status).toBe("connected");
    expect(overview.totalTools).toBe(9);

    const toolNames = overview.servers[0]?.tools.map((t) => t.name) ?? [];
    expect(toolNames).toContain("get_company_context");
    expect(toolNames).toContain("get_context_by_tag");
    expect(toolNames).toContain("fetch_project_leads");
    expect(toolNames).toContain("scrape_context_link");
    expect(toolNames).toContain("scrape_url");
    expect(toolNames).toContain("get_scraped_data");
    expect(toolNames).toContain("get_agency_profile");

    const mentions = await mcpService.getChatMentionSuggestions("proj-mcp-1");
    expect(mentions.some((m) => m.tag === "@context")).toBe(true);
    expect(mentions.some((m) => m.tag === "@linkedin" && m.availableCount === 1)).toBe(true);
    expect(mentions.some((m) => m.tag === "@official-website-docs")).toBe(true);
    expect(buildProjectMentionSuggestions).toBeDefined();

    const resolved = await mcpService.resolveMentionContext(
      "proj-mcp-1",
      "Please inspect @context and @linkedin"
    );
    expect(resolved.resolvedTags).toEqual(["@context", "@linkedin"]);
    expect(resolved.contextBlock).toContain("Aetheris AI Network");
    expect(resolved.contextBlock).toContain("linkedin.com/company/aetheris-labs");
    expect(resolved.usedContextIds).toContain("ctx-li-1");

    await mcpService.onModuleDestroy();
  });

  it("executes multi-turn AI + MCP tool calling to scrape links with the Python scraper", async () => {
    const { mcpService, aiProvidersService, chatService, scrapedPagesStore } =
      createHarness();
    await mcpService.onModuleInit();
    await aiProvidersService.saveProviderConfig("google", {
      apiKey: "AIzaSyTestMcpKey1234",
      selectedModel: "gemini-2.5-flash",
    });

    const originalFetch = globalThis.fetch;
    const aiRequests: Array<Record<string, unknown>> = [];
    let geminiCallCount = 0;

    globalThis.fetch = (async (
      input: string | URL | Request,
      init?: RequestInit
    ) => {
      const url = typeof input === "string" ? input : input.toString();

      // Mock Python scraper microservice call triggered by MCP tool `scrape_context_link`
      if (url.startsWith("http://scraper.local:8001/api/v1/scrape")) {
        return new Response(
          JSON.stringify({
            targetType: "website",
            targetValue: "https://aetheris.example",
            normalizedUrl: "https://aetheris.example",
            status: "completed",
            reachable: true,
            httpStatus: 200,
            title: "Aetheris Network Live Docs",
            description: "MCP & GPU inference SDK live",
            headings: ["Aetheris SDK"],
            socialLinks: { github: "https://github.com/aetheris" },
            signals: ["mcp_server", "developer_sdk"],
            rawPreview: "Live scraped page confirming MCP server and TypeScript SDK.",
            summary: "Live scraped summary from Python scraper.",
            durationMs: 120,
            providerUsed: "playwright_js",
            specializedProvider: null,
            requiresApiKey: false,
            apiKeyConfigured: false,
            levelsScraped: 1,
            pagesScraped: 1,
            contacts: ["hello@aetheris.example"],
            structuredData: [],
            pages: [
              {
                url: "https://aetheris.example",
                depth: 1,
                httpStatus: 200,
                renderMode: "playwright_js",
                title: "Aetheris Network Live Docs",
                description: "MCP & GPU inference SDK live",
                headings: [{ level: "h1", text: "Aetheris SDK" }],
                textContent: "Live scraped page confirming MCP server and TypeScript SDK.",
                wordCount: 9,
                links: [],
                socialLinks: {},
                contacts: ["hello@aetheris.example"],
                signals: ["mcp_server", "developer_sdk"],
                metaTags: {},
                structuredData: [],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // Mock Gemini multi-turn tool-calling API
      const parsedBody = init?.body
        ? (JSON.parse(String(init.body)) as Record<string, unknown>)
        : {};
      aiRequests.push(parsedBody);
      geminiCallCount += 1;

      if (geminiCallCount === 1) {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: "model",
                  parts: [
                    {
                      functionCall: {
                        name: "scrape_context_link",
                        args: { contextType: "website" },
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    text: "I scraped Aetheris Network Live Docs via MCP and found `mcp_server` and `developer_sdk` signals, plus LinkedIn context from @linkedin.",
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    try {
      const updated = await chatService.sendMessage("proj-mcp-1", {
        content: "Check @linkedin and scrape @website with @scrape",
      });

      expect(geminiCallCount).toBe(2);
      // Turn 1 sent tool declarations and system prompt MCP awareness right from the beginning
      const firstSysText = JSON.stringify(aiRequests[0]?.["systemInstruction"]);
      expect(firstSysText).toContain("Connected MCP Servers & Available Tools");
      expect(firstSysText).toContain("scrape_context_link");
      expect(Array.isArray(aiRequests[0]?.["tools"])).toBe(true);

      // Turn 2 received the live Python scraper result via MCP functionResponse
      const secondContents = JSON.stringify(aiRequests[1]?.["contents"]);
      expect(secondContents).toContain("Aetheris Network Live Docs");
      expect(secondContents).toContain("mcp_server");

      // Scraped page was persisted in DB
      expect(scrapedPagesStore).toHaveLength(1);

      // Final chat message recorded MCP tools & resolved tags
      const aiMsg = updated.messages[updated.messages.length - 1];
      expect(aiMsg?.content).toContain("Aetheris Network Live Docs");
      expect(aiMsg?.mcpToolsUsed).toContain("scrape_context_link");
      expect(aiMsg?.resolvedTags).toContain("@linkedin");
      expect(aiMsg?.resolvedTags).toContain("@website");
      expect(aiMsg?.usedContextIds).toContain("ctx-li-1");
      expect(aiMsg?.usedContextIds).toContain("ctx-web-1");
    } finally {
      globalThis.fetch = originalFetch;
      await mcpService.onModuleDestroy();
    }
  });

  it("persists About Us agency & representative profile and automatically injects it into every chat", async () => {
    const { mcpService, aiProvidersService, settingsService, chatService } =
      createHarness();
    await mcpService.onModuleInit();
    await aiProvidersService.saveProviderConfig("google", {
      apiKey: "AIzaSyTestAgencyKey1234",
      selectedModel: "gemini-2.5-flash",
    });

    const initial = await settingsService.getAgencyProfile();
    expect(initial.companyName).toBe("");

    const saved = await settingsService.saveAgencyProfile(
      {
        companyName: "NovaChain Growth Partners",
        tagline: "Web3 BD & AI Automation Agency",
        aboutUs: "We help protocols scale liquidity and AI integrations.",
        services: "KOL outreach, Market Maker intros, MCP servers",
        website: "https://novachain.agency",
        email: "hello@novachain.agency",
        phone: "+1-555-0199",
        address: "548 Market St, Suite 4200",
        city: "San Francisco, CA",
        country: "USA",
        representativeName: "Elena Rostova",
        representativeTitle: "Managing Partner",
        representativeEmail: "elena@novachain.agency",
        representativePhone: "+1-555-0188",
        socialLinks: {
          linkedin: "https://linkedin.com/company/novachain-growth",
          x: "https://x.com/novachain_bd",
          telegram: "",
          discord: "",
        },
        notes: "Always offer a 15-minute intro call.",
      },
      {
        id: "usr-1",
        email: "elena@novachain.agency",
        name: "Elena Rostova",
        role: "admin",
        title: "Managing Partner",
        avatarColor: "bg-[#1d4ed8]",
        isActive: true,
        permissions: [],
      }
    );

    expect(saved.companyName).toBe("NovaChain Growth Partners");
    expect(saved.representativeName).toBe("Elena Rostova");

    const originalFetch = globalThis.fetch;
    let capturedSystemPrompt = "";
    globalThis.fetch = (async (
      _input: string | URL | Request,
      init?: RequestInit
    ) => {
      const body = init?.body
        ? (JSON.parse(String(init.body)) as Record<string, unknown>)
        : {};
      capturedSystemPrompt = JSON.stringify(body["systemInstruction"]);
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    text: "Hi, I am Elena Rostova from NovaChain Growth Partners!",
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    try {
      await chatService.sendMessage("proj-mcp-1", {
        content: "Write a short intro email from me.",
      });

      expect(capturedSystemPrompt).toContain("NovaChain Growth Partners");
      expect(capturedSystemPrompt).toContain("Elena Rostova");
      expect(capturedSystemPrompt).toContain("Managing Partner");
      expect(capturedSystemPrompt).toContain("548 Market St, Suite 4200");
      expect(capturedSystemPrompt).toContain("San Francisco, CA");
      expect(capturedSystemPrompt).toContain("elena@novachain.agency");
      expect(capturedSystemPrompt).toContain("15-minute intro call");
      expect(capturedSystemPrompt).toContain("EXTERNAL TARGET / PROSPECTIVE CLIENT COMPANY");
      expect(capturedSystemPrompt).toContain("NEVER write 'on behalf of [Target Company]'");
    } finally {
      globalThis.fetch = originalFetch;
      await mcpService.onModuleDestroy();
    }
  });

  it("gathers leads via encrypted provider API key, persists them to context, and auto-fetches on MCP/ @leads when missing", async () => {
    const { mcpService, leadsService, projectRecord } = createHarness();
    await mcpService.onModuleInit();

    const initialStatuses = await leadsService.listProviderStatuses();
    const apolloInitial = initialStatuses.find((s) => s.provider === "apollo");
    expect(apolloInitial?.configured).toBe(false);
    expect(apolloInitial?.requiresApiKey).toBe(true);
    const scraperInitial = initialStatuses.find(
      (s) => s.provider === "website_scraper"
    );
    expect(scraperInitial?.configured).toBe(true);
    expect(scraperInitial?.requiresApiKey).toBe(false);

    // Requires API key before fetching from Apollo
    let missingKeyErr: unknown = null;
    try {
      await leadsService.fetchLeadsForProject("proj-mcp-1", {
        provider: "apollo",
        limit: 5,
      });
    } catch (err) {
      missingKeyErr = err;
    }
    expect(missingKeyErr).toBeDefined();

    // Save encrypted Apollo key and verify masked status
    const updatedStatuses = await leadsService.saveProviderKey(
      "apollo",
      "apollo_live_secret_9988"
    );
    const apolloConfigured = updatedStatuses.find(
      (s) => s.provider === "apollo"
    );
    expect(apolloConfigured?.configured).toBe(true);
    expect(apolloConfigured?.source).toBe("workspace");
    expect(apolloConfigured?.maskedKey).toContain("9988");

    const originalFetch = globalThis.fetch;
    let apolloCalls = 0;
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("api.apollo.io")) {
        apolloCalls++;
        return new Response(
          JSON.stringify({
            people: [
              {
                name: "Satoshi Lin",
                title: "Head of Partnerships",
                email: "satoshi@aetheris.example",
                linkedin_url: "https://linkedin.com/in/satoshi-lin",
              },
              {
                name: "Mira Patel",
                title: "Co-Founder & CTO",
                email: "mira@aetheris.example",
                linkedin_url: "https://linkedin.com/in/mira-patel",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    }) as typeof fetch;

    try {
      // Test MCP @leads auto-fetching when no manual leads exist yet
      const autoFetchedMention = await mcpService.resolveMentionContext(
        "proj-mcp-1",
        "Find @leads for outreach"
      );
      expect(apolloCalls).toBe(1);
      expect(autoFetchedMention.resolvedTags).toContain("@leads");
      expect(autoFetchedMention.contextBlock).toContain("satoshi@aetheris.example");
      expect(autoFetchedMention.contextBlock).toContain("mira@aetheris.example");

      const savedContexts = projectRecord["contexts"] as Array<
        Record<string, unknown>
      >;
      const leadContexts = savedContexts.filter((c) => c["type"] === "lead");
      expect(leadContexts).toHaveLength(2);

      // Calling MCP fetch_project_leads without forceRefresh reuses saved leads without calling Apollo again
      const toolResult = await mcpService.callTool("fetch_project_leads", {
        projectId: "proj-mcp-1",
      });
      expect(toolResult.isError).toBe(false);
      expect(apolloCalls).toBe(1);
      const parsedResult = JSON.parse(toolResult.text) as Record<
        string,
        unknown
      >;
      expect(parsedResult["alreadyFetched"]).toBe(true);
      expect(parsedResult["leadsCount"]).toBe(2);

      // Fetching manually again deduplicates existing emails
      const dedupResult = await leadsService.fetchLeadsForProject("proj-mcp-1", {
        provider: "apollo",
        limit: 5,
      });
      expect(apolloCalls).toBe(2);
      expect(dedupResult.addedCount).toBe(0);
      expect(dedupResult.skippedCount).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
      await mcpService.onModuleDestroy();
    }
  });
});
