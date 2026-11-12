import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  Optional,
  PreconditionFailedException,
} from "@nestjs/common";
import {
  AI_PROVIDER_META,
  formatCurrentTimestamp,
  type AiProvider,
  type CryptoProject,
  type McpToolSummary,
  type ProjectContextItem,
  type PromptTemplate,
  type SendMessageDto,
} from "@repo/shared";
import { randomUUID } from "crypto";
import { McpService } from "../mcp/mcp.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { computeActivatedProjectPatch } from "../projects/project-lifecycle.helper.js";
import { findFullProjectOrThrow } from "../projects/project.mapper.js";
import { AiProvidersService } from "../settings/ai-providers.service.js";
import {
  buildMcpSystemPromptSection,
  isToolUnsupportedError,
  safeParseToolArguments,
  toAnthropicToolDefinition,
  toGeminiFunctionDeclaration,
  toOpenAiToolDefinition,
} from "./mcp-tool-adapter.helper.js";

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

interface ProviderCompletionResult {
  text: string;
  toolsUsed: string[];
  contextIdsUsed: string[];
}

const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful AI assistant. Read the conversation history and the user's messages carefully, follow their instructions accurately, and respond clearly in Markdown when appropriate.";

const MAX_SESSION_HISTORY_MESSAGES = 50;
const MAX_TOOL_CALL_ITERATIONS = 6;
const AI_REQUEST_TIMEOUT_MS = 90_000;

export function normalizeConversationTurns(
  turns: ConversationTurn[]
): ConversationTurn[] {
  const normalized: ConversationTurn[] = [];
  for (const turn of turns) {
    const content = turn.content.trim();
    if (!content) continue;
    if (normalized.length === 0 && turn.role === "assistant") {
      // Providers like Google Gemini require conversation contents to begin with a user turn.
      continue;
    }
    const prev = normalized[normalized.length - 1];
    if (prev && prev.role === turn.role) {
      prev.content = `${prev.content}\n\n${content}`;
    } else {
      normalized.push({ role: turn.role, content });
    }
  }
  return normalized;
}

function formatExplicitlyProvidedContext(
  project: CryptoProject,
  selectedContexts: ProjectContextItem[],
  includeProjectSummary: boolean
): string {
  const blocks: string[] = [];

  if (includeProjectSummary) {
    blocks.push(
      [
        "[Attached Project Summary]",
        `Name: ${project.name} (${project.ticker})`,
        `Chain: ${project.chain}`,
        `Stage: ${project.stage}`,
        `Status: ${project.businessStatus}`,
        project.tagline ? `Tagline: ${project.tagline}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  if (selectedContexts.length > 0) {
    const ctxLines = selectedContexts.map((c) => {
      const parts = [
        `- [${c.type}] ${c.title}: ${c.value}`,
        c.summary ? `Summary: ${c.summary}` : "",
        c.scrapedMetadata?.title ? `Page Title: ${c.scrapedMetadata.title}` : "",
        c.scrapedMetadata?.description
          ? `Description: ${c.scrapedMetadata.description}`
          : "",
        c.scrapedMetadata?.signals?.length
          ? `Signals: ${c.scrapedMetadata.signals.join(", ")}`
          : "",
        c.scrapedMetadata?.rawPreview
          ? `Content Preview: ${c.scrapedMetadata.rawPreview.slice(0, 1200)}`
          : "",
      ].filter(Boolean);
      return parts.join(" | ");
    });
    blocks.push(`[Attached Project Contexts]\n${ctxLines.join("\n")}`);
  }

  return blocks.join("\n\n");
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProvidersService: AiProvidersService,
    @Optional() private readonly mcpService?: McpService
  ) {}

  async sendMessage(
    projectId: string,
    dto: SendMessageDto
  ): Promise<CryptoProject> {
    const project = await findFullProjectOrThrow(this.prisma, projectId);
    const credential = await this.aiProvidersService.resolveActiveCredential();

    if (!credential) {
      throw new PreconditionFailedException({
        statusCode: 412,
        code: "AI_API_KEY_REQUIRED",
        message:
          "No AI provider API key is configured. Please set an API key (e.g., Google AI Studio) in Admin Dashboard → AI Providers.",
      });
    }

    let appliedTemplate: PromptTemplate | undefined = dto.template;
    if (!appliedTemplate && dto.templateId) {
      const dbTpl = await this.prisma.db.orm.public.PromptTemplate.where({
        id: dto.templateId,
      }).first();
      if (dbTpl) {
        appliedTemplate = {
          id: dbTpl.id,
          label: dbTpl.label,
          systemPrompt: dbTpl.systemPrompt,
        };
      }
    }

    // Only include project contexts explicitly requested from the frontend or via @tags
    const requestedContextIds = new Set(dto.contextIds ?? []);
    const selectedContexts =
      requestedContextIds.size > 0
        ? project.contexts.filter((c) => requestedContextIds.has(c.id))
        : [];
    const includeProjectSummary = Boolean(dto.includeProjectSummary);

    // Retain previous session messages in chronological order
    const priorRows = await this.prisma.db.orm.public.ChatMessage.where({
      projectId,
    })
      .orderBy((m) => m.createdAt.asc())
      .all();

    const priorTurns: ConversationTurn[] = priorRows
      .filter((m) => m.model !== "pulseos-engine")
      .slice(-MAX_SESSION_HISTORY_MESSAGES)
      .map((m) => ({
        role: m.sender === "admin" ? "user" : "assistant",
        content: m.content,
      }));

    const userText = dto.content.trim();

    // Resolve @context, @linkedin, @website, @x, @telegram, @notes, @scraped, @checklist via MCP
    const mentionResolution = this.mcpService
      ? await this.mcpService.resolveMentionContext(projectId, userText)
      : { resolvedTags: [], contextBlock: "", usedContextIds: [] };

    // Discover MCP servers & tools in the beginning so the chatbot knows all tools
    const [mcpOverview, mcpTools] = this.mcpService
      ? await Promise.all([
          this.mcpService.listServers(),
          this.mcpService.getAvailableTools(),
        ])
      : [{ servers: [], totalTools: 0 }, [] as McpToolSummary[]];

    const attachedContextText = [
      formatExplicitlyProvidedContext(
        project,
        selectedContexts,
        includeProjectSummary
      ),
      mentionResolution.contextBlock,
    ]
      .filter(Boolean)
      .join("\n\n");

    const currentTurnPrompt = attachedContextText
      ? `${userText}\n\n${attachedContextText}`
      : userText;

    const conversation = normalizeConversationTurns([
      ...priorTurns,
      { role: "user", content: currentTurnPrompt },
    ]);

    const baseSystemPrompt = appliedTemplate?.systemPrompt?.trim()
      ? appliedTemplate.systemPrompt.trim()
      : DEFAULT_SYSTEM_PROMPT;

    const mcpSystemSection = buildMcpSystemPromptSection(
      mcpOverview.servers,
      mcpTools
    );
    const systemPrompt = mcpSystemSection
      ? `${baseSystemPrompt}\n\n${mcpSystemSection}`
      : baseSystemPrompt;

    const completion = await this.callProvider(
      credential.provider,
      credential.apiKey,
      credential.model,
      systemPrompt,
      conversation,
      mcpTools,
      projectId
    );

    const nowMs = Date.now();
    const timestamp = formatCurrentTimestamp();
    const suffix = randomUUID().slice(0, 6);
    const mergedContextIds = Array.from(
      new Set([
        ...selectedContexts.map((c) => c.id),
        ...mentionResolution.usedContextIds,
        ...completion.contextIdsUsed,
      ])
    );
    const uniqueToolsUsed = Array.from(new Set(completion.toolsUsed));

    await this.prisma.db.transaction(async (tx) => {
      await tx.orm.public.ChatMessage.create({
        id: `msg-user-${nowMs}-${suffix}`,
        projectId,
        sender: "admin",
        content: userText,
        timestampLabel: timestamp,
        usedContextIds: mergedContextIds,
        suggestedActions: [],
        metadata:
          mentionResolution.resolvedTags.length > 0
            ? { resolvedTags: mentionResolution.resolvedTags }
            : null,
        createdAt: new Date(nowMs),
      });

      await tx.orm.public.ChatMessage.create({
        id: `msg-ai-${nowMs + 1}-${suffix}`,
        projectId,
        sender: "ai",
        content: completion.text,
        timestampLabel: formatCurrentTimestamp(),
        usedContextIds: mergedContextIds,
        suggestedActions: [],
        appliedSystemPromptTitle: appliedTemplate?.label ?? null,
        model: credential.model,
        metadata: {
          provider: credential.provider,
          attachedContextCount: mergedContextIds.length,
          includedProjectSummary: includeProjectSummary,
          historyLength: priorTurns.length,
          templateId: appliedTemplate?.id ?? null,
          ...(uniqueToolsUsed.length > 0
            ? { mcpToolsUsed: uniqueToolsUsed }
            : {}),
          ...(mentionResolution.resolvedTags.length > 0
            ? { resolvedTags: mentionResolution.resolvedTags }
            : {}),
        },
        createdAt: new Date(nowMs + 5),
      });

      await tx.orm.public.Project.where({ id: projectId }).update(
        computeActivatedProjectPatch(project, "Just now")
      );
    });

    return findFullProjectOrThrow(this.prisma, projectId);
  }

  async resetConversation(projectId: string): Promise<CryptoProject> {
    const project = await findFullProjectOrThrow(this.prisma, projectId);

    await this.prisma.db.transaction(async (tx) => {
      await tx.orm.public.ChatMessage.where({ projectId }).deleteAll();
      await tx.orm.public.Project.where({ id: projectId }).update(
        computeActivatedProjectPatch(project, "Just now")
      );
    });

    return findFullProjectOrThrow(this.prisma, projectId);
  }

  private async executeMcpToolCall(
    toolName: string,
    rawArgs: unknown,
    projectId: string,
    toolsUsed: string[],
    contextIdsUsed: string[]
  ): Promise<{ text: string; isError: boolean }> {
    if (!this.mcpService) {
      return {
        text: JSON.stringify({ error: "MCP service is not available." }),
        isError: true,
      };
    }

    const args = safeParseToolArguments(rawArgs);
    this.logger.log(
      `Executing MCP tool "${toolName}" for project "${projectId}"`
    );
    const result = await this.mcpService.callTool(toolName, args, {
      projectId,
    });
    toolsUsed.push(result.toolName);
    contextIdsUsed.push(...result.contextIdsUsed);
    return { text: result.text, isError: result.isError };
  }

  private async callProvider(
    provider: AiProvider,
    apiKey: string,
    model: string,
    systemPrompt: string,
    turns: ConversationTurn[],
    mcpTools: McpToolSummary[],
    projectId: string
  ): Promise<ProviderCompletionResult> {
    const providerLabel = AI_PROVIDER_META[provider].label;

    try {
      switch (provider) {
        case "google":
          return await this.callGoogleAiStudio(
            apiKey,
            model,
            systemPrompt,
            turns,
            mcpTools,
            projectId
          );
        case "anthropic":
          return await this.callAnthropic(
            apiKey,
            model,
            systemPrompt,
            turns,
            mcpTools,
            projectId
          );
        case "openai":
          return await this.callOpenAiCompatible(
            "https://api.openai.com/v1/chat/completions",
            providerLabel,
            apiKey,
            model,
            systemPrompt,
            turns,
            mcpTools,
            projectId
          );
        case "groq":
          return await this.callOpenAiCompatible(
            "https://api.groq.com/openai/v1/chat/completions",
            providerLabel,
            apiKey,
            model,
            systemPrompt,
            turns,
            mcpTools,
            projectId
          );
        case "openrouter":
          return await this.callOpenAiCompatible(
            "https://openrouter.ai/api/v1/chat/completions",
            providerLabel,
            apiKey,
            model,
            systemPrompt,
            turns,
            mcpTools,
            projectId
          );
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `${providerLabel} (${model}) completion failed: ${message}`
      );
      throw new BadGatewayException(
        `${providerLabel} request failed: ${message}`
      );
    }
  }

  private async callGoogleAiStudio(
    apiKey: string,
    model: string,
    systemPrompt: string,
    turns: ConversationTurn[],
    mcpTools: McpToolSummary[],
    projectId: string
  ): Promise<ProviderCompletionResult> {
    const cleanModel = model.replace(/^models\//, "");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent`;

    const contents: Array<Record<string, unknown>> = turns.map((turn) => ({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.content }],
    }));

    const toolsUsed: string[] = [];
    const contextIdsUsed: string[] = [];
    let allowTools = mcpTools.length > 0 && Boolean(this.mcpService);

    for (let iter = 0; iter <= MAX_TOOL_CALL_ITERATIONS; iter++) {
      const body: Record<string, unknown> = {
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents,
        generationConfig: {
          temperature: 0.7,
        },
      };

      if (allowTools) {
        body["tools"] = [
          {
            functionDeclarations: mcpTools.map(toGeminiFunctionDeclaration),
          },
        ];
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
      });

      const payload = (await response.json().catch(() => null)) as {
        candidates?: Array<{
          finishReason?: string;
          content?: {
            role?: string;
            parts?: Array<{
              text?: string;
              functionCall?: { name?: string; args?: Record<string, unknown> };
            }>;
          };
        }>;
        error?: { message?: string; status?: string };
      } | null;

      if (!response.ok) {
        const detail =
          payload?.error?.message || `Google AI Studio HTTP ${response.status}`;
        if (
          response.status === 400 &&
          allowTools &&
          iter === 0 &&
          isToolUnsupportedError(detail)
        ) {
          allowTools = false;
          continue;
        }
        if (response.status >= 400 && response.status < 500) {
          throw new BadRequestException(detail);
        }
        throw new BadGatewayException(detail);
      }

      const candidateContent = payload?.candidates?.[0]?.content;
      const parts = candidateContent?.parts ?? [];
      const functionCalls = parts.filter(
        (p): p is { functionCall: { name: string; args?: Record<string, unknown> } } =>
          Boolean(p.functionCall?.name)
      );

      if (
        functionCalls.length > 0 &&
        allowTools &&
        iter < MAX_TOOL_CALL_ITERATIONS
      ) {
        contents.push({
          role: candidateContent?.role || "model",
          parts,
        });

        const responseParts: Array<Record<string, unknown>> = [];
        for (const fcPart of functionCalls) {
          const outcome = await this.executeMcpToolCall(
            fcPart.functionCall.name,
            fcPart.functionCall.args,
            projectId,
            toolsUsed,
            contextIdsUsed
          );
          responseParts.push({
            functionResponse: {
              name: fcPart.functionCall.name,
              response: outcome.isError
                ? { error: outcome.text }
                : { result: outcome.text },
            },
          });
        }

        contents.push({
          role: "user",
          parts: responseParts,
        });
        continue;
      }

      const text = parts
        .map((p) => p.text ?? "")
        .join("")
        .trim();

      if (!text) {
        const reason = payload?.candidates?.[0]?.finishReason;
        throw new BadGatewayException(
          reason
            ? `Google AI Studio returned an empty response (finish reason: ${reason}).`
            : "Google AI Studio returned an empty response."
        );
      }

      return { text, toolsUsed, contextIdsUsed };
    }

    throw new BadGatewayException(
      "Google AI Studio exceeded maximum MCP tool-calling iterations."
    );
  }

  private async callAnthropic(
    apiKey: string,
    model: string,
    systemPrompt: string,
    turns: ConversationTurn[],
    mcpTools: McpToolSummary[],
    projectId: string
  ): Promise<ProviderCompletionResult> {
    const messages: Array<{ role: "user" | "assistant"; content: unknown }> =
      turns.map((turn) => ({
        role: turn.role,
        content: turn.content,
      }));

    const toolsUsed: string[] = [];
    const contextIdsUsed: string[] = [];
    let allowTools = mcpTools.length > 0 && Boolean(this.mcpService);

    for (let iter = 0; iter <= MAX_TOOL_CALL_ITERATIONS; iter++) {
      const body: Record<string, unknown> = {
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages,
      };
      if (allowTools) {
        body["tools"] = mcpTools.map(toAnthropicToolDefinition);
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
      });

      const payload = (await response.json().catch(() => null)) as {
        content?: Array<{
          type?: string;
          text?: string;
          id?: string;
          name?: string;
          input?: Record<string, unknown>;
        }>;
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        const detail =
          payload?.error?.message || `Anthropic HTTP ${response.status}`;
        if (
          response.status === 400 &&
          allowTools &&
          iter === 0 &&
          isToolUnsupportedError(detail)
        ) {
          allowTools = false;
          continue;
        }
        if (response.status >= 400 && response.status < 500) {
          throw new BadRequestException(detail);
        }
        throw new BadGatewayException(detail);
      }

      const blocks = payload?.content ?? [];
      const toolUseBlocks = blocks.filter(
        (b): b is { type: "tool_use"; id: string; name: string; input?: Record<string, unknown> } =>
          b.type === "tool_use" && Boolean(b.id) && Boolean(b.name)
      );

      if (
        toolUseBlocks.length > 0 &&
        allowTools &&
        iter < MAX_TOOL_CALL_ITERATIONS
      ) {
        messages.push({ role: "assistant", content: blocks });

        const toolResults: Array<Record<string, unknown>> = [];
        for (const block of toolUseBlocks) {
          const outcome = await this.executeMcpToolCall(
            block.name,
            block.input,
            projectId,
            toolsUsed,
            contextIdsUsed
          );
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: outcome.text,
            ...(outcome.isError ? { is_error: true } : {}),
          });
        }

        messages.push({ role: "user", content: toolResults });
        continue;
      }

      const text = blocks
        .filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("")
        .trim();

      if (!text) {
        throw new BadGatewayException("Anthropic returned an empty response.");
      }

      return { text, toolsUsed, contextIdsUsed };
    }

    throw new BadGatewayException(
      "Anthropic exceeded maximum MCP tool-calling iterations."
    );
  }

  private async callOpenAiCompatible(
    endpoint: string,
    providerLabel: string,
    apiKey: string,
    model: string,
    systemPrompt: string,
    turns: ConversationTurn[],
    mcpTools: McpToolSummary[],
    projectId: string
  ): Promise<ProviderCompletionResult> {
    const isReasoningModel = /^(o1|o3|o4)\b/i.test(model);
    const messages: Array<Record<string, unknown>> = [
      { role: "system", content: systemPrompt },
      ...turns.map((turn) => ({ role: turn.role, content: turn.content })),
    ];

    const toolsUsed: string[] = [];
    const contextIdsUsed: string[] = [];
    let allowTools = mcpTools.length > 0 && Boolean(this.mcpService);

    for (let iter = 0; iter <= MAX_TOOL_CALL_ITERATIONS; iter++) {
      const body: Record<string, unknown> = {
        model,
        messages,
      };
      if (!isReasoningModel) {
        body["temperature"] = 0.7;
      }
      if (allowTools) {
        body["tools"] = mcpTools.map(toOpenAiToolDefinition);
        body["tool_choice"] = "auto";
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
      });

      const payload = (await response.json().catch(() => null)) as {
        choices?: Array<{
          message?: {
            role?: string;
            content?: string | null;
            tool_calls?: Array<{
              id: string;
              type?: string;
              function: { name: string; arguments?: string };
            }>;
          };
        }>;
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        const detail =
          payload?.error?.message || `${providerLabel} HTTP ${response.status}`;
        if (
          response.status === 400 &&
          allowTools &&
          iter === 0 &&
          isToolUnsupportedError(detail)
        ) {
          allowTools = false;
          continue;
        }
        if (response.status >= 400 && response.status < 500) {
          throw new BadRequestException(detail);
        }
        throw new BadGatewayException(detail);
      }

      const choiceMsg = payload?.choices?.[0]?.message;
      const toolCalls = choiceMsg?.tool_calls ?? [];

      if (
        toolCalls.length > 0 &&
        allowTools &&
        iter < MAX_TOOL_CALL_ITERATIONS
      ) {
        messages.push({
          role: "assistant",
          content: choiceMsg?.content ?? null,
          tool_calls: toolCalls,
        });

        for (const tc of toolCalls) {
          const outcome = await this.executeMcpToolCall(
            tc.function.name,
            tc.function.arguments,
            projectId,
            toolsUsed,
            contextIdsUsed
          );
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: outcome.text,
          });
        }
        continue;
      }

      const text = choiceMsg?.content?.trim();
      if (!text) {
        throw new BadGatewayException(
          `${providerLabel} returned an empty response.`
        );
      }

      return { text, toolsUsed, contextIdsUsed };
    }

    throw new BadGatewayException(
      `${providerLabel} exceeded maximum MCP tool-calling iterations.`
    );
  }
}
