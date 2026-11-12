import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  PreconditionFailedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  LEAD_PROVIDERS,
  LEAD_PROVIDER_META,
  normalizeContextUrl,
  type FetchLeadsDto,
  type FetchLeadsResult,
  type LeadContactItem,
  type LeadProvider,
  type LeadProviderStatus,
} from "@repo/shared";
import { randomUUID } from "crypto";
import type { AuthenticatedUser } from "../auth/auth.decorators.js";
import type { AppEnv } from "../config/env.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { activateProjectOnActivity } from "../projects/project-lifecycle.helper.js";
import { findFullProjectOrThrow } from "../projects/project.mapper.js";
import {
  decryptProviderSecret,
  encryptProviderSecret,
  maskProviderSecret,
} from "../scraper/scraper-crypto.helper.js";
import { ScraperService } from "../scraper/scraper.service.js";

const DEFAULT_TARGET_ROLES = [
  "Founder",
  "Co-Founder",
  "CEO",
  "Head of BD",
  "Business Development",
  "Partnerships",
  "Marketing",
  "Growth",
];

function extractDomainFromUrl(rawUrl?: string | null): string {
  if (!rawUrl) return "";
  try {
    const parsed = new URL(
      rawUrl.includes("://") ? rawUrl : `https://${rawUrl}`
    );
    return parsed.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scraperService: ScraperService,
    private readonly config: ConfigService<AppEnv, true>
  ) {}

  private getEncryptionMaterial(): string {
    return this.config.get("JWT_SECRET", { infer: true });
  }

  private getEnvKeyForProvider(provider: LeadProvider): string {
    switch (provider) {
      case "apollo":
        return (this.config.get("APOLLO_API_KEY", { infer: true }) || "").trim();
      case "hunter":
        return (this.config.get("HUNTER_API_KEY", { infer: true }) || "").trim();
      case "snov":
        return (this.config.get("SNOV_API_KEY", { infer: true }) || "").trim();
      case "lusha":
        return (this.config.get("LUSHA_API_KEY", { infer: true }) || "").trim();
      case "website_scraper":
        return "";
    }
  }

  private async readLeadConfigRows() {
    try {
      const table = this.prisma.db.orm.public.LeadProviderConfig;
      return table ? await table.all() : [];
    } catch {
      return [];
    }
  }

  async listProviderStatuses(): Promise<LeadProviderStatus[]> {
    const rows = await this.readLeadConfigRows();
    const dbMap = new Map(rows.map((r) => [r.provider, r]));
    const secretMaterial = this.getEncryptionMaterial();

    return LEAD_PROVIDERS.map((provider) => {
      const meta = LEAD_PROVIDER_META[provider];
      if (!meta.requiresApiKey) {
        return {
          provider,
          label: meta.label,
          shortLabel: meta.shortLabel,
          description: meta.description,
          envVar: meta.envVar,
          docsUrl: meta.docsUrl,
          requiresApiKey: false,
          configured: true,
          source: "builtin" as const,
          maskedKey: null,
          updatedAt: null,
        };
      }

      const dbRow = dbMap.get(provider);
      let workspaceKey = "";
      if (dbRow?.isEnabled && dbRow.apiKey) {
        try {
          workspaceKey = decryptProviderSecret(
            dbRow.apiKey,
            secretMaterial
          ).trim();
        } catch {
          workspaceKey = "";
        }
      }

      const envKey = this.getEnvKeyForProvider(provider);
      const source: LeadProviderStatus["source"] = workspaceKey
        ? "workspace"
        : envKey
          ? "env"
          : "none";
      const activeKey = workspaceKey || envKey;

      return {
        provider,
        label: meta.label,
        shortLabel: meta.shortLabel,
        description: meta.description,
        envVar: meta.envVar,
        docsUrl: meta.docsUrl,
        requiresApiKey: true,
        configured: Boolean(activeKey),
        source,
        maskedKey: activeKey ? maskProviderSecret(activeKey) : null,
        updatedAt: dbRow?.updatedAt ? dbRow.updatedAt.toISOString() : null,
      };
    });
  }

  async saveProviderKey(
    provider: LeadProvider,
    apiKey: string,
    actor?: AuthenticatedUser
  ): Promise<LeadProviderStatus[]> {
    if (!LEAD_PROVIDER_META[provider].requiresApiKey) {
      throw new BadRequestException(
        `${LEAD_PROVIDER_META[provider].label} is built-in and does not require an API key.`
      );
    }

    const trimmed = apiKey.trim();
    if (!trimmed) {
      throw new BadRequestException("API key cannot be empty.");
    }

    const encrypted = encryptProviderSecret(
      trimmed,
      this.getEncryptionMaterial()
    );

    await this.prisma.db.transaction(async (tx) => {
      await tx.orm.public.LeadProviderConfig.upsert({
        create: {
          provider,
          apiKey: encrypted,
          isEnabled: true,
          updatedBy: actor?.email ?? null,
        },
        update: {
          apiKey: encrypted,
          isEnabled: true,
          updatedBy: actor?.email ?? null,
        },
      });

      if (actor) {
        await tx.orm.public.AuditLog.create({
          actorId: actor.id,
          actorEmail: actor.email,
          actorRole: actor.role,
          action: "LEAD_PROVIDER_KEY_SAVED",
          resource: "lead_provider_configs",
          resourceId: provider,
          details: { provider, maskedKey: maskProviderSecret(trimmed) },
        });
      }
    });

    return this.listProviderStatuses();
  }

  async deleteProviderKey(
    provider: LeadProvider,
    actor?: AuthenticatedUser
  ): Promise<LeadProviderStatus[]> {
    await this.prisma.db.transaction(async (tx) => {
      await tx.orm.public.LeadProviderConfig.where({ provider }).deleteAll();

      if (actor) {
        await tx.orm.public.AuditLog.create({
          actorId: actor.id,
          actorEmail: actor.email,
          actorRole: actor.role,
          action: "LEAD_PROVIDER_KEY_REMOVED",
          resource: "lead_provider_configs",
          resourceId: provider,
          details: { provider },
        });
      }
    });

    return this.listProviderStatuses();
  }

  private async resolveProviderKey(provider: LeadProvider): Promise<string> {
    const rows = await this.readLeadConfigRows();
    const dbRow = rows.find((r) => r.provider === provider);
    if (dbRow?.isEnabled && dbRow.apiKey) {
      try {
        const decrypted = decryptProviderSecret(
          dbRow.apiKey,
          this.getEncryptionMaterial()
        ).trim();
        if (decrypted) return decrypted;
      } catch {
        // fallback to env
      }
    }
    return this.getEnvKeyForProvider(provider);
  }

  async resolveBestAvailableProvider(): Promise<LeadProvider> {
    const statuses = await this.listProviderStatuses();
    const externalOrder: LeadProvider[] = ["apollo", "hunter", "snov", "lusha"];
    for (const candidate of externalOrder) {
      const match = statuses.find((s) => s.provider === candidate);
      if (match?.configured) return candidate;
    }
    return "website_scraper";
  }

  async fetchLeadsForProject(
    projectId: string,
    dto: FetchLeadsDto
  ): Promise<FetchLeadsResult> {
    const project = await findFullProjectOrThrow(this.prisma, projectId);
    const meta = LEAD_PROVIDER_META[dto.provider];
    const limit = dto.limit ?? 10;
    const roles =
      dto.roles && dto.roles.length > 0 ? dto.roles : DEFAULT_TARGET_ROLES;

    const websiteCtx = project.contexts.find((c) => c.type === "website");
    const inferredDomain =
      extractDomainFromUrl(dto.domain) ||
      extractDomainFromUrl(websiteCtx?.url ?? websiteCtx?.value);
    const companyName = dto.companyName?.trim() || project.name;

    let apiKey = "";
    if (meta.requiresApiKey) {
      apiKey = await this.resolveProviderKey(dto.provider);
      if (!apiKey) {
        throw new PreconditionFailedException({
          statusCode: 412,
          code: "LEAD_API_KEY_REQUIRED",
          provider: dto.provider,
          message: `${meta.label} requires an API key (${meta.envVar}). Please set your API key to fetch leads with ${meta.shortLabel}.`,
        });
      }
    }

    let gatheredLeads: LeadContactItem[];
    switch (dto.provider) {
      case "apollo":
        gatheredLeads = await this.fetchFromApollo(
          apiKey,
          inferredDomain,
          companyName,
          roles,
          limit
        );
        break;
      case "hunter":
        gatheredLeads = await this.fetchFromHunter(
          apiKey,
          inferredDomain,
          companyName,
          limit
        );
        break;
      case "snov":
        gatheredLeads = await this.fetchFromSnov(apiKey, inferredDomain, limit);
        break;
      case "lusha":
        gatheredLeads = await this.fetchFromLusha(
          apiKey,
          inferredDomain,
          companyName,
          roles,
          limit
        );
        break;
      case "website_scraper":
        gatheredLeads = await this.fetchFromWebsiteScraper(
          projectId,
          project.contexts,
          limit
        );
        break;
    }

    // Deduplicate and persist gathered leads into ProjectContext rows on the right panel
    const existingKeys = new Set<string>();
    for (const ctx of project.contexts) {
      existingKeys.add(ctx.value.trim().toLowerCase());
      if (ctx.url) existingKeys.add(ctx.url.trim().toLowerCase());
      const emailInMeta = (
        ctx.scrapedMetadata?.platformData?.["email"] as string | undefined
      )?.toLowerCase();
      if (emailInMeta) existingKeys.add(emailInMeta);
    }

    let addedCount = 0;
    let skippedCount = 0;
    const savedLeads: LeadContactItem[] = [];

    for (const lead of gatheredLeads) {
      const primaryValue =
        lead.email?.trim() ||
        lead.linkedinUrl?.trim() ||
        lead.xHandle?.trim() ||
        lead.phone?.trim() ||
        lead.name?.trim() ||
        "";

      if (!primaryValue) {
        skippedCount++;
        continue;
      }

      const dedupeCandidates = [
        primaryValue.toLowerCase(),
        lead.email?.trim().toLowerCase(),
        lead.linkedinUrl?.trim().toLowerCase(),
      ].filter((v): v is string => Boolean(v));

      if (dedupeCandidates.some((k) => existingKeys.has(k))) {
        skippedCount++;
        continue;
      }

      dedupeCandidates.forEach((k) => existingKeys.add(k));

      const title =
        lead.name && lead.role
          ? `${lead.name} — ${lead.role}`
          : lead.name || lead.role || `${meta.shortLabel} Contact`;

      const summaryParts = [
        `Source: ${meta.label}`,
        lead.name ? `Contact: ${lead.name}` : "",
        lead.role ? `Role: ${lead.role}` : "",
        lead.email ? `Email: ${lead.email}` : "",
        lead.phone ? `Phone: ${lead.phone}` : "",
        lead.linkedinUrl ? `LinkedIn: ${lead.linkedinUrl}` : "",
        lead.xHandle ? `X: ${lead.xHandle}` : "",
        lead.confidence !== undefined
          ? `Confidence: ${lead.confidence}%`
          : "",
      ].filter(Boolean);

      const url =
        lead.linkedinUrl?.trim() ||
        normalizeContextUrl("lead", primaryValue) ||
        null;

      const contacts = [lead.email, lead.phone].filter((v): v is string =>
        Boolean(v?.trim())
      );

      await this.prisma.db.orm.public.ProjectContext.create({
        id: `ctx-lead-${Date.now()}-${randomUUID().slice(0, 6)}`,
        projectId,
        type: "lead",
        title: title.slice(0, 120),
        value: primaryValue,
        url,
        summary: summaryParts.join(" · "),
        isActive: true,
        updatedAtLabel: `${meta.shortLabel} lead`,
        scrapedMetadata: {
          reachable: true,
          title,
          description: summaryParts.join(" | "),
          signals: ["lead_contact", dto.provider],
          contacts,
          socialLinks: {
            ...(lead.linkedinUrl ? { linkedin: lead.linkedinUrl } : {}),
            ...(lead.xHandle ? { x: lead.xHandle } : {}),
          },
          providerUsed: dto.provider,
          platformData: {
            provider: dto.provider,
            name: lead.name ?? null,
            role: lead.role ?? null,
            email: lead.email ?? null,
            phone: lead.phone ?? null,
            linkedinUrl: lead.linkedinUrl ?? null,
            xHandle: lead.xHandle ?? null,
            confidence: lead.confidence ?? null,
          },
        } as never,
      });

      addedCount++;
      savedLeads.push(lead);
    }

    await activateProjectOnActivity(this.prisma.db.orm, projectId, "Just now");
    const updatedProject = await findFullProjectOrThrow(this.prisma, projectId);

    const message =
      addedCount > 0
        ? `Added ${addedCount} new contact lead(s) via ${meta.shortLabel}${
            skippedCount > 0 ? ` (${skippedCount} duplicate skipped)` : ""
          }.`
        : gatheredLeads.length > 0
          ? `Found ${gatheredLeads.length} contact(s) via ${meta.shortLabel}, all already saved on this project.`
          : `No new contacts were returned by ${meta.shortLabel} for ${
              inferredDomain || companyName
            }.`;

    return {
      project: updatedProject,
      provider: dto.provider,
      addedCount,
      skippedCount,
      leads: savedLeads.length > 0 ? savedLeads : gatheredLeads,
      message,
    };
  }

  private async fetchFromApollo(
    apiKey: string,
    domain: string,
    companyName: string,
    roles: string[],
    limit: number
  ): Promise<LeadContactItem[]> {
    const body: Record<string, unknown> = {
      per_page: limit,
      page: 1,
      person_titles: roles,
    };
    if (domain) {
      body["q_organization_domains_list"] = [domain];
    } else {
      body["q_organization_name"] = companyName;
    }

    const res = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) {
        throw new BadRequestException(
          `Apollo.io API key rejected (HTTP ${res.status}): ${txt.slice(0, 200)}`
        );
      }
      throw new BadGatewayException(
        `Apollo.io API returned HTTP ${res.status}: ${txt.slice(0, 200)}`
      );
    }

    const payload = (await res.json()) as {
      people?: Array<{
        name?: string;
        first_name?: string;
        last_name?: string;
        title?: string;
        email?: string;
        linkedin_url?: string;
        twitter_url?: string;
        phone_numbers?: Array<{ sanitized_number?: string; raw_number?: string }>;
      }>;
    };

    return (payload.people ?? []).slice(0, limit).map((p) => {
      const fullName =
        p.name ||
        [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
        undefined;
      const phone =
        p.phone_numbers?.[0]?.sanitized_number ||
        p.phone_numbers?.[0]?.raw_number ||
        undefined;
      return {
        name: fullName,
        role: p.title || undefined,
        email: p.email && !p.email.includes("email_not_unlocked") ? p.email : undefined,
        phone,
        linkedinUrl: p.linkedin_url || undefined,
        xHandle: p.twitter_url || undefined,
        sourceProvider: "apollo",
      };
    });
  }

  private async fetchFromHunter(
    apiKey: string,
    domain: string,
    companyName: string,
    limit: number
  ): Promise<LeadContactItem[]> {
    const params = new URLSearchParams({
      api_key: apiKey,
      limit: String(limit),
    });
    if (domain) {
      params.set("domain", domain);
    } else {
      params.set("company", companyName);
    }

    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?${params.toString()}`,
      { signal: AbortSignal.timeout(25_000) }
    );

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) {
        throw new BadRequestException(
          `Hunter.io API key rejected (HTTP ${res.status}): ${txt.slice(0, 200)}`
        );
      }
      throw new BadGatewayException(
        `Hunter.io API returned HTTP ${res.status}: ${txt.slice(0, 200)}`
      );
    }

    const payload = (await res.json()) as {
      data?: {
        emails?: Array<{
          value?: string;
          first_name?: string;
          last_name?: string;
          position?: string;
          department?: string;
          linkedin?: string;
          twitter?: string;
          phone_number?: string;
          confidence?: number;
        }>;
      };
    };

    return (payload.data?.emails ?? []).slice(0, limit).map((e) => {
      const fullName =
        [e.first_name, e.last_name].filter(Boolean).join(" ").trim() ||
        undefined;
      return {
        name: fullName,
        role: e.position || e.department || undefined,
        email: e.value || undefined,
        phone: e.phone_number || undefined,
        linkedinUrl: e.linkedin || undefined,
        xHandle: e.twitter || undefined,
        confidence: typeof e.confidence === "number" ? e.confidence : undefined,
        sourceProvider: "hunter",
      };
    });
  }

  private async fetchFromSnov(
    apiKey: string,
    domain: string,
    limit: number
  ): Promise<LeadContactItem[]> {
    if (!domain) {
      throw new BadRequestException(
        "A company website/domain is required to search leads with Snov.io."
      );
    }

    let accessToken = apiKey;
    if (apiKey.includes(":")) {
      const [clientId, clientSecret] = apiKey.split(":", 2);
      const tokenRes = await fetch("https://api.snov.io/v1/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: clientId?.trim(),
          client_secret: clientSecret?.trim(),
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!tokenRes.ok) {
        throw new BadRequestException(
          `Snov.io OAuth failed (HTTP ${tokenRes.status}). Provide valid client_id:client_secret or access token.`
        );
      }
      const tokenPayload = (await tokenRes.json()) as { access_token?: string };
      if (!tokenPayload.access_token) {
        throw new BadRequestException("Snov.io did not return an access token.");
      }
      accessToken = tokenPayload.access_token;
    }

    const params = new URLSearchParams({
      domain,
      type: "all",
      limit: String(limit),
    });
    const res = await fetch(
      `https://api.snov.io/v2/domain-emails-with-info?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(25_000),
      }
    );

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) {
        throw new BadRequestException(
          `Snov.io API key rejected (HTTP ${res.status}): ${txt.slice(0, 200)}`
        );
      }
      throw new BadGatewayException(
        `Snov.io API returned HTTP ${res.status}: ${txt.slice(0, 200)}`
      );
    }

    const payload = (await res.json()) as {
      emails?: Array<{
        email?: string;
        firstName?: string;
        lastName?: string;
        position?: string;
        sourcePage?: string;
      }>;
      data?: Array<{
        email?: string;
        firstName?: string;
        lastName?: string;
        position?: string;
      }>;
    };

    const items = payload.emails ?? payload.data ?? [];
    return items.slice(0, limit).map((item) => ({
      name:
        [item.firstName, item.lastName].filter(Boolean).join(" ").trim() ||
        undefined,
      role: item.position || undefined,
      email: item.email || undefined,
      sourceProvider: "snov",
    }));
  }

  private async fetchFromLusha(
    apiKey: string,
    domain: string,
    companyName: string,
    roles: string[],
    limit: number
  ): Promise<LeadContactItem[]> {
    const body = {
      pages: { page: 0, size: limit },
      filters: {
        companies: {
          include: domain
            ? { domains: [domain] }
            : { names: [companyName] },
        },
        contacts: {
          include: {
            jobTitles: roles,
          },
        },
      },
    };

    const res = await fetch(
      "https://api.lusha.com/prospecting/contact/search",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          api_key: apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(25_000),
      }
    );

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) {
        throw new BadRequestException(
          `Lusha API key rejected (HTTP ${res.status}): ${txt.slice(0, 200)}`
        );
      }
      throw new BadGatewayException(
        `Lusha API returned HTTP ${res.status}: ${txt.slice(0, 200)}`
      );
    }

    const payload = (await res.json()) as {
      data?: Array<{
        fullName?: string;
        firstName?: string;
        lastName?: string;
        jobTitle?: string;
        emailAddresses?: Array<{ email?: string }>;
        phoneNumbers?: Array<{ number?: string }>;
        linkedinUrl?: string;
      }>;
    };

    return (payload.data ?? []).slice(0, limit).map((c) => ({
      name:
        c.fullName ||
        [c.firstName, c.lastName].filter(Boolean).join(" ").trim() ||
        undefined,
      role: c.jobTitle || undefined,
      email: c.emailAddresses?.[0]?.email || undefined,
      phone: c.phoneNumbers?.[0]?.number || undefined,
      linkedinUrl: c.linkedinUrl || undefined,
      sourceProvider: "lusha",
    }));
  }

  private async fetchFromWebsiteScraper(
    projectId: string,
    contexts: Array<{
      id: string;
      type: string;
      value: string;
      lastScrapedAt?: string;
      scrapedMetadata?: { contacts?: string[]; socialLinks?: Record<string, string> };
    }>,
    limit: number
  ): Promise<LeadContactItem[]> {
    const websiteContexts = contexts.filter((c) => c.type === "website");
    // If website hasn't been scraped yet, run the Python scraper first
    for (const webCtx of websiteContexts.slice(0, 2)) {
      if (!webCtx.lastScrapedAt) {
        try {
          await this.scraperService.scrapeContext(projectId, webCtx.id, {
            levels: 2,
            maxPages: 8,
            extractContacts: true,
          });
        } catch (err) {
          this.logger.warn(
            `Website scraper failed during lead extraction for ${webCtx.value}: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
      }
    }

    const scraped = await this.scraperService.getProjectScrapedData(projectId);
    const leads: LeadContactItem[] = [];
    const seenEmails = new Set<string>();

    const addEmail = (email: string, roleHint?: string) => {
      const cleaned = email.trim().toLowerCase();
      if (!cleaned || !cleaned.includes("@") || seenEmails.has(cleaned)) return;
      seenEmails.add(cleaned);
      const localPart = cleaned.split("@")[0] ?? "";
      const role =
        roleHint ||
        (localPart.includes("bd") || localPart.includes("partner")
          ? "Partnerships / BD Inbox"
          : localPart.includes("press") || localPart.includes("media")
            ? "Press & Marketing Inbox"
            : localPart.includes("hello") ||
                localPart.includes("contact") ||
                localPart.includes("info")
              ? "Official Contact Inbox"
              : "Team Contact");
      leads.push({
        name: localPart,
        role,
        email: cleaned,
        sourceProvider: "website_scraper",
      });
    };

    for (const page of scraped.pages) {
      for (const contact of page.contacts ?? []) {
        if (leads.length >= limit) break;
        addEmail(contact);
      }
    }

    for (const ctx of contexts) {
      for (const contact of ctx.scrapedMetadata?.contacts ?? []) {
        if (leads.length >= limit) break;
        addEmail(contact);
      }
    }

    return leads.slice(0, limit);
  }
}
