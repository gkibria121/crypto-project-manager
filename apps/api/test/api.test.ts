import { describe, expect, it } from "bun:test";
import {
  BadRequestException,
  type ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  hashPassword,
  hashSessionToken,
  signJwt,
  verifyJwt,
  verifyPassword,
} from "@repo/database";
import {
  COMPACT_PAGE_SIZE_OPTIONS,
  CREATABLE_BUSINESS_STATUS_ORDER,
  DEFAULT_PAGE_SIZE_OPTIONS,
  addContextFormSchema,
  type AuthUser,
  buildContextualAiResponse,
  buildPaginationWindow,
  bulkDeleteProjectsDtoSchema,
  calculatePaginationMeta,
  clampPage,
  evaluateChecklistItemAgainstProject,
  getPermissionsForRole,
  hasAnyRole,
  hasPermission,
  newProjectFormSchema,
  paginateItems,
  type Permission,
  shouldAutoActivateOnActivity,
  syncProjectsDtoSchema,
  updateProjectFormSchema,
  type UserRole,
} from "@repo/shared";
import {
  IS_PUBLIC_KEY,
  PERMISSIONS_KEY,
  ROLES_KEY,
  type AuthenticatedUser,
} from "../src/auth/auth.decorators.js";
import { AuthService } from "../src/auth/auth.service.js";
import { RbacGuard } from "../src/auth/rbac.guard.js";
import { ZodValidationPipe } from "../src/common/pipes/zod-validation.pipe.js";
import { validateEnv } from "../src/config/env.js";
import { computeActivatedProjectPatch } from "../src/projects/project-lifecycle.helper.js";
import { mapPrismaProjectToDomain } from "../src/projects/project.mapper.js";
import { ProjectSyncService } from "../src/projects/project-sync.service.js";
import { ProjectsService } from "../src/projects/projects.service.js";
import { UsersService } from "../src/users/users.service.js";

describe("NestJS Core Backend Unit Tests", () => {
  it("maps a full Prisma 8 Project graph into CryptoProject domain DTO", () => {
    const now = new Date("2026-11-11T10:00:00.000Z");
    const mapped = mapPrismaProjectToDomain({
      id: "proj-1",
      name: "Test Protocol",
      ticker: "$TEST",
      chain: "Solana",
      stage: "Pre-TGE",
      businessStatus: "new",
      avatarBg: "bg-[#1d4ed8]",
      logoUrl: null,
      tagline: "Sub-second DeFi mesh",
      campaignBudget: "$25,000 / mo",
      sentimentScore: 92,
      tags: ["solana", "pre-tge"],
      isPinned: true,
      unreadInsights: 1,
      lastActivityTime: "Now",
      lastScrapedAt: now,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
      contexts: [
        {
          id: "ctx-1",
          projectId: "proj-1",
          type: "website",
          title: "Website",
          value: "https://test.xyz",
          url: "https://test.xyz",
          summary: "Official site",
          isActive: true,
          updatedAtLabel: "Now",
          scrapeStatus: "completed",
          lastScrapedAt: now,
          scrapedMetadata: {
            reachable: true,
            title: "Test Protocol",
            signals: ["mcp_server", "developer_sdk"],
            headings: [],
            socialLinks: {},
          },
          createdAt: now,
          updatedAt: now,
        },
      ],
      messages: [
        {
          id: "msg-1",
          projectId: "proj-1",
          sender: "ai",
          content: "Welcome!",
          timestampLabel: "10:00 AM",
          usedContextIds: ["ctx-1"],
          suggestedActions: [],
          appliedSystemPromptTitle: null,
          model: "pulseos-engine",
          metadata: null,
          createdAt: now,
        },
      ],
      checklistStates: [
        {
          id: "st-1",
          projectId: "proj-1",
          checklistItemId: "chk-mcp-server",
          checked: true,
          scanResultNote: "MCP signal detected",
          scannedAtLabel: "Just now",
          updatedAt: now,
        },
      ],
    });

    expect(mapped.stage).toBe("Pre-TGE");
    expect(mapped.contexts[0]?.scrapedMetadata?.signals).toContain("mcp_server");
    expect(mapped.checklistState?.["chk-mcp-server"]?.checked).toBe(true);

    const checklistResult = evaluateChecklistItemAgainstProject(mapped, {
      id: "chk-mcp-server",
      label: "MCP Server",
      scanPrompt: "Does it have an MCP server?",
    });
    expect(checklistResult.checked).toBe(true);

    const aiReply = buildContextualAiResponse(
      mapped,
      "Write a 4-tweet X thread",
      mapped.contexts
    );
    expect(aiReply).toContain("Test Protocol");
    expect(aiReply).toContain("mcp_server");
  });

  it("validates DTOs with ZodValidationPipe and rejects invalid input", () => {
    const pipe = new ZodValidationPipe(addContextFormSchema);
    const valid = pipe.transform({
      type: "website",
      title: "Docs",
      value: "https://docs.example.com",
    });
    expect(valid.title).toBe("Docs");

    expect(() =>
      pipe.transform({ type: "website", title: "", value: "" })
    ).toThrow(BadRequestException);

    const updateProjectPipe = new ZodValidationPipe(updateProjectFormSchema);
    const validUpdate = updateProjectPipe.transform({
      name: "Aetheris AI Network v2",
      ticker: "$AETH",
      chain: "Solana",
      stage: "Mainnet Live",
      businessStatus: "collaborated",
      tagline: "Next-gen autonomous DeFi GPU network",
      campaignBudget: "$60,000 / mo",
      sentimentScore: 95,
      isPinned: true,
      avatarBg: "bg-[#1d4ed8]",
      logoUrl: "",
      website: "https://aetheris.network",
      xHandle: "@AetherisNetwork",
      linkedin: "linkedin.com/company/aetheris-labs",
      telegram: "t.me/AetherisOfficial",
    });
    expect(validUpdate.name).toBe("Aetheris AI Network v2");
    expect(validUpdate.sentimentScore).toBe(95);

    expect(() =>
      updateProjectPipe.transform({
        name: "",
        ticker: "",
        chain: "Solana",
        stage: "Pre-TGE",
        businessStatus: "new",
        tagline: "",
        campaignBudget: "",
        sentimentScore: 150,
        avatarBg: "",
        logoUrl: "",
        website: "",
        xHandle: "",
        linkedin: "",
      })
    ).toThrow(BadRequestException);
  });

  it("validates environment variables", () => {
    const env = validateEnv({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      PORT: "4000",
      SCRAPER_SERVICE_URL: "http://scraper:8000",
    });
    expect(env.PORT).toBe(4000);
    expect(env.SCRAPER_SERVICE_URL).toBe("http://scraper:8000");

    expect(() => validateEnv({})).toThrow();
  });

  it("hashes and verifies passwords with scrypt and timing-safe comparison", () => {
    const hashed = hashPassword("PulseAdmin!2026");
    expect(hashed.startsWith("scrypt$")).toBe(true);
    expect(verifyPassword("PulseAdmin!2026", hashed)).toBe(true);
    expect(verifyPassword("WrongPassword!2026", hashed)).toBe(false);
    expect(verifyPassword("PulseAdmin!2026", "malformed-hash")).toBe(false);
  });

  it("signs, verifies, and hashes JWT session tokens", () => {
    const secret = "unit-test-jwt-secret-with-at-least-32-chars";
    const { token } = signJwt(
      {
        sub: "usr-admin",
        email: "alex@pulseos.xyz",
        name: "Alex Rivera",
        role: "admin",
        sid: "sess-123",
      },
      secret,
      3600
    );

    const verified = verifyJwt(token, secret);
    expect(verified).not.toBeNull();
    expect(verified?.sub).toBe("usr-admin");
    expect(verified?.role).toBe("admin");
    expect(verified?.sid).toBe("sess-123");

    expect(verifyJwt(token, "wrong-secret")).toBeNull();
    expect(hashSessionToken(token)).toHaveLength(64);
  });

  it("enforces the RBAC role-permission matrix across all 4 roles", () => {
    const adminPerms = getPermissionsForRole("admin");
    const managerPerms = getPermissionsForRole("manager");
    const analystPerms = getPermissionsForRole("analyst");
    const viewerPerms = getPermissionsForRole("viewer");

    expect(adminPerms).toContain("users:write");
    expect(adminPerms).toContain("projects:delete");

    expect(managerPerms).toContain("projects:create");
    expect(managerPerms).toContain("settings:write");
    expect(managerPerms).toContain("users:read");
    expect(managerPerms).not.toContain("users:write");
    expect(managerPerms).not.toContain("projects:delete");

    expect(analystPerms).toContain("chat:write");
    expect(analystPerms).toContain("contexts:write");
    expect(analystPerms).toContain("scraper:trigger");
    expect(analystPerms).not.toContain("projects:create");
    expect(analystPerms).not.toContain("settings:write");

    expect(viewerPerms).toContain("projects:read");
    expect(viewerPerms).toContain("settings:read");
    expect(viewerPerms).not.toContain("chat:write");

    const viewerUser: AuthUser = {
      id: "usr-viewer",
      email: "sarah@pulseos.xyz",
      name: "Sarah Lin",
      role: "viewer",
      title: "LP Observer",
      avatarColor: "bg-[#6d28d9]",
      isActive: true,
      permissions: viewerPerms,
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
    };

    expect(hasPermission(viewerUser, "projects:read")).toBe(true);
    expect(hasPermission(viewerUser, "chat:write")).toBe(false);
    expect(hasAnyRole(viewerUser, ["viewer", "analyst"])).toBe(true);
    expect(hasAnyRole(viewerUser, ["admin"])).toBe(false);
  });

  it("enforces RbacGuard on route handlers", () => {
    const createMockExecutionContext = (
      user: AuthUser,
      meta: {
        isPublic?: boolean;
        roles?: UserRole[];
        permissions?: Permission[];
      }
    ) => {
      const reflector = {
        getAllAndOverride: (key: string) => {
          if (key === IS_PUBLIC_KEY) return meta.isPublic ?? false;
          if (key === ROLES_KEY) return meta.roles;
          if (key === PERMISSIONS_KEY) return meta.permissions;
          return undefined;
        },
      } as unknown as Reflector;

      const context = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({ user }),
        }),
      } as unknown as ExecutionContext;

      return { guard: new RbacGuard(reflector), context };
    };

    const analystUser: AuthUser = {
      id: "usr-analyst",
      email: "marcus@pulseos.xyz",
      name: "Marcus Vance",
      role: "analyst",
      title: "DeFi Research Analyst",
      avatarColor: "bg-[#047857]",
      isActive: true,
      permissions: getPermissionsForRole("analyst"),
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
    };

    const allowed = createMockExecutionContext(analystUser, {
      permissions: ["chat:write", "contexts:write"],
    });
    expect(allowed.guard.canActivate(allowed.context)).toBe(true);

    const deniedPerm = createMockExecutionContext(analystUser, {
      permissions: ["users:write"],
    });
    expect(() => deniedPerm.guard.canActivate(deniedPerm.context)).toThrow(
      ForbiddenException
    );

    const deniedRole = createMockExecutionContext(analystUser, {
      roles: ["admin"],
    });
    expect(() => deniedRole.guard.canActivate(deniedRole.context)).toThrow(
      ForbiddenException
    );
  });

  it("registers new users as inactive by default, blocks login until activated, and allows admin activation", async () => {
    const usersStore: Array<{
      id: string;
      email: string;
      name: string;
      passwordHash: string;
      role: UserRole;
      title: string;
      avatarColor: string;
      isActive: boolean;
      lastLoginAt: Date | null;
      createdAt: Date;
    }> = [];
    const sessionsStore: Array<Record<string, unknown>> = [];
    const auditStore: Array<Record<string, unknown>> = [];

    const ormMock = {
      public: {
        User: {
          select: () => ({
            where: (filter: { email?: string; role?: UserRole; isActive?: boolean }) => ({
              first: async () =>
                usersStore.find((u) => u.email === filter.email) ?? null,
              all: async () =>
                usersStore.filter(
                  (u) =>
                    (filter.role === undefined || u.role === filter.role) &&
                    (filter.isActive === undefined ||
                      u.isActive === filter.isActive)
                ),
            }),
          }),
          where: (filter: { id?: string; email?: string }) => ({
            first: async () =>
              usersStore.find(
                (u) =>
                  (filter.id ? u.id === filter.id : true) &&
                  (filter.email ? u.email === filter.email : true)
              ) ?? null,
            update: async (patch: Partial<(typeof usersStore)[number]>) => {
              const target = usersStore.find((u) => u.id === filter.id);
              if (target) Object.assign(target, patch);
              return target ?? null;
            },
          }),
          orderBy: () => ({
            all: async () => [...usersStore],
          }),
          create: async (row: Omit<(typeof usersStore)[number], "createdAt">) => {
            const created = { ...row, createdAt: new Date() };
            usersStore.push(created);
            return created;
          },
        },
        AuthSession: {
          create: async (row: Record<string, unknown>) => {
            sessionsStore.push(row);
            return row;
          },
          where: () => ({
            update: async () => null,
          }),
        },
        AuditLog: {
          create: async (row: Record<string, unknown>) => {
            auditStore.push(row);
            return row;
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
        if (key === "SESSION_TTL_SECONDS") return 3600;
        if (key === "JWT_SECRET")
          return "unit-test-jwt-secret-with-at-least-32-chars";
        return undefined;
      },
    };

    const authService = new AuthService(
      prismaMock as never,
      configMock as never
    );
    const usersService = new UsersService(prismaMock as never, authService);

    const registration = await authService.register({
      name: "Jordan Taylor",
      email: "Jordan@PulseOS.xyz",
      password: "Password!2026",
      title: "Ecosystem Strategist",
    });

    expect(registration.requiresActivation).toBe(true);
    expect(registration.user.isActive).toBe(false);
    expect(registration.user.role).toBe("analyst");
    expect(sessionsStore).toHaveLength(0);

    await expect(
      authService.login({
        email: "jordan@pulseos.xyz",
        password: "Password!2026",
      })
    ).rejects.toThrow(ForbiddenException);

    const adminActor: AuthenticatedUser = {
      id: "usr-admin-1",
      email: "alex@pulseos.xyz",
      name: "Alex Vance",
      role: "admin",
      title: "Managing Partner",
      avatarColor: "bg-[#1d4ed8]",
      isActive: true,
      permissions: getPermissionsForRole("admin"),
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
      sessionId: "ses-admin-1",
    };

    const updatedUsers = await usersService.updateUserStatus(
      adminActor,
      registration.user.id,
      { isActive: true }
    );

    expect(updatedUsers[0]?.isActive).toBe(true);

    const loginSession = await authService.login({
      email: "jordan@pulseos.xyz",
      password: "Password!2026",
    });

    expect(loginSession.user.isActive).toBe(true);
    expect(loginSession.accessToken.length).toBeGreaterThan(20);
  });

  it("rejects project sync when provider API key is missing in .env and syncs projects into 'new' state with website, x, and linkedin contexts when configured", async () => {
    const syncPipe = new ZodValidationPipe(syncProjectsDtoSchema);
    const parsedSyncDto = syncPipe.transform({
      provider: "coingecko",
      limit: 1000,
      page: 1,
      noLimit: true,
    });
    expect(parsedSyncDto.provider).toBe("coingecko");
    expect(parsedSyncDto.limit).toBe(1000);
    expect(parsedSyncDto.page).toBe(1);
    expect(parsedSyncDto.noLimit).toBe(true);

    const projectsStore: Array<Record<string, unknown>> = [];
    const contextsStore: Array<Record<string, unknown>> = [];
    const messagesStore: Array<Record<string, unknown>> = [];
    const auditStore: Array<Record<string, unknown>> = [];

    const buildProjectWithRelations = (proj: Record<string, unknown>) => ({
      ...proj,
      createdAt: (proj["createdAt"] as Date) ?? new Date(),
      updatedAt: (proj["updatedAt"] as Date) ?? new Date(),
      lastScrapedAt: null,
      contexts: contextsStore
        .filter((c) => c["projectId"] === proj["id"])
        .map((c) => ({
          ...c,
          summary: (c["summary"] as string | null) ?? null,
          scrapeStatus: null,
          lastScrapedAt: null,
          scrapedMetadata: null,
          createdAt: (c["createdAt"] as Date) ?? new Date(),
          updatedAt: new Date(),
        })),
      messages: messagesStore
        .filter((m) => m["projectId"] === proj["id"])
        .map((m) => ({
          ...m,
          appliedSystemPromptTitle: null,
          metadata: null,
          createdAt: new Date(),
        })),
      checklistStates: [],
    });

    const ormMock = {
      public: {
        Project: {
          include: () => ({
            include: () => ({
              include: () => ({
                orderBy: () => ({
                  all: async () =>
                    projectsStore.map((p) => buildProjectWithRelations(p)),
                }),
              }),
            }),
          }),
          create: async (row: Record<string, unknown>) => {
            projectsStore.push({
              ...row,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            return row;
          },
          where: ({ id }: { id: string }) => ({
            update: async (patch: Record<string, unknown>) => {
              const target = projectsStore.find((p) => p["id"] === id);
              if (target) {
                Object.assign(target, patch, { updatedAt: new Date() });
              }
              return target ?? null;
            },
          }),
        },
        ProjectContext: {
          create: async (row: Record<string, unknown>) => {
            contextsStore.push(row);
            return row;
          },
          createAll: async (rows: Array<Record<string, unknown>>) => {
            contextsStore.push(...rows);
            return rows;
          },
          where: ({ id }: { id: string }) => ({
            update: async (patch: Record<string, unknown>) => {
              const target = contextsStore.find((c) => c["id"] === id);
              if (target) {
                Object.assign(target, patch, { updatedAt: new Date() });
              }
              return target ?? null;
            },
          }),
        },
        ChatMessage: {
          create: async (row: Record<string, unknown>) => {
            messagesStore.push(row);
            return row;
          },
        },
        AuditLog: {
          create: async (row: Record<string, unknown>) => {
            auditStore.push(row);
            return row;
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

    const envKeys: Record<string, string> = {
      COINGECKO_API_KEY: "",
      COINMARKETCAP_API_KEY: "",
      LIVECOINWATCH_API_KEY: "",
      COINCAP_API_KEY: "",
    };

    const configMock = {
      get: (key: string) => envKeys[key] ?? "",
    };

    const syncService = new ProjectSyncService(
      prismaMock as never,
      configMock as never
    );

    const statusesBefore = syncService.listProvidersStatus();
    expect(statusesBefore.every((s) => s.configured === false)).toBe(true);

    // 1. Missing API key throws BadRequestException with clear provider error message
    await expect(
      syncService.syncFromProvider({ provider: "coingecko", limit: 2 })
    ).rejects.toThrow(/API key is not given for provider "CoinGecko"/);

    await expect(
      syncService.syncFromProvider({ provider: "coinmarketcap", limit: 2 })
    ).rejects.toThrow(/API key is not given for provider "CoinMarketCap"/);

    // 2. Configure COINGECKO_API_KEY and sync projects
    envKeys["COINGECKO_API_KEY"] = "cg-demo-test-key-123";
    expect(
      syncService.listProvidersStatus().find((s) => s.id === "coingecko")
        ?.configured
    ).toBe(true);

    const mockFetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/coins/markets")) {
        return new Response(
          JSON.stringify([
            {
              id: "render-token",
              symbol: "rndr",
              name: "Render Network",
              image: "https://assets.coingecko.com/coins/images/render.png",
              current_price: 8.45,
              market_cap: 4_350_000_000,
              market_cap_rank: 24,
              price_change_percentage_24h: 6.2,
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/coins/render-token")) {
        return new Response(
          JSON.stringify({
            id: "render-token",
            asset_platform_id: "solana",
            description: {
              en: "Distributed GPU rendering network on Solana.",
            },
            links: {
              homepage: ["https://rendernetwork.com"],
              twitter_screen_name: "rendernetwork",
              telegram_channel_identifier: "rendernetwork",
              official_forum_url: [
                "https://www.linkedin.com/company/render-network",
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("Not found", { status: 404 });
    }) as unknown as typeof fetch;

    const result = await syncService.syncFromProvider(
      { provider: "coingecko", limit: 2, page: 1 },
      undefined,
      mockFetch
    );

    expect(result.page).toBe(1);
    expect(result.hasMore).toBe(true);
    expect(result.syncedCount).toBe(1);
    expect(result.createdProjects).toHaveLength(1);
    expect(result.logs.some((l) => l.level === "success")).toBe(true);

    const syncedProject = result.createdProjects[0];
    expect(syncedProject?.name).toBe("Render Network");
    expect(syncedProject?.ticker).toBe("$RNDR");
    expect(syncedProject?.businessStatus).toBe("new");
    expect(syncedProject?.tags).toContain("new");
    expect(syncedProject?.tags).toContain("coingecko");
    expect(syncedProject?.chain).toBe("Solana");

    const contextTypes = syncedProject?.contexts.map((c) => c.type) ?? [];
    expect(contextTypes).toContain("website");
    expect(contextTypes).toContain("x_handle");
    expect(contextTypes).toContain("linkedin");

    const websiteCtx = syncedProject?.contexts.find(
      (c) => c.type === "website"
    );
    const xCtx = syncedProject?.contexts.find((c) => c.type === "x_handle");
    const linkedinCtx = syncedProject?.contexts.find(
      (c) => c.type === "linkedin"
    );

    expect(websiteCtx?.url).toBe("https://rendernetwork.com");
    expect(xCtx?.value).toBe("@rendernetwork");
    expect(linkedinCtx?.url).toBe(
      "https://www.linkedin.com/company/render-network"
    );

    // 3. Re-syncing when project already exists in DB updates existing project with fresh data
    const secondSync = await syncService.syncFromProvider(
      { provider: "coingecko", limit: 2, page: 1 },
      undefined,
      mockFetch
    );
    expect(secondSync.syncedCount).toBe(0);
    expect(secondSync.updatedCount).toBe(1);
    expect(secondSync.updatedProjects[0]?.id).toBe(syncedProject?.id);
    expect(secondSync.logs.some((l) => l.level === "update")).toBe(true);
  });

  it("enforces project business status lifecycle rules and blocks direct creation into active", async () => {
    expect(CREATABLE_BUSINESS_STATUS_ORDER).not.toContain("active");
    expect(CREATABLE_BUSINESS_STATUS_ORDER).toContain("new");

    const createPipe = new ZodValidationPipe(newProjectFormSchema);
    expect(() =>
      createPipe.transform({
        name: "Direct Active Test",
        ticker: "$ACT",
        chain: "Solana",
        stage: "Pre-TGE",
        businessStatus: "active" as never,
        tagline: "",
        logoUrl: "",
        website: "",
        xHandle: "",
        linkedin: "",
      })
    ).toThrow(BadRequestException);

    const projectsStore: Array<Record<string, unknown>> = [
      {
        id: "proj-new-1",
        name: "Fresh Lead",
        ticker: "$FRSH",
        chain: "Solana",
        stage: "Pre-TGE",
        businessStatus: "new",
        avatarBg: "bg-[#1d4ed8]",
        logoUrl: null,
        tagline: "Fresh synced project",
        campaignBudget: "$25,000 / mo",
        sentimentScore: 85,
        tags: ["new", "solana"],
        isPinned: false,
        unreadInsights: 2,
        lastActivityTime: "Now",
        lastScrapedAt: null,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "proj-collab-1",
        name: "Partner Co",
        ticker: "$PRTN",
        chain: "Base",
        stage: "Mainnet Live",
        businessStatus: "collaborated",
        avatarBg: "bg-[#00a884]",
        logoUrl: null,
        tagline: "Existing partner",
        campaignBudget: "$50,000 / mo",
        sentimentScore: 95,
        tags: ["base"],
        isPinned: true,
        unreadInsights: 0,
        lastActivityTime: "1h",
        lastScrapedAt: null,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const buildProject = (row: Record<string, unknown>) => ({
      ...row,
      contexts: [],
      messages: [],
      checklistStates: [],
    });

    const ormMock = {
      public: {
        Project: {
          where: ({ id }: { id: string }) => ({
            first: async () => projectsStore.find((p) => p["id"] === id) ?? null,
            update: async (patch: Record<string, unknown>) => {
              const target = projectsStore.find((p) => p["id"] === id);
              if (target) Object.assign(target, patch);
              return target ?? null;
            },
            delete: async () => {
              const idx = projectsStore.findIndex((p) => p["id"] === id);
              if (idx === -1) return null;
              const [removed] = projectsStore.splice(idx, 1);
              return removed ?? null;
            },
          }),
          select: () => ({
            where: ({ id }: { id: string }) => ({
              first: async () =>
                projectsStore.find((p) => p["id"] === id) ?? null,
            }),
          }),
          include: () => ({
            include: () => ({
              include: () => ({
                where: ({ id }: { id: string }) => ({
                  first: async () => {
                    const row = projectsStore.find((p) => p["id"] === id);
                    return row ? buildProject(row) : null;
                  },
                }),
              }),
            }),
          }),
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

    const projectsService = new ProjectsService(prismaMock as never);

    // 1. Service also rejects creating directly into active
    await expect(
      projectsService.create({
        name: "Direct Active",
        ticker: "$DIR",
        chain: "Solana",
        stage: "Pre-TGE",
        businessStatus: "active" as never,
        tagline: "",
        logoUrl: "",
        website: "",
        xHandle: "",
        linkedin: "",
      })
    ).rejects.toThrow(BadRequestException);

    // 2. Viewing / marking unread insights as read must NOT change "new" -> "active"
    const viewed = await projectsService.markAsRead("proj-new-1");
    expect(viewed.businessStatus).toBe("new");
    expect(viewed.unreadInsights).toBe(0);

    // 3. Auto-activation rules: "new" -> "active" on admin/user activity; other states preserved
    expect(shouldAutoActivateOnActivity("new")).toBe(true);
    expect(shouldAutoActivateOnActivity("active")).toBe(false);
    expect(shouldAutoActivateOnActivity("collaborated")).toBe(false);

    const newPatch = computeActivatedProjectPatch({
      businessStatus: "new",
      tags: ["new", "solana"],
    });
    expect(newPatch.businessStatus).toBe("active");
    expect(newPatch.tags).toEqual(["solana"]);

    const collabPatch = computeActivatedProjectPatch({
      businessStatus: "collaborated",
      tags: ["base"],
    });
    expect(collabPatch.businessStatus).toBeUndefined();
    expect(collabPatch.lastActivityTime).toBe("Just now");

    // 4. Performing a real activity (updating logo) promotes "new" -> "active"
    const afterLogoEdit = await projectsService.updateLogo(
      "proj-new-1",
      "https://example.com/fresh.png"
    );
    expect(afterLogoEdit.businessStatus).toBe("active");
    expect(afterLogoEdit.tags).not.toContain("new");

    // 5. Performing an activity on "collaborated" preserves "collaborated"
    const afterPartnerLogoEdit = await projectsService.updateLogo(
      "proj-collab-1",
      "https://example.com/partner.png"
    );
    expect(afterPartnerLogoEdit.businessStatus).toBe("collaborated");

    // 6. Bulk state transition updates multiple projects cleanly
    const bulkResult = await projectsService.bulkUpdateBusinessStatus(
      ["proj-new-1", "proj-collab-1"],
      "contacted"
    );
    expect(bulkResult.updatedCount).toBe(2);
    expect(projectsStore[0]?.["businessStatus"]).toBe("contacted");
    expect(projectsStore[1]?.["businessStatus"]).toBe("contacted");

    // 7. Bulk delete validates DTO and removes selected projects atomically
    const bulkDeletePipe = new ZodValidationPipe(bulkDeleteProjectsDtoSchema);
    expect(() => bulkDeletePipe.transform({ projectIds: [] })).toThrow(
      BadRequestException
    );
    const parsedBulkDelete = bulkDeletePipe.transform({
      projectIds: ["proj-new-1", "proj-collab-1", "proj-missing"],
    });
    const bulkDeleteResult = await projectsService.bulkDelete(
      parsedBulkDelete.projectIds
    );
    expect(bulkDeleteResult.deletedCount).toBe(2);
    expect(bulkDeleteResult.deletedIds).toEqual(["proj-new-1", "proj-collab-1"]);
    expect(projectsStore).toHaveLength(0);
  });

  it("computes pagination metadata, slices items, and builds balanced page windows", () => {
    expect(DEFAULT_PAGE_SIZE_OPTIONS).toContain(100);
    expect(COMPACT_PAGE_SIZE_OPTIONS).toContain(100);
    const sample = Array.from({ length: 53 }, (_, i) => `item-${i + 1}`);

    const page2 = paginateItems(sample, 2, 10);
    expect(page2.items).toHaveLength(10);
    expect(page2.items[0]).toBe("item-11");
    expect(page2.meta).toEqual({
      currentPage: 2,
      pageSize: 10,
      totalItems: 53,
      totalPages: 6,
      startIndex: 10,
      endIndex: 20,
      hasPreviousPage: true,
      hasNextPage: true,
    });

    // Clamps out-of-range page numbers safely
    expect(clampPage(99, 6)).toBe(6);
    expect(clampPage(-5, 6)).toBe(1);
    const emptyMeta = calculatePaginationMeta(0, 3, 25);
    expect(emptyMeta.currentPage).toBe(1);
    expect(emptyMeta.totalPages).toBe(1);
    expect(emptyMeta.startIndex).toBe(0);
    expect(emptyMeta.endIndex).toBe(0);

    // Builds window with ellipsis for large page counts
    expect(buildPaginationWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(buildPaginationWindow(6, 12, 1)).toEqual([
      1,
      "ellipsis",
      5,
      6,
      7,
      "ellipsis",
      12,
    ]);
  });
});
