import { describe, expect, it } from "bun:test";
import { BadRequestException } from "@nestjs/common";
import {
  addContextFormSchema,
  buildContextualAiResponse,
  evaluateChecklistItemAgainstProject,
} from "@repo/shared";
import { ZodValidationPipe } from "../src/common/pipes/zod-validation.pipe.js";
import { validateEnv } from "../src/config/env.js";
import { mapPrismaProjectToDomain } from "../src/projects/project.mapper.js";

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
});
