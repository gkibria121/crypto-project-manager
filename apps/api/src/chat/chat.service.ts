import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  PreconditionFailedException,
} from "@nestjs/common";
import {
  AI_PROVIDER_META,
  formatCurrentTimestamp,
  type AiProvider,
  type CryptoProject,
  type ProjectContextItem,
  type PromptTemplate,
  type SendMessageDto,
} from "@repo/shared";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service.js";
import { computeActivatedProjectPatch } from "../projects/project-lifecycle.helper.js";
import { findFullProjectOrThrow } from "../projects/project.mapper.js";
import { AiProvidersService } from "../settings/ai-providers.service.js";

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful AI assistant. Read the conversation history and the user's messages carefully, follow their instructions accurately, and respond clearly in Markdown when appropriate.";

const MAX_SESSION_HISTORY_MESSAGES = 50;

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
    private readonly aiProvidersService: AiProvidersService
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

    // Only include project contexts explicitly requested from the frontend
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
    const attachedContextText = formatExplicitlyProvidedContext(
      project,
      selectedContexts,
      includeProjectSummary
    );
    const currentTurnPrompt = attachedContextText
      ? `${userText}\n\n${attachedContextText}`
      : userText;

    const conversation = normalizeConversationTurns([
      ...priorTurns,
      { role: "user", content: currentTurnPrompt },
    ]);

    const systemPrompt = appliedTemplate?.systemPrompt?.trim()
      ? appliedTemplate.systemPrompt.trim()
      : DEFAULT_SYSTEM_PROMPT;

    const aiReply = await this.callProvider(
      credential.provider,
      credential.apiKey,
      credential.model,
      systemPrompt,
      conversation
    );

    const nowMs = Date.now();
    const timestamp = formatCurrentTimestamp();
    const suffix = randomUUID().slice(0, 6);
    const usedContextIds = selectedContexts.map((c) => c.id);

    await this.prisma.db.transaction(async (tx) => {
      await tx.orm.public.ChatMessage.create({
        id: `msg-user-${nowMs}-${suffix}`,
        projectId,
        sender: "admin",
        content: userText,
        timestampLabel: timestamp,
        usedContextIds,
        suggestedActions: [],
        createdAt: new Date(nowMs),
      });

      await tx.orm.public.ChatMessage.create({
        id: `msg-ai-${nowMs + 1}-${suffix}`,
        projectId,
        sender: "ai",
        content: aiReply,
        timestampLabel: formatCurrentTimestamp(),
        usedContextIds,
        suggestedActions: [],
        appliedSystemPromptTitle: appliedTemplate?.label ?? null,
        model: credential.model,
        metadata: {
          provider: credential.provider,
          attachedContextCount: usedContextIds.length,
          includedProjectSummary: includeProjectSummary,
          historyLength: priorTurns.length,
          templateId: appliedTemplate?.id ?? null,
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

  private async callProvider(
    provider: AiProvider,
    apiKey: string,
    model: string,
    systemPrompt: string,
    turns: ConversationTurn[]
  ): Promise<string> {
    const providerLabel = AI_PROVIDER_META[provider].label;

    try {
      switch (provider) {
        case "google":
          return await this.callGoogleAiStudio(
            apiKey,
            model,
            systemPrompt,
            turns
          );
        case "anthropic":
          return await this.callAnthropic(apiKey, model, systemPrompt, turns);
        case "openai":
          return await this.callOpenAiCompatible(
            "https://api.openai.com/v1/chat/completions",
            providerLabel,
            apiKey,
            model,
            systemPrompt,
            turns
          );
        case "groq":
          return await this.callOpenAiCompatible(
            "https://api.groq.com/openai/v1/chat/completions",
            providerLabel,
            apiKey,
            model,
            systemPrompt,
            turns
          );
        case "openrouter":
          return await this.callOpenAiCompatible(
            "https://openrouter.ai/api/v1/chat/completions",
            providerLabel,
            apiKey,
            model,
            systemPrompt,
            turns
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
    turns: ConversationTurn[]
  ): Promise<string> {
    const cleanModel = model.replace(/^models\//, "");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: turns.map((turn) => ({
          role: turn.role === "assistant" ? "model" : "user",
          parts: [{ text: turn.content }],
        })),
        generationConfig: {
          temperature: 0.7,
        },
      }),
      signal: AbortSignal.timeout(45_000),
    });

    const payload = (await response.json().catch(() => null)) as {
      candidates?: Array<{
        finishReason?: string;
        content?: { parts?: Array<{ text?: string }> };
      }>;
      error?: { message?: string; status?: string };
    } | null;

    if (!response.ok) {
      const detail =
        payload?.error?.message || `Google AI Studio HTTP ${response.status}`;
      if (response.status >= 400 && response.status < 500) {
        throw new BadRequestException(detail);
      }
      throw new BadGatewayException(detail);
    }

    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
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

    return text;
  }

  private async callAnthropic(
    apiKey: string,
    model: string,
    systemPrompt: string,
    turns: ConversationTurn[]
  ): Promise<string> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: turns.map((turn) => ({
          role: turn.role,
          content: turn.content,
        })),
      }),
      signal: AbortSignal.timeout(45_000),
    });

    const payload = (await response.json().catch(() => null)) as {
      content?: Array<{ type?: string; text?: string }>;
      error?: { message?: string };
    } | null;

    if (!response.ok) {
      const detail =
        payload?.error?.message || `Anthropic HTTP ${response.status}`;
      if (response.status >= 400 && response.status < 500) {
        throw new BadRequestException(detail);
      }
      throw new BadGatewayException(detail);
    }

    const text = payload?.content
      ?.filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("")
      .trim();

    if (!text) {
      throw new BadGatewayException("Anthropic returned an empty response.");
    }

    return text;
  }

  private async callOpenAiCompatible(
    endpoint: string,
    providerLabel: string,
    apiKey: string,
    model: string,
    systemPrompt: string,
    turns: ConversationTurn[]
  ): Promise<string> {
    const isReasoningModel = /^(o1|o3|o4)\b/i.test(model);
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...turns.map((turn) => ({ role: turn.role, content: turn.content })),
      ],
    };
    if (!isReasoningModel) {
      body["temperature"] = 0.7;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });

    const payload = (await response.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    } | null;

    if (!response.ok) {
      const detail =
        payload?.error?.message || `${providerLabel} HTTP ${response.status}`;
      if (response.status >= 400 && response.status < 500) {
        throw new BadRequestException(detail);
      }
      throw new BadGatewayException(detail);
    }

    const text = payload?.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new BadGatewayException(
        `${providerLabel} returned an empty response.`
      );
    }

    return text;
  }
}
