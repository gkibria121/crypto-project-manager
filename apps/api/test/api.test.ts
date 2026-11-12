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
  addContextFormSchema,
  type AuthUser,
  buildContextualAiResponse,
  evaluateChecklistItemAgainstProject,
  getPermissionsForRole,
  hasAnyRole,
  hasPermission,
  type Permission,
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
import { mapPrismaProjectToDomain } from "../src/projects/project.mapper.js";
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
});
