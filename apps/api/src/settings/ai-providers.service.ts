import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AI_PROVIDERS,
  AI_PROVIDER_META,
  type ActivateAiProviderDto,
  type AiConfigurationSummary,
  type AiProvider,
  type AiProviderModelsResponse,
  type AiProviderStatus,
  type UpdateAiProviderConfigDto,
} from "@repo/shared";
import type { AuthenticatedUser } from "../auth/auth.decorators.js";
import type { AppEnv } from "../config/env.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  decryptProviderSecret,
  encryptProviderSecret,
  maskProviderSecret,
} from "../scraper/scraper-crypto.helper.js";

export interface ResolvedAiCredential {
  provider: AiProvider;
  apiKey: string;
  model: string;
}

@Injectable()
export class AiProvidersService {
  private readonly logger = new Logger(AiProvidersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppEnv, true>
  ) {}

  private getEncryptionMaterial(): string {
    return this.config.get("JWT_SECRET", { infer: true });
  }

  private getEnvKeyForProvider(provider: AiProvider): string {
    switch (provider) {
      case "google":
        return (
          this.config.get("GEMINI_API_KEY", { infer: true }) ||
          process.env["GOOGLE_AI_API_KEY"] ||
          process.env["GOOGLE_API_KEY"] ||
          ""
        ).trim();
      case "openai":
        return (this.config.get("OPENAI_API_KEY", { infer: true }) || "").trim();
      case "anthropic":
        return (
          this.config.get("ANTHROPIC_API_KEY", { infer: true }) || ""
        ).trim();
      case "groq":
        return (this.config.get("GROQ_API_KEY", { infer: true }) || "").trim();
      case "openrouter":
        return (
          this.config.get("OPENROUTER_API_KEY", { infer: true }) || ""
        ).trim();
    }
  }

  private getEnvDefaultModel(provider: AiProvider): string {
    switch (provider) {
      case "google":
        return (
          this.config.get("GEMINI_MODEL", { infer: true }) ||
          AI_PROVIDER_META.google.defaultModel
        );
      case "openai":
        return (
          this.config.get("OPENAI_MODEL", { infer: true }) ||
          AI_PROVIDER_META.openai.defaultModel
        );
      case "anthropic":
        return (
          this.config.get("ANTHROPIC_MODEL", { infer: true }) ||
          AI_PROVIDER_META.anthropic.defaultModel
        );
      case "groq":
        return (
          this.config.get("GROQ_MODEL", { infer: true }) ||
          AI_PROVIDER_META.groq.defaultModel
        );
      case "openrouter":
        return (
          this.config.get("OPENROUTER_MODEL", { infer: true }) ||
          AI_PROVIDER_META.openrouter.defaultModel
        );
    }
  }

  private decryptWorkspaceKey(encoded: string | null | undefined): string {
    if (!encoded) return "";
    try {
      return decryptProviderSecret(encoded, this.getEncryptionMaterial()).trim();
    } catch (err) {
      this.logger.warn(
        `Failed decrypting AI provider key: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      return "";
    }
  }

  async listProviderConfiguration(): Promise<AiConfigurationSummary> {
    const rows = await this.prisma.db.orm.public.AiProviderConfig.all();
    const dbMap = new Map(rows.map((r) => [r.provider, r]));

    const explicitActiveRow = rows.find((r) => r.isActive && r.isEnabled);

    const rawStatuses = AI_PROVIDERS.map((provider) => {
      const meta = AI_PROVIDER_META[provider];
      const dbRow = dbMap.get(provider);
      const workspaceKey =
        dbRow?.isEnabled !== false
          ? this.decryptWorkspaceKey(dbRow?.apiKey)
          : "";
      const envKey = this.getEnvKeyForProvider(provider);
      const source: AiProviderStatus["source"] = workspaceKey
        ? "workspace"
        : envKey
          ? "env"
          : "none";
      const activeKey = workspaceKey || envKey;
      const selectedModel =
        dbRow?.selectedModel?.trim() || this.getEnvDefaultModel(provider);

      return {
        provider,
        label: meta.label,
        shortLabel: meta.shortLabel,
        envVar: meta.envVar,
        docsUrl: meta.docsUrl,
        defaultModel: meta.defaultModel,
        recommendedModels: [...meta.recommendedModels],
        configured: Boolean(activeKey),
        source,
        maskedKey: activeKey ? maskProviderSecret(activeKey) : null,
        selectedModel,
        isActive: false,
        updatedAt: dbRow?.updatedAt ? dbRow.updatedAt.toISOString() : null,
        _rawKey: activeKey,
      };
    });

    let resolvedActiveProvider: AiProvider | null = null;
    if (explicitActiveRow) {
      const match = rawStatuses.find(
        (s) => s.provider === explicitActiveRow.provider
      );
      if (match) {
        resolvedActiveProvider = match.provider;
      }
    } else {
      const firstConfigured = rawStatuses.find((s) => s.configured);
      resolvedActiveProvider = firstConfigured?.provider ?? "google";
    }

    const providers: AiProviderStatus[] = rawStatuses.map(
      ({ _rawKey: _ignored, ...status }) => ({
        ...status,
        isActive: status.provider === resolvedActiveProvider,
      })
    );

    const activeStatus = providers.find((p) => p.isActive) ?? null;
    const hasConfiguredProvider = Boolean(activeStatus?.configured);

    return {
      activeProvider: resolvedActiveProvider,
      activeModel: activeStatus?.selectedModel ?? null,
      hasConfiguredProvider,
      providers,
    };
  }

  async resolveActiveCredential(): Promise<ResolvedAiCredential | null> {
    const rows = await this.prisma.db.orm.public.AiProviderConfig.all();
    const dbMap = new Map(rows.map((r) => [r.provider, r]));

    const resolveFor = (provider: AiProvider): ResolvedAiCredential | null => {
      const dbRow = dbMap.get(provider);
      const workspaceKey =
        dbRow?.isEnabled !== false
          ? this.decryptWorkspaceKey(dbRow?.apiKey)
          : "";
      const envKey = this.getEnvKeyForProvider(provider);
      const apiKey = workspaceKey || envKey;
      if (!apiKey) return null;
      const model =
        dbRow?.selectedModel?.trim() || this.getEnvDefaultModel(provider);
      return { provider, apiKey, model };
    };

    const explicitActiveRow = rows.find((r) => r.isActive && r.isEnabled);
    if (explicitActiveRow) {
      const matchedProvider = AI_PROVIDERS.find(
        (p) => p === explicitActiveRow.provider
      );
      if (matchedProvider) {
        return resolveFor(matchedProvider);
      }
    }

    for (const provider of AI_PROVIDERS) {
      const resolved = resolveFor(provider);
      if (resolved) return resolved;
    }

    return null;
  }

  async saveProviderConfig(
    provider: AiProvider,
    dto: UpdateAiProviderConfigDto,
    actor?: AuthenticatedUser
  ): Promise<AiConfigurationSummary> {
    const rows = await this.prisma.db.orm.public.AiProviderConfig.all();
    const existing = rows.find((r) => r.provider === provider);
    const trimmedKey = dto.apiKey?.trim();
    const trimmedModel = dto.selectedModel?.trim();

    if (dto.apiKey !== undefined && !trimmedKey) {
      throw new BadRequestException("API key cannot be empty.");
    }

    const encryptedKey = trimmedKey
      ? encryptProviderSecret(trimmedKey, this.getEncryptionMaterial())
      : undefined;

    const currentlyActiveConfigured = rows.some((r) => {
      if (!r.isActive || !r.isEnabled) return false;
      const p = AI_PROVIDERS.find((candidate) => candidate === r.provider);
      if (!p) return false;
      const wsKey = this.decryptWorkspaceKey(r.apiKey);
      const envKey = this.getEnvKeyForProvider(p);
      return Boolean(wsKey || envKey);
    });

    const shouldActivate =
      dto.activate === true ||
      Boolean(trimmedKey && !currentlyActiveConfigured) ||
      Boolean(existing?.isActive && dto.activate !== false);

    const nextModel =
      trimmedModel ?? existing?.selectedModel ?? this.getEnvDefaultModel(provider);

    await this.prisma.db.transaction(async (tx) => {
      if (shouldActivate) {
        for (const row of rows) {
          if (row.provider !== provider && row.isActive) {
            await tx.orm.public.AiProviderConfig.where({
              provider: row.provider,
            }).update({ isActive: false });
          }
        }
      }

      await tx.orm.public.AiProviderConfig.upsert({
        create: {
          provider,
          apiKey: encryptedKey ?? null,
          selectedModel: nextModel,
          isActive: shouldActivate,
          isEnabled: true,
          updatedBy: actor?.email ?? null,
        },
        update: {
          ...(encryptedKey !== undefined ? { apiKey: encryptedKey } : {}),
          ...(trimmedModel !== undefined ? { selectedModel: trimmedModel } : {}),
          ...(dto.activate !== undefined || shouldActivate
            ? { isActive: shouldActivate }
            : {}),
          isEnabled: true,
          updatedBy: actor?.email ?? null,
        },
      });

      if (actor) {
        await tx.orm.public.AuditLog.create({
          actorId: actor.id,
          actorEmail: actor.email,
          actorRole: actor.role,
          action: "AI_PROVIDER_CONFIG_SAVED",
          resource: "ai_provider_configs",
          resourceId: provider,
          details: {
            provider,
            selectedModel: nextModel,
            activated: shouldActivate,
            ...(trimmedKey ? { maskedKey: maskProviderSecret(trimmedKey) } : {}),
          },
        });
      }
    });

    return this.listProviderConfiguration();
  }

  async activateProvider(
    provider: AiProvider,
    dto: ActivateAiProviderDto,
    actor?: AuthenticatedUser
  ): Promise<AiConfigurationSummary> {
    const rows = await this.prisma.db.orm.public.AiProviderConfig.all();
    const existing = rows.find((r) => r.provider === provider);
    const trimmedModel = dto.selectedModel?.trim();
    const nextModel =
      trimmedModel ?? existing?.selectedModel ?? this.getEnvDefaultModel(provider);

    await this.prisma.db.transaction(async (tx) => {
      for (const row of rows) {
        if (row.provider !== provider && row.isActive) {
          await tx.orm.public.AiProviderConfig.where({
            provider: row.provider,
          }).update({ isActive: false });
        }
      }

      await tx.orm.public.AiProviderConfig.upsert({
        create: {
          provider,
          apiKey: null,
          selectedModel: nextModel,
          isActive: true,
          isEnabled: true,
          updatedBy: actor?.email ?? null,
        },
        update: {
          isActive: true,
          isEnabled: true,
          ...(trimmedModel ? { selectedModel: trimmedModel } : {}),
          updatedBy: actor?.email ?? null,
        },
      });

      if (actor) {
        await tx.orm.public.AuditLog.create({
          actorId: actor.id,
          actorEmail: actor.email,
          actorRole: actor.role,
          action: "AI_PROVIDER_ACTIVATED",
          resource: "ai_provider_configs",
          resourceId: provider,
          details: { provider, selectedModel: nextModel },
        });
      }
    });

    return this.listProviderConfiguration();
  }

  async deleteProviderKey(
    provider: AiProvider,
    actor?: AuthenticatedUser
  ): Promise<AiConfigurationSummary> {
    const existing = await this.prisma.db.orm.public.AiProviderConfig.where({
      provider,
    }).first();
    const envKey = this.getEnvKeyForProvider(provider);

    await this.prisma.db.transaction(async (tx) => {
      if (existing) {
        if (envKey) {
          await tx.orm.public.AiProviderConfig.where({ provider }).update({
            apiKey: null,
            updatedBy: actor?.email ?? null,
          });
        } else {
          await tx.orm.public.AiProviderConfig.where({ provider }).deleteAll();
        }
      }

      if (actor) {
        await tx.orm.public.AuditLog.create({
          actorId: actor.id,
          actorEmail: actor.email,
          actorRole: actor.role,
          action: "AI_PROVIDER_KEY_REMOVED",
          resource: "ai_provider_configs",
          resourceId: provider,
          details: { provider },
        });
      }
    });

    return this.listProviderConfiguration();
  }

  async listProviderModels(
    provider: AiProvider
  ): Promise<AiProviderModelsResponse> {
    const meta = AI_PROVIDER_META[provider];
    const row = await this.prisma.db.orm.public.AiProviderConfig.where({
      provider,
    }).first();
    const workspaceKey =
      row?.isEnabled !== false ? this.decryptWorkspaceKey(row?.apiKey) : "";
    const apiKey = workspaceKey || this.getEnvKeyForProvider(provider);

    if (!apiKey) {
      return {
        provider,
        models: [...meta.recommendedModels],
        source: "curated",
      };
    }

    try {
      const liveModels = await this.fetchLiveModels(provider, apiKey);
      if (liveModels.length > 0) {
        const merged = Array.from(
          new Set([...meta.recommendedModels.filter((m) => liveModels.includes(m)), ...liveModels])
        );
        return {
          provider,
          models: merged,
          source: "live",
        };
      }
    } catch (error) {
      this.logger.warn(
        `Failed fetching live models for ${provider}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    return {
      provider,
      models: [...meta.recommendedModels],
      source: "curated",
    };
  }

  private async fetchLiveModels(
    provider: AiProvider,
    apiKey: string
  ): Promise<string[]> {
    switch (provider) {
      case "google": {
        const res = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models",
          {
            headers: { "x-goog-api-key": apiKey },
            signal: AbortSignal.timeout(8000),
          }
        );
        if (!res.ok) return [];
        const data = (await res.json()) as {
          models?: Array<{
            name?: string;
            supportedGenerationMethods?: string[];
          }>;
        };
        return (data.models ?? [])
          .filter((m) =>
            m.supportedGenerationMethods?.includes("generateContent")
          )
          .map((m) => (m.name ?? "").replace(/^models\//, ""))
          .filter(Boolean);
      }
      case "openai": {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return [];
        const data = (await res.json()) as {
          data?: Array<{ id?: string }>;
        };
        return (data.data ?? [])
          .map((m) => m.id ?? "")
          .filter(
            (id) =>
              id.startsWith("gpt-") ||
              id.startsWith("o1") ||
              id.startsWith("o3") ||
              id.startsWith("o4") ||
              id.startsWith("chatgpt-")
          )
          .sort();
      }
      case "groq": {
        const res = await fetch("https://api.groq.com/openai/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return [];
        const data = (await res.json()) as {
          data?: Array<{ id?: string }>;
        };
        return (data.data ?? [])
          .map((m) => m.id ?? "")
          .filter(Boolean)
          .sort();
      }
      case "openrouter": {
        const res = await fetch("https://openrouter.ai/api/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return [];
        const data = (await res.json()) as {
          data?: Array<{ id?: string }>;
        };
        return (data.data ?? [])
          .map((m) => m.id ?? "")
          .filter(Boolean)
          .slice(0, 60);
      }
      case "anthropic": {
        const res = await fetch("https://api.anthropic.com/v1/models", {
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return [];
        const data = (await res.json()) as {
          data?: Array<{ id?: string }>;
        };
        return (data.data ?? []).map((m) => m.id ?? "").filter(Boolean);
      }
    }
  }
}
