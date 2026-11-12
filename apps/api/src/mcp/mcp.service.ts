import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type {
  CallMcpToolDto,
  ChatMentionSuggestion,
  CreateMcpServerDto,
  McpOverview,
  McpServerStatus,
  McpToolSummary,
  McpTransport,
  UpdateMcpServerDto,
} from "@repo/shared";
import { randomUUID } from "crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthenticatedUser } from "../auth/auth.decorators.js";
import type { AppEnv } from "../config/env.js";
import { LeadsService } from "../leads/leads.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { findFullProjectOrThrow } from "../projects/project.mapper.js";
import {
  decryptProviderSecret,
  encryptProviderSecret,
  maskProviderSecret,
} from "../scraper/scraper-crypto.helper.js";
import { ScraperService } from "../scraper/scraper.service.js";
import {
  buildProjectMentionSuggestions,
  mapTagToContextType,
  parseMentionTags,
  slugifyContextTag,
} from "./mcp-mentions.helper.js";
import { createPulseOsMcpServer } from "./pulseos-mcp-server.factory.js";

export const BUILTIN_MCP_SERVER_ID = "pulseos-builtin";
export const BUILTIN_MCP_SERVER_NAME = "PulseOS Workspace MCP";

const BUILTIN_PROJECT_SCOPED_TOOLS = new Set([
  "get_company_context",
  "get_context_by_tag",
  "get_scraped_data",
  "scrape_context_link",
  "scrape_url",
  "list_project_checklist",
  "fetch_project_leads",
]);

interface ConnectedExternalClient {
  client: Client;
  tools: McpToolSummary[];
}

export interface McpToolExecutionResult {
  toolName: string;
  serverId: string;
  text: string;
  isError: boolean;
  contextIdsUsed: string[];
}

export interface ResolvedMentionContext {
  resolvedTags: string[];
  contextBlock: string;
  usedContextIds: string[];
}

@Injectable()
export class McpService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(McpService.name);

  private builtInServer: McpServer | null = null;
  private builtInClient: Client | null = null;
  private builtInTools: McpToolSummary[] = [];
  private initPromise: Promise<void> | null = null;

  private readonly externalClients = new Map<string, ConnectedExternalClient>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly scraperService: ScraperService,
    private readonly config: ConfigService<AppEnv, true>,
    @Optional() private readonly leadsService?: LeadsService
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureInitialized();
  }

  async onModuleDestroy(): Promise<void> {
    for (const entry of this.externalClients.values()) {
      await entry.client.close().catch(() => undefined);
    }
    this.externalClients.clear();
    if (this.builtInClient) {
      await this.builtInClient.close().catch(() => undefined);
      this.builtInClient = null;
    }
    if (this.builtInServer) {
      await this.builtInServer.close().catch(() => undefined);
      this.builtInServer = null;
    }
  }

  private getEncryptionMaterial(): string {
    return this.config.get("JWT_SECRET", { infer: true });
  }

  private decryptAuthHeader(encoded: string | null | undefined): string {
    if (!encoded) return "";
    try {
      return decryptProviderSecret(encoded, this.getEncryptionMaterial()).trim();
    } catch {
      return "";
    }
  }

  async ensureInitialized(): Promise<void> {
    if (this.builtInClient && this.builtInTools.length > 0) {
      return;
    }
    if (!this.initPromise) {
      this.initPromise = this.initializeAll().finally(() => {
        this.initPromise = null;
      });
    }
    await this.initPromise;
  }

  private async initializeAll(): Promise<void> {
    await this.initBuiltInMcp();
    await this.syncEnabledExternalServers();
  }

  private async initBuiltInMcp(): Promise<void> {
    if (this.builtInClient) {
      await this.builtInClient.close().catch(() => undefined);
    }
    if (this.builtInServer) {
      await this.builtInServer.close().catch(() => undefined);
    }

    const server = createPulseOsMcpServer({
      prisma: this.prisma,
      scraperService: this.scraperService,
      leadsService: this.leadsService,
    });
    const client = new Client({
      name: "pulseos-chatbot-host",
      version: "1.0.0",
    });

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const listed = await client.listTools();
    this.builtInServer = server;
    this.builtInClient = client;
    this.builtInTools = listed.tools.map((t) => ({
      name: t.name,
      qualifiedName: t.name,
      description: t.description ?? "",
      inputSchema: (t.inputSchema ?? { type: "object", properties: {} }) as Record<
        string,
        unknown
      >,
      serverId: BUILTIN_MCP_SERVER_ID,
      serverName: BUILTIN_MCP_SERVER_NAME,
    }));

    this.logger.log(
      `Built-in PulseOS MCP Server initialized with ${this.builtInTools.length} tools: ${this.builtInTools
        .map((t) => t.name)
        .join(", ")}`
    );
  }

  private async syncEnabledExternalServers(): Promise<void> {
    try {
      const mcpTable = this.prisma.db.orm.public.McpServerConfig;
      if (!mcpTable) return;
      const rows = await mcpTable.all();
      for (const row of rows) {
        if (!row.isEnabled || row.isBuiltIn || !row.url) continue;
        await this.connectExternalServerRow(row).catch((err) => {
          this.logger.warn(
            `External MCP server "${row.name}" failed initial connect: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        });
      }
    } catch {
      // Safe fallback in unit tests or environments where mcp_servers table is mocked/absent
    }
  }

  private buildExternalQualifiedName(serverId: string, toolName: string): string {
    const cleanServer = serverId.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 24);
    const cleanTool = toolName.replace(/[^a-zA-Z0-9_-]/g, "_");
    return `${cleanServer}__${cleanTool}`;
  }

  private async connectExternalServerRow(row: {
    id: string;
    name: string;
    transport: string;
    url: string | null;
    authHeader: string | null;
  }): Promise<McpToolSummary[]> {
    if (!row.url) {
      throw new BadRequestException("External MCP server URL is missing.");
    }

    const existing = this.externalClients.get(row.id);
    if (existing) {
      await existing.client.close().catch(() => undefined);
      this.externalClients.delete(row.id);
    }

    const authHeader = this.decryptAuthHeader(row.authHeader);
    const headers: Record<string, string> = {};
    if (authHeader) {
      headers["Authorization"] = authHeader.includes(" ")
        ? authHeader
        : `Bearer ${authHeader}`;
    }

    const endpoint = new URL(row.url);
    const client = new Client({
      name: "pulseos-mcp-client",
      version: "1.0.0",
    });

    const transport =
      row.transport === "sse"
        ? new SSEClientTransport(endpoint, {
            requestInit: Object.keys(headers).length ? { headers } : undefined,
          })
        : new StreamableHTTPClientTransport(endpoint, {
            requestInit: Object.keys(headers).length ? { headers } : undefined,
          });

    try {
      await client.connect(transport);
      const listed = await client.listTools();
      const tools: McpToolSummary[] = listed.tools.map((t) => ({
        name: t.name,
        qualifiedName: this.buildExternalQualifiedName(row.id, t.name),
        description: t.description ?? "",
        inputSchema: (t.inputSchema ?? {
          type: "object",
          properties: {},
        }) as Record<string, unknown>,
        serverId: row.id,
        serverName: row.name,
      }));

      this.externalClients.set(row.id, { client, tools });

      await this.prisma.db.orm.public.McpServerConfig?.where({
        id: row.id,
      }).update({
        cachedTools: tools as never,
        lastStatus: "connected",
        lastError: null,
        lastSyncAt: new Date(),
      });

      return tools;
    } catch (error) {
      await client.close().catch(() => undefined);
      const errMsg = error instanceof Error ? error.message : String(error);
      await this.prisma.db.orm.public.McpServerConfig?.where({
        id: row.id,
      })
        .update({
          lastStatus: "error",
          lastError: errMsg,
          lastSyncAt: new Date(),
        })
        .catch(() => undefined);
      throw error;
    }
  }

  async listServers(): Promise<McpOverview> {
    await this.ensureInitialized();

    const builtInStatus: McpServerStatus = {
      id: BUILTIN_MCP_SERVER_ID,
      name: BUILTIN_MCP_SERVER_NAME,
      description:
        "Built-in PulseOS MCP Server exposing backend company contexts, @tag resolution, PostgreSQL scraped intelligence, and the Python scraper microservice.",
      transport: "builtin",
      url: "/api/v1/mcp",
      hasAuthHeader: false,
      maskedAuthHeader: null,
      isBuiltIn: true,
      isEnabled: true,
      status: this.builtInClient ? "connected" : "disconnected",
      lastError: null,
      lastSyncAt: new Date().toISOString(),
      tools: this.builtInTools,
    };

    const externalStatuses: McpServerStatus[] = [];
    try {
      const rows = await this.prisma.db.orm.public.McpServerConfig.orderBy((s) =>
        s.createdAt.asc()
      ).all();

      for (const row of rows) {
        if (row.isBuiltIn) continue;
        const connected = this.externalClients.get(row.id);
        const cachedTools = Array.isArray(row.cachedTools)
          ? (row.cachedTools as McpToolSummary[])
          : [];
        const tools = connected ? connected.tools : cachedTools;
        const decryptedAuth = this.decryptAuthHeader(row.authHeader);
        const transport: McpTransport =
          row.transport === "sse" ? "sse" : "streamable_http";

        externalStatuses.push({
          id: row.id,
          name: row.name,
          description: row.description,
          transport,
          url: row.url,
          hasAuthHeader: Boolean(decryptedAuth),
          maskedAuthHeader: decryptedAuth
            ? maskProviderSecret(decryptedAuth)
            : null,
          isBuiltIn: false,
          isEnabled: row.isEnabled,
          status: !row.isEnabled
            ? "disabled"
            : connected
              ? "connected"
              : row.lastStatus === "error"
                ? "error"
                : "disconnected",
          lastError: row.lastError,
          lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
          tools,
        });
      }
    } catch {
      // Ignore if external table isn't available in lightweight unit test mocks
    }

    const servers = [builtInStatus, ...externalStatuses];
    const totalTools = servers
      .filter((s) => s.isEnabled)
      .reduce((acc, s) => acc + s.tools.length, 0);

    return { servers, totalTools };
  }

  async getAvailableTools(): Promise<McpToolSummary[]> {
    await this.ensureInitialized();
    const externalTools: McpToolSummary[] = [];
    for (const entry of this.externalClients.values()) {
      externalTools.push(...entry.tools);
    }
    return [...this.builtInTools, ...externalTools];
  }

  async callTool(
    toolName: string,
    rawArgs: Record<string, unknown> = {},
    runtime?: { projectId?: string }
  ): Promise<McpToolExecutionResult> {
    await this.ensureInitialized();

    const args: Record<string, unknown> = { ...rawArgs };
    const builtInMatch = this.builtInTools.find(
      (t) => t.name === toolName || t.qualifiedName === toolName
    );

    if (builtInMatch && this.builtInClient) {
      if (
        BUILTIN_PROJECT_SCOPED_TOOLS.has(builtInMatch.name) &&
        runtime?.projectId &&
        !args["projectId"]
      ) {
        args["projectId"] = runtime.projectId;
      }

      const result = await this.builtInClient.callTool({
        name: builtInMatch.name,
        arguments: args,
      });

      const text = this.extractTextFromMcpResult(result.content);
      return {
        toolName: builtInMatch.name,
        serverId: BUILTIN_MCP_SERVER_ID,
        text,
        isError: Boolean(result.isError),
        contextIdsUsed: this.extractContextIdsFromToolOutput(text),
      };
    }

    for (const [serverId, entry] of this.externalClients.entries()) {
      const extMatch = entry.tools.find(
        (t) => t.qualifiedName === toolName || t.name === toolName
      );
      if (extMatch) {
        const result = await entry.client.callTool({
          name: extMatch.name,
          arguments: args,
        });
        const text = this.extractTextFromMcpResult(result.content);
        return {
          toolName: extMatch.qualifiedName,
          serverId,
          text,
          isError: Boolean(result.isError),
          contextIdsUsed: [],
        };
      }
    }

    return {
      toolName,
      serverId: "unknown",
      text: JSON.stringify({
        error: `MCP tool "${toolName}" is not registered or its server is disconnected.`,
      }),
      isError: true,
      contextIdsUsed: [],
    };
  }

  private extractTextFromMcpResult(content: unknown): string {
    if (!Array.isArray(content)) {
      return typeof content === "string" ? content : JSON.stringify(content ?? "");
    }
    const parts = content
      .map((item) => {
        if (
          item &&
          typeof item === "object" &&
          "text" in item &&
          typeof (item as { text: unknown }).text === "string"
        ) {
          return (item as { text: string }).text;
        }
        return JSON.stringify(item);
      })
      .filter(Boolean);
    return parts.join("\n");
  }

  private extractContextIdsFromToolOutput(text: string): string[] {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const ids = new Set<string>();
      const collect = (arr: unknown) => {
        if (!Array.isArray(arr)) return;
        for (const item of arr) {
          if (
            item &&
            typeof item === "object" &&
            "id" in item &&
            typeof (item as { id: unknown }).id === "string"
          ) {
            ids.add((item as { id: string }).id);
          } else if (
            item &&
            typeof item === "object" &&
            "contextId" in item &&
            typeof (item as { contextId: unknown }).contextId === "string"
          ) {
            ids.add((item as { contextId: string }).contextId);
          }
        }
      };
      collect(parsed["contexts"]);
      collect(parsed["results"]);
      if (typeof parsed["savedContextId"] === "string") {
        ids.add(parsed["savedContextId"]);
      }
      return Array.from(ids);
    } catch {
      return [];
    }
  }

  async resolveMentionContext(
    projectId: string,
    userMessage: string
  ): Promise<ResolvedMentionContext> {
    const tags = parseMentionTags(userMessage);
    if (tags.length === 0) {
      return { resolvedTags: [], contextBlock: "", usedContextIds: [] };
    }

    await this.ensureInitialized();

    let project;
    try {
      project = await findFullProjectOrThrow(this.prisma, projectId);
    } catch {
      return { resolvedTags: [], contextBlock: "", usedContextIds: [] };
    }

    const sections: string[] = [];
    const resolvedTags: string[] = [];
    const usedContextIds = new Set<string>();
    const contextSlugMap = new Map<string, string>();
    for (const ctx of project.contexts) {
      const slug = slugifyContextTag(ctx.title);
      if (slug) contextSlugMap.set(slug, ctx.id);
    }

    for (const tag of tags) {
      if (tag === "context" || tag === "company") {
        const res = await this.callTool(
          "get_company_context",
          { projectId },
          { projectId }
        );
        res.contextIdsUsed.forEach((id) => usedContextIds.add(id));
        resolvedTags.push(`@${tag}`);
        sections.push(`[MCP Backend Resolution for @${tag}]\n${res.text}`);
        continue;
      }

      if (tag === "scraped" || tag === "scraped-data") {
        const res = await this.callTool(
          "get_scraped_data",
          { projectId, maxPages: 8 },
          { projectId }
        );
        res.contextIdsUsed.forEach((id) => usedContextIds.add(id));
        resolvedTags.push(`@${tag}`);
        sections.push(`[MCP Backend Resolution for @${tag}]\n${res.text}`);
        continue;
      }

      if (tag === "checklist") {
        const res = await this.callTool(
          "list_project_checklist",
          { projectId },
          { projectId }
        );
        resolvedTags.push(`@${tag}`);
        sections.push(`[MCP Backend Resolution for @${tag}]\n${res.text}`);
        continue;
      }

      if (tag === "about-us" || tag === "agency") {
        const res = await this.callTool("get_agency_profile", {}, { projectId });
        resolvedTags.push(`@${tag}`);
        sections.push(`[MCP Backend Resolution for @${tag}]\n${res.text}`);
        continue;
      }

      if (tag === "scrape") {
        resolvedTags.push("@scrape");
        sections.push(
          `[MCP Directive for @scrape]\nThe user explicitly requested link scraping. Use MCP tools ("scrape_context_link" or "scrape_url") to scrape the referenced links via the PulseOS Python Scraper before answering.`
        );
        continue;
      }

      const mappedType = mapTagToContextType(tag);
      const slugContextId = contextSlugMap.get(tag);
      if (mappedType || slugContextId) {
        if (mappedType === "lead") {
          const existingLeads = project.contexts.filter(
            (c) => c.type === "lead"
          );
          if (existingLeads.length === 0 && this.leadsService) {
            const fetched = await this.callTool(
              "fetch_project_leads",
              { projectId, provider: "auto" },
              { projectId }
            );
            fetched.contextIdsUsed.forEach((id) => usedContextIds.add(id));
            resolvedTags.push(`@${tag}`);
            sections.push(
              `[MCP Auto-Fetched Leads for @${tag}]\n${fetched.text}`
            );
            continue;
          }
        }
        const res = await this.callTool(
          "get_context_by_tag",
          { projectId, tag },
          { projectId }
        );
        res.contextIdsUsed.forEach((id) => usedContextIds.add(id));
        resolvedTags.push(`@${tag}`);
        sections.push(`[MCP Backend Resolution for @${tag}]\n${res.text}`);
      }
    }

    return {
      resolvedTags,
      contextBlock: sections.join("\n\n"),
      usedContextIds: Array.from(usedContextIds),
    };
  }

  async getChatMentionSuggestions(
    projectId: string
  ): Promise<ChatMentionSuggestion[]> {
    await this.ensureInitialized();
    const [project, tools] = await Promise.all([
      findFullProjectOrThrow(this.prisma, projectId),
      this.getAvailableTools(),
    ]);
    return buildProjectMentionSuggestions(project, tools);
  }

  async createExternalServer(
    dto: CreateMcpServerDto,
    actor?: AuthenticatedUser
  ): Promise<McpOverview> {
    const id = `mcp-${Date.now()}-${randomUUID().slice(0, 6)}`;
    const encryptedAuth = dto.authHeader?.trim()
      ? encryptProviderSecret(dto.authHeader.trim(), this.getEncryptionMaterial())
      : null;

    const created = await this.prisma.db.orm.public.McpServerConfig.create({
      id,
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      transport: dto.transport,
      url: dto.url.trim(),
      authHeader: encryptedAuth,
      isBuiltIn: false,
      isEnabled: dto.isEnabled,
      lastStatus: dto.isEnabled ? "disconnected" : "disabled",
      updatedBy: actor?.email ?? null,
    });

    if (actor) {
      await this.prisma.db.orm.public.AuditLog.create({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "MCP_SERVER_ADDED",
        resource: "mcp_servers",
        resourceId: id,
        details: { name: created.name, url: created.url, transport: created.transport },
      });
    }

    if (created.isEnabled) {
      await this.connectExternalServerRow(created).catch((err) => {
        this.logger.warn(
          `Created external MCP server "${created.name}", initial discovery failed: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      });
    }

    return this.listServers();
  }

  async updateExternalServer(
    serverId: string,
    dto: UpdateMcpServerDto,
    actor?: AuthenticatedUser
  ): Promise<McpOverview> {
    if (serverId === BUILTIN_MCP_SERVER_ID) {
      throw new BadRequestException(
        "The built-in PulseOS MCP Server cannot be modified or disabled."
      );
    }

    const existing = await this.prisma.db.orm.public.McpServerConfig.where({
      id: serverId,
    }).first();
    if (!existing) {
      throw new NotFoundException(`MCP server "${serverId}" not found.`);
    }

    const encryptedAuth =
      dto.authHeader === null
        ? null
        : dto.authHeader?.trim()
          ? encryptProviderSecret(
              dto.authHeader.trim(),
              this.getEncryptionMaterial()
            )
          : undefined;

    const updated = await this.prisma.db.orm.public.McpServerConfig.where({
      id: serverId,
    }).update({
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description?.trim() || null }
        : {}),
      ...(dto.transport !== undefined ? { transport: dto.transport } : {}),
      ...(dto.url !== undefined ? { url: dto.url.trim() } : {}),
      ...(encryptedAuth !== undefined ? { authHeader: encryptedAuth } : {}),
      ...(dto.isEnabled !== undefined ? { isEnabled: dto.isEnabled } : {}),
      updatedBy: actor?.email ?? null,
    });

    if (!updated) {
      throw new NotFoundException(`MCP server "${serverId}" not found.`);
    }

    if (!updated.isEnabled) {
      const clientEntry = this.externalClients.get(serverId);
      if (clientEntry) {
        await clientEntry.client.close().catch(() => undefined);
        this.externalClients.delete(serverId);
      }
      await this.prisma.db.orm.public.McpServerConfig.where({
        id: serverId,
      }).update({ lastStatus: "disabled" });
    } else {
      await this.connectExternalServerRow(updated).catch(() => undefined);
    }

    return this.listServers();
  }

  async refreshServer(serverId: string): Promise<McpOverview> {
    if (serverId === BUILTIN_MCP_SERVER_ID) {
      await this.initBuiltInMcp();
      return this.listServers();
    }

    const existing = await this.prisma.db.orm.public.McpServerConfig.where({
      id: serverId,
    }).first();
    if (!existing) {
      throw new NotFoundException(`MCP server "${serverId}" not found.`);
    }

    if (existing.isEnabled) {
      await this.connectExternalServerRow(existing);
    }
    return this.listServers();
  }

  async deleteExternalServer(
    serverId: string,
    actor?: AuthenticatedUser
  ): Promise<McpOverview> {
    if (serverId === BUILTIN_MCP_SERVER_ID) {
      throw new BadRequestException(
        "The built-in PulseOS MCP Server cannot be deleted."
      );
    }

    const clientEntry = this.externalClients.get(serverId);
    if (clientEntry) {
      await clientEntry.client.close().catch(() => undefined);
      this.externalClients.delete(serverId);
    }

    const deleted = await this.prisma.db.orm.public.McpServerConfig.where({
      id: serverId,
    }).delete();

    if (!deleted) {
      throw new NotFoundException(`MCP server "${serverId}" not found.`);
    }

    if (actor) {
      await this.prisma.db.orm.public.AuditLog.create({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "MCP_SERVER_DELETED",
        resource: "mcp_servers",
        resourceId: serverId,
        details: { name: deleted.name },
      });
    }

    return this.listServers();
  }

  async invokeToolDirect(dto: CallMcpToolDto): Promise<McpToolExecutionResult> {
    return this.callTool(dto.toolName, dto.arguments, {
      projectId: dto.projectId,
    });
  }

  async handleStreamableHttpRequest(
    req: IncomingMessage,
    res: ServerResponse,
    parsedBody?: unknown
  ): Promise<void> {
    const server = createPulseOsMcpServer({
      prisma: this.prisma,
      scraperService: this.scraperService,
      leadsService: this.leadsService,
    });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      void transport.close().catch(() => undefined);
      void server.close().catch(() => undefined);
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, parsedBody);
  }
}
