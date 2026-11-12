import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ContextType, CryptoProject } from "@repo/shared";
import { z } from "zod";
import type { PrismaService } from "../prisma/prisma.service.js";
import { findFullProjectOrThrow } from "../projects/project.mapper.js";
import type { ScraperService } from "../scraper/scraper.service.js";
import {
  DEFAULT_AGENCY_PROFILE_ID,
  mapAgencyProfileRowToDomain,
} from "../settings/agency-profile.helper.js";
import { mapTagToContextType, slugifyContextTag } from "./mcp-mentions.helper.js";

export interface PulseOsMcpDeps {
  prisma: PrismaService;
  scraperService: ScraperService;
}

function jsonToolResponse(payload: unknown, isError = false) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
    ...(isError ? { isError: true } : {}),
  };
}

function summarizeContextItem(c: CryptoProject["contexts"][number]) {
  return {
    id: c.id,
    type: c.type,
    title: c.title,
    value: c.value,
    url: c.url ?? null,
    summary: c.summary ?? null,
    isActive: c.isActive,
    scrapeStatus: c.scrapeStatus ?? null,
    lastScrapedAt: c.lastScrapedAt ?? null,
    scrapedMetadata: c.scrapedMetadata
      ? {
          title: c.scrapedMetadata.title ?? null,
          description: c.scrapedMetadata.description ?? null,
          reachable: c.scrapedMetadata.reachable,
          signals: c.scrapedMetadata.signals ?? [],
          contacts: c.scrapedMetadata.contacts ?? [],
          socialLinks: c.scrapedMetadata.socialLinks ?? {},
          pagesCount: c.scrapedMetadata.pagesCount ?? 0,
          rawPreview: c.scrapedMetadata.rawPreview?.slice(0, 1500) ?? null,
          errorReason: c.scrapedMetadata.errorReason ?? null,
          requiresApiKey: c.scrapedMetadata.requiresApiKey ?? false,
        }
      : null,
  };
}

function requireProjectId(projectId?: string): string {
  const trimmed = projectId?.trim();
  if (!trimmed) {
    throw new Error(
      "projectId is required when not running inside an active project chat session."
    );
  }
  return trimmed;
}

export function createPulseOsMcpServer(deps: PulseOsMcpDeps): McpServer {
  const server = new McpServer({
    name: "pulseos-workspace-mcp",
    version: "1.0.0",
  });

  server.registerTool(
    "get_company_context",
    {
      title: "Get Company / Project Context",
      description:
        "Retrieve company overview, metadata, and all saved backend contexts (website, linkedin, x_handle, telegram, notes) plus latest scraped summaries for a project.",
      inputSchema: {
        projectId: z
          .string()
          .optional()
          .describe("Project ID (auto-filled inside an active project chat)"),
        contextType: z
          .enum(["all", "website", "x_handle", "linkedin", "telegram", "message"])
          .optional()
          .describe("Optional context type filter (defaults to all)"),
        includeInactive: z
          .boolean()
          .optional()
          .describe("Include muted/inactive contexts (defaults to true)"),
      },
    },
    async ({ projectId, contextType = "all", includeInactive = true }) => {
      try {
        const pid = requireProjectId(projectId);
        const project = await findFullProjectOrThrow(deps.prisma, pid);
        const filtered = project.contexts.filter((c) => {
          if (!includeInactive && !c.isActive) return false;
          if (contextType !== "all" && c.type !== contextType) return false;
          return true;
        });

        return jsonToolResponse({
          project: {
            id: project.id,
            name: project.name,
            ticker: project.ticker,
            chain: project.chain,
            stage: project.stage,
            businessStatus: project.businessStatus,
            tagline: project.tagline,
            campaignBudget: project.campaignBudget,
            sentimentScore: project.sentimentScore,
            tags: project.tags ?? [],
            platformRanks: project.platformRanks ?? null,
          },
          contextCount: filtered.length,
          contexts: filtered.map(summarizeContextItem),
        });
      } catch (error) {
        return jsonToolResponse(
          { error: error instanceof Error ? error.message : String(error) },
          true
        );
      }
    }
  );

  server.registerTool(
    "get_context_by_tag",
    {
      title: "Resolve Context By @Tag",
      description:
        "Resolve a @tag such as linkedin, x, twitter, telegram, website, notes, context, scraped, checklist, or a context title slug from the backend for a project.",
      inputSchema: {
        projectId: z
          .string()
          .optional()
          .describe("Project ID (auto-filled inside an active project chat)"),
        tag: z
          .string()
          .min(1)
          .describe("Tag name without or with leading @ (e.g. 'linkedin', 'x', 'website', 'context')"),
      },
    },
    async ({ projectId, tag }) => {
      try {
        const pid = requireProjectId(projectId);
        const cleanTag = tag.trim().replace(/^@/, "").toLowerCase();
        const project = await findFullProjectOrThrow(deps.prisma, pid);

        if (cleanTag === "context" || cleanTag === "company") {
          return jsonToolResponse({
            tag: `@${cleanTag}`,
            resolvedType: "company_context",
            project: {
              id: project.id,
              name: project.name,
              ticker: project.ticker,
              chain: project.chain,
              stage: project.stage,
              businessStatus: project.businessStatus,
              tagline: project.tagline,
              campaignBudget: project.campaignBudget,
              sentimentScore: project.sentimentScore,
              tags: project.tags ?? [],
            },
            contexts: project.contexts.map(summarizeContextItem),
          });
        }

        const mappedType = mapTagToContextType(cleanTag);
        const matches = mappedType
          ? project.contexts.filter((c) => c.type === mappedType)
          : project.contexts.filter(
              (c) =>
                c.id.toLowerCase() === cleanTag ||
                slugifyContextTag(c.title) === cleanTag ||
                c.title.toLowerCase().includes(cleanTag)
            );

        // Fetch any stored scraped pages for matched contexts
        let scrapedPagesPreview: Array<Record<string, unknown>> = [];
        if (matches.length > 0) {
          const scraped = await deps.scraperService.getProjectScrapedData(pid);
          const matchIds = new Set(matches.map((m) => m.id));
          scrapedPagesPreview = scraped.pages
            .filter((p) => matchIds.has(p.contextId))
            .slice(0, 6)
            .map((p) => ({
              contextId: p.contextId,
              url: p.url,
              title: p.title,
              description: p.description,
              signals: p.signals,
              contacts: p.contacts,
              socialLinks: p.socialLinks,
              textPreview: p.textContent?.slice(0, 2000) ?? null,
              platformData: p.platformData ?? null,
            }));
        }

        return jsonToolResponse({
          tag: `@${cleanTag}`,
          projectName: project.name,
          mappedContextType: mappedType,
          matchedCount: matches.length,
          contexts: matches.map(summarizeContextItem),
          scrapedPages: scrapedPagesPreview,
          hint:
            matches.length === 0
              ? `No saved context matched @${cleanTag} for ${project.name}. You can ask the user for a URL and use scrape_url, or check get_company_context.`
              : matches.some((m) => !m.lastScrapedAt && m.type !== "message")
                ? "Some matched links have not been scraped yet; call scrape_context_link to fetch live content via the Python scraper."
                : undefined,
        });
      } catch (error) {
        return jsonToolResponse(
          { error: error instanceof Error ? error.message : String(error) },
          true
        );
      }
    }
  );

  server.registerTool(
    "get_scraped_data",
    {
      title: "Get Stored Scraped Intelligence",
      description:
        "Retrieve relational scrape jobs and crawled pages (text content, headings, links, contacts, signals, platformData) already stored in PostgreSQL for a project.",
      inputSchema: {
        projectId: z
          .string()
          .optional()
          .describe("Project ID (auto-filled inside an active project chat)"),
        contextId: z
          .string()
          .optional()
          .describe("Optional specific context ID to filter scraped pages"),
        contextType: z
          .enum(["website", "x_handle", "linkedin", "telegram", "message"])
          .optional()
          .describe("Optional context type filter (e.g. 'linkedin' or 'website')"),
        maxPages: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe("Maximum number of pages to return (default 8)"),
      },
    },
    async ({ projectId, contextId, contextType, maxPages = 8 }) => {
      try {
        const pid = requireProjectId(projectId);
        const project = await findFullProjectOrThrow(deps.prisma, pid);
        const data = await deps.scraperService.getProjectScrapedData(pid, {
          contextId: contextId?.trim() || undefined,
        });

        let allowedContextIds: Set<string> | null = null;
        if (contextType) {
          allowedContextIds = new Set(
            project.contexts
              .filter((c) => c.type === contextType)
              .map((c) => c.id)
          );
        }

        const filteredPages = (
          allowedContextIds
            ? data.pages.filter((p) => allowedContextIds.has(p.contextId))
            : data.pages
        ).slice(0, maxPages);

        const filteredJobs = (
          allowedContextIds
            ? data.jobs.filter((j) => j.contextId && allowedContextIds.has(j.contextId))
            : data.jobs
        ).slice(0, 10);

        return jsonToolResponse({
          projectId: data.projectId,
          projectName: data.projectName,
          jobsCount: filteredJobs.length,
          jobs: filteredJobs.map((j) => ({
            id: j.id,
            contextId: j.contextId ?? null,
            targetType: j.targetType,
            targetValue: j.targetValue,
            status: j.status,
            providerUsed: j.providerUsed ?? null,
            requiresApiKey: j.requiresApiKey,
            pagesScraped: j.pagesScraped,
            errorMessage: j.errorMessage ?? null,
            completedAt: j.completedAt ?? null,
          })),
          pagesCount: filteredPages.length,
          pages: filteredPages.map((p) => ({
            id: p.id,
            contextId: p.contextId,
            url: p.url,
            depth: p.depth,
            title: p.title,
            description: p.description,
            signals: p.signals,
            contacts: p.contacts,
            socialLinks: p.socialLinks,
            textContent: p.textContent?.slice(0, 3000) ?? null,
            platformData: p.platformData ?? null,
            scrapedAt: p.scrapedAt,
          })),
        });
      } catch (error) {
        return jsonToolResponse(
          { error: error instanceof Error ? error.message : String(error) },
          true
        );
      }
    }
  );

  server.registerTool(
    "scrape_context_link",
    {
      title: "Scrape Project Context Link",
      description:
        "Invoke the PulseOS Python scraper microservice to live-scrape a project's saved context link (by contextId or contextType such as 'linkedin', 'website', 'x_handle', 'telegram') and persist results to PostgreSQL.",
      inputSchema: {
        projectId: z
          .string()
          .optional()
          .describe("Project ID (auto-filled inside an active project chat)"),
        contextId: z
          .string()
          .optional()
          .describe("Specific contextId to scrape"),
        contextType: z
          .enum(["website", "x_handle", "linkedin", "telegram"])
          .optional()
          .describe("Scrape matching context(s) of this type when contextId is omitted"),
        levels: z
          .number()
          .int()
          .min(1)
          .max(5)
          .optional()
          .describe("Crawl depth levels (default 2)"),
        maxPages: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe("Maximum pages to crawl (default 6)"),
        renderJs: z
          .boolean()
          .optional()
          .describe("Whether to render JavaScript with Playwright (default true)"),
      },
    },
    async ({
      projectId,
      contextId,
      contextType,
      levels = 2,
      maxPages = 6,
      renderJs = true,
    }) => {
      try {
        const pid = requireProjectId(projectId);
        const project = await findFullProjectOrThrow(deps.prisma, pid);
        const scrapeConfig = {
          levels,
          maxPages,
          renderJs,
        };

        let targets = project.contexts.filter((c) => c.type !== "message");
        if (contextId?.trim()) {
          targets = targets.filter((c) => c.id === contextId.trim());
        } else if (contextType) {
          targets = targets.filter((c) => c.type === contextType);
        }

        if (targets.length === 0) {
          return jsonToolResponse(
            {
              error: contextType
                ? `No "${contextType}" context link is saved for ${project.name}.`
                : `No matching scrapeable context found for ${project.name}.`,
              availableContexts: project.contexts.map((c) => ({
                id: c.id,
                type: c.type,
                title: c.title,
                value: c.value,
              })),
            },
            true
          );
        }

        const results = [];
        for (const target of targets.slice(0, 4)) {
          const { job } = await deps.scraperService.scrapeContext(
            pid,
            target.id,
            scrapeConfig
          );
          results.push({
            contextId: target.id,
            title: target.title,
            type: target.type,
            value: target.value,
            status: job.status,
            requiresApiKey: job.requiresApiKey,
            providerUsed: job.providerUsed ?? null,
            errorMessage: job.errorMessage ?? null,
            extractedTitle: job.extractedTitle ?? null,
            extractedDescription: job.extractedDescription ?? null,
            detectedSignals: job.detectedSignals,
            detectedSocials: job.detectedSocials ?? {},
            rawPreview: job.rawPreview?.slice(0, 2000) ?? null,
            pagesScraped: job.pagesScraped,
            pages: (job.pages ?? []).slice(0, 5).map((p) => ({
              url: p.url,
              title: p.title,
              description: p.description,
              signals: p.signals,
              contacts: p.contacts,
              textPreview: p.textContent?.slice(0, 2000) ?? null,
              platformData: p.platformData ?? null,
            })),
          });
        }

        return jsonToolResponse({
          projectId: pid,
          projectName: project.name,
          scrapedCount: results.length,
          results,
        });
      } catch (error) {
        return jsonToolResponse(
          { error: error instanceof Error ? error.message : String(error) },
          true
        );
      }
    }
  );

  server.registerTool(
    "scrape_url",
    {
      title: "Scrape Any Link via Python Scraper",
      description:
        "Scrape any arbitrary website, documentation link, LinkedIn URL, X handle/URL, or Telegram link using the PulseOS Python scraper microservice. Optionally saves the scraped link to the active project contexts.",
      inputSchema: {
        url: z.string().min(1).describe("Target URL or social handle to scrape"),
        targetType: z
          .enum(["website", "x_handle", "linkedin", "telegram"])
          .optional()
          .describe("Optional explicit type; auto-detected from URL if omitted"),
        projectId: z
          .string()
          .optional()
          .describe("Optional Project ID (auto-filled inside project chat)"),
        saveToContext: z
          .boolean()
          .optional()
          .describe("Whether to persist the link & scraped pages into the project's contexts (default false)"),
        title: z
          .string()
          .optional()
          .describe("Optional display title if saveToContext is true"),
        levels: z
          .number()
          .int()
          .min(1)
          .max(3)
          .optional()
          .describe("Crawl depth levels (default 1)"),
        maxPages: z
          .number()
          .int()
          .min(1)
          .max(15)
          .optional()
          .describe("Maximum pages to crawl (default 5)"),
      },
    },
    async ({
      url,
      targetType,
      projectId,
      saveToContext = false,
      title,
      levels = 1,
      maxPages = 5,
    }) => {
      try {
        const res = await deps.scraperService.scrapeAdHocUrl({
          url,
          targetType: targetType as ContextType | undefined,
          projectId: projectId?.trim() || undefined,
          saveToContext,
          title,
          config: { levels, maxPages },
        });

        const o = res.outcome;
        return jsonToolResponse({
          savedContextId: res.savedContextId ?? null,
          targetType: o.targetType,
          targetValue: o.targetValue,
          normalizedUrl: o.normalizedUrl ?? null,
          status: o.status,
          reachable: o.reachable,
          httpStatus: o.httpStatus ?? null,
          title: o.title ?? null,
          description: o.description ?? null,
          summary: o.summary ?? null,
          signals: o.signals,
          contacts: o.contacts,
          socialLinks: o.socialLinks,
          requiresApiKey: o.requiresApiKey,
          apiKeyConfigured: o.apiKeyConfigured,
          errorReason: o.errorReason ?? null,
          providerUsed: o.providerUsed ?? null,
          rawPreview: o.rawPreview?.slice(0, 2000) ?? null,
          platformData: o.platformData ?? null,
          pagesScraped: o.pagesScraped,
          pages: o.pages.slice(0, 5).map((p) => ({
            url: p.url,
            depth: p.depth,
            title: p.title ?? null,
            description: p.description ?? null,
            signals: p.signals,
            contacts: p.contacts,
            textContent: p.textContent?.slice(0, 2500) ?? null,
          })),
        });
      } catch (error) {
        return jsonToolResponse(
          { error: error instanceof Error ? error.message : String(error) },
          true
        );
      }
    }
  );

  server.registerTool(
    "list_project_checklist",
    {
      title: "List Project Checklist",
      description:
        "Retrieve global feature checklist items and their checked/scanned state for a project.",
      inputSchema: {
        projectId: z
          .string()
          .optional()
          .describe("Project ID (auto-filled inside an active project chat)"),
      },
    },
    async ({ projectId }) => {
      try {
        const pid = requireProjectId(projectId);
        const [project, items] = await Promise.all([
          findFullProjectOrThrow(deps.prisma, pid),
          deps.prisma.db.orm.public.ChecklistItem.orderBy([
            (i) => i.sortOrder.asc(),
            (i) => i.createdAt.asc(),
          ]).all(),
        ]);

        return jsonToolResponse({
          projectId: project.id,
          projectName: project.name,
          items: items.map((item) => {
            const state = project.checklistState?.[item.id];
            return {
              id: item.id,
              label: item.label,
              category: item.category,
              scanPrompt: item.scanPrompt,
              checked: state?.checked ?? false,
              scanResultNote: state?.scanResultNote ?? null,
              scannedAt: state?.scannedAt ?? null,
            };
          }),
        });
      } catch (error) {
        return jsonToolResponse(
          { error: error instanceof Error ? error.message : String(error) },
          true
        );
      }
    }
  );

  server.registerTool(
    "search_projects",
    {
      title: "Search Workspace Projects",
      description:
        "Search crypto projects in the PulseOS workspace by name, ticker, chain, or business status.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe("Optional search keyword (name, ticker, chain, tag)"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(25)
          .optional()
          .describe("Maximum number of projects to return (default 10)"),
      },
    },
    async ({ query, limit = 10 }) => {
      try {
        const rows = await deps.prisma.db.orm.public.Project.orderBy((p) =>
          p.updatedAt.desc()
        ).all();
        rows.sort((a, b) => Number(b.isPinned) - Number(a.isPinned));
        const q = query?.trim().toLowerCase() ?? "";
        const filtered = (
          q
            ? rows.filter((p) =>
                [p.name, p.ticker, p.chain, p.businessStatus, p.tagline, ...p.tags]
                  .join(" ")
                  .toLowerCase()
                  .includes(q)
              )
            : rows
        ).slice(0, limit);

        return jsonToolResponse({
          total: filtered.length,
          projects: filtered.map((p) => ({
            id: p.id,
            name: p.name,
            ticker: p.ticker,
            chain: p.chain,
            stage: p.stage,
            businessStatus: p.businessStatus,
            tagline: p.tagline,
          })),
        });
      } catch (error) {
        return jsonToolResponse(
          { error: error instanceof Error ? error.message : String(error) },
          true
        );
      }
    }
  );

  server.registerTool(
    "get_agency_profile",
    {
      title: "Get Our Agency / About Us Profile",
      description:
        "Retrieve our agency's company details, services, office address, contact info, and representative name/title/contact saved in the About Us dashboard tab.",
      inputSchema: {},
    },
    async () => {
      try {
        const table = deps.prisma.db.orm.public.AgencyProfile;
        const row = table
          ? await table.where({ id: DEFAULT_AGENCY_PROFILE_ID }).first()
          : null;
        return jsonToolResponse(mapAgencyProfileRowToDomain(row));
      } catch (error) {
        return jsonToolResponse(
          { error: error instanceof Error ? error.message : String(error) },
          true
        );
      }
    }
  );

  server.registerResource(
    "company-context",
    new ResourceTemplate("pulseos://projects/{projectId}/context", {
      list: undefined,
    }),
    {
      title: "Company Project Context",
      description: "Full company/project profile and active backend contexts",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const pid = String(variables["projectId"] ?? "").trim();
      const project = await findFullProjectOrThrow(deps.prisma, pid);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                project: {
                  id: project.id,
                  name: project.name,
                  ticker: project.ticker,
                  chain: project.chain,
                  stage: project.stage,
                  businessStatus: project.businessStatus,
                  tagline: project.tagline,
                },
                contexts: project.contexts.map(summarizeContextItem),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  return server;
}
