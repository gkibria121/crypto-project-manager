import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  buildContextualAiResponse,
  formatCurrentTimestamp,
  type CryptoProject,
  type ProjectContextItem,
  type PromptTemplate,
  type SendMessageDto,
} from "@repo/shared";
import { randomUUID } from "crypto";
import type { AppEnv } from "../config/env.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { findFullProjectOrThrow } from "../projects/project.mapper.js";

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppEnv, true>
  ) {}

  async sendMessage(
    projectId: string,
    dto: SendMessageDto
  ): Promise<CryptoProject> {
    const project = await findFullProjectOrThrow(this.prisma, projectId);
    const activeContexts = project.contexts.filter((c) => c.isActive);

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

    const nowMs = Date.now();
    const adminTimestamp = formatCurrentTimestamp();
    const suffix = randomUUID().slice(0, 6);

    await this.prisma.db.orm.public.ChatMessage.create({
      id: `msg-admin-${nowMs}-${suffix}`,
      projectId,
      sender: "admin",
      content: dto.content.trim(),
      timestampLabel: adminTimestamp,
      usedContextIds: [],
      suggestedActions: [],
      createdAt: new Date(nowMs),
    });

    const generated = await this.generateAiResponse(
      project,
      dto.content.trim(),
      activeContexts,
      appliedTemplate
    );

    await this.prisma.db.transaction(async (tx) => {
      await tx.orm.public.ChatMessage.create({
        id: `msg-ai-${nowMs + 1}-${suffix}`,
        projectId,
        sender: "ai",
        content: generated.content,
        timestampLabel: formatCurrentTimestamp(),
        usedContextIds: activeContexts.map((c) => c.id),
        suggestedActions: [],
        appliedSystemPromptTitle: appliedTemplate?.label ?? null,
        model: generated.model,
        metadata: {
          activeContextCount: activeContexts.length,
          templateId: appliedTemplate?.id ?? null,
          provider: generated.provider,
        },
        createdAt: new Date(nowMs + 5),
      });

      await tx.orm.public.Project.where({ id: projectId }).update({
        lastActivityTime: "Just now",
      });
    });

    return findFullProjectOrThrow(this.prisma, projectId);
  }

  async resetConversation(projectId: string): Promise<CryptoProject> {
    const project = await findFullProjectOrThrow(this.prisma, projectId);
    const enabledContexts = project.contexts.filter((c) => c.isActive);

    await this.prisma.db.transaction(async (tx) => {
      await tx.orm.public.ChatMessage.where({ projectId }).deleteAll();
      await tx.orm.public.ChatMessage.create({
        id: `msg-reset-${Date.now()}-${randomUUID().slice(0, 6)}`,
        projectId,
        sender: "ai",
        content: `Chat cleared for **${project.name} (${project.ticker})** (${enabledContexts.length} contexts active).`,
        timestampLabel: "Now",
        usedContextIds: enabledContexts.map((c) => c.id),
        suggestedActions: [],
        model: "pulseos-engine",
      });
    });

    return findFullProjectOrThrow(this.prisma, projectId);
  }

  private async generateAiResponse(
    project: CryptoProject,
    userPrompt: string,
    activeContexts: ProjectContextItem[],
    template?: PromptTemplate
  ): Promise<{ content: string; model: string; provider: string }> {
    const apiKey = this.config.get("OPENAI_API_KEY", { infer: true })?.trim();
    if (!apiKey) {
      return {
        content: buildContextualAiResponse(
          project,
          userPrompt,
          activeContexts,
          template
        ),
        model: "pulseos-engine",
        provider: "deterministic",
      };
    }

    const model = this.config.get("OPENAI_MODEL", { infer: true });
    const contextBlock = activeContexts
      .map((c) => {
        const signals = c.scrapedMetadata?.signals?.length
          ? ` | Signals: ${c.scrapedMetadata.signals.join(", ")}`
          : "";
        return `- [${c.type}] ${c.title}: ${c.value}${c.summary ? ` (${c.summary})` : ""}${signals}`;
      })
      .join("\n");

    const systemPrompt = [
      template?.systemPrompt ||
        "You are PulseOS, an expert Web3 growth strategist and crypto marketing copilot.",
      `Project: ${project.name} (${project.ticker}) on ${project.chain}, Stage: ${project.stage}, Status: ${project.businessStatus}.`,
      `Tagline: ${project.tagline}`,
      contextBlock ? `Active Project Contexts:\n${contextBlock}` : "",
      "Format cleanly using concise markdown headings, bullets, and blockquotes.",
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.7,
          }),
          signal: AbortSignal.timeout(20000),
        }
      );

      if (!response.ok) {
        throw new Error(`OpenAI HTTP ${response.status}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (content) {
        return {
          content: template
            ? `> **Applied System Prompt (${template.label}):** ${template.systemPrompt}\n\n${content}`
            : content,
          model,
          provider: "openai",
        };
      }
    } catch (error) {
      this.logger.warn(
        `LLM completion failed, falling back to deterministic engine: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    return {
      content: buildContextualAiResponse(
        project,
        userPrompt,
        activeContexts,
        template
      ),
      model: "pulseos-engine",
      provider: "deterministic-fallback",
    };
  }
}
