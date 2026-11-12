import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  SOLID_AVATAR_COLORS,
  shouldAutoActivateOnActivity,
  type ContextType,
  type CryptoProject,
  type NewProjectFormValues,
  type ProjectBusinessStatus,
  type UpdateProjectFormValues,
} from "@repo/shared";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service.js";
import { computeActivatedProjectPatch } from "./project-lifecycle.helper.js";
import {
  findFullProjectOrThrow,
  fullProjectQuery,
  mapPrismaProjectToDomain,
} from "./project.mapper.js";

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<CryptoProject[]> {
    const projects = await fullProjectQuery(this.prisma.db.orm)
      .orderBy((p) => p.createdAt.desc())
      .all();
    return [...projects]
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned))
      .map(mapPrismaProjectToDomain);
  }

  async findOne(projectId: string): Promise<CryptoProject> {
    return findFullProjectOrThrow(this.prisma, projectId);
  }

  async create(input: NewProjectFormValues): Promise<CryptoProject> {
    if ((input.businessStatus as ProjectBusinessStatus) === "active") {
      throw new BadRequestException(
        "New projects cannot be added directly to the Active state. Add projects in New state and interact with them to mark them Active."
      );
    }

    const cleanTicker = input.ticker.startsWith("$")
      ? input.ticker.toUpperCase()
      : `$${input.ticker.toUpperCase()}`;

    const suffix = randomUUID().slice(0, 8);
    const projectId = `proj-${Date.now()}-${suffix}`;
    const baseTime = Date.now();

    const contextCreates: Array<{
      id: string;
      type: ContextType;
      title: string;
      value: string;
      url: string | null;
      isActive: boolean;
      updatedAtLabel: string;
      createdAt: Date;
    }> = [];

    if (input.website) {
      contextCreates.push({
        id: `ctx-${baseTime}-web-${suffix}`,
        type: "website",
        title: "Official Website",
        value: input.website,
        url: input.website.startsWith("http")
          ? input.website
          : `https://${input.website}`,
        isActive: true,
        updatedAtLabel: "Now",
        createdAt: new Date(baseTime),
      });
    }

    if (input.xHandle) {
      const cleanHandle = input.xHandle.startsWith("@")
        ? input.xHandle
        : `@${input.xHandle}`;
      contextCreates.push({
        id: `ctx-${baseTime}-x-${suffix}`,
        type: "x_handle",
        title: "Official X",
        value: cleanHandle,
        url: `https://x.com/${cleanHandle.replace(/^@/, "")}`,
        isActive: true,
        updatedAtLabel: "Now",
        createdAt: new Date(baseTime + 10),
      });
    }

    if (input.linkedin) {
      contextCreates.push({
        id: `ctx-${baseTime}-li-${suffix}`,
        type: "linkedin",
        title: "LinkedIn",
        value: input.linkedin,
        url: input.linkedin.startsWith("http")
          ? input.linkedin
          : `https://${input.linkedin}`,
        isActive: true,
        updatedAtLabel: "Now",
        createdAt: new Date(baseTime + 20),
      });
    }

    if (input.tagline) {
      contextCreates.push({
        id: `ctx-${baseTime}-note-${suffix}`,
        type: "message",
        title: "Project Positioning",
        value: input.tagline,
        url: null,
        isActive: true,
        updatedAtLabel: "Now",
        createdAt: new Date(baseTime + 30),
      });
    }

    const avatarBg =
      SOLID_AVATAR_COLORS[
        Math.floor(Math.random() * SOLID_AVATAR_COLORS.length)
      ];

    const tags = Array.from(
      new Set([
        ...(input.businessStatus === "new" ? ["new"] : []),
        input.chain.toLowerCase(),
        input.stage.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      ])
    );

    await this.prisma.db.transaction(async (tx) => {
      await tx.orm.public.Project.create({
        id: projectId,
        name: input.name,
        ticker: cleanTicker,
        chain: input.chain,
        stage: input.stage,
        businessStatus: input.businessStatus,
        avatarBg,
        logoUrl: input.logoUrl || null,
        tagline: input.tagline || `${input.chain} project (${input.stage})`,
        campaignBudget: "$25,000 / mo",
        sentimentScore: 90,
        tags,
        isPinned: true,
        unreadInsights: 0,
        lastActivityTime: "Now",
        archivedAt: input.businessStatus === "archived" ? new Date() : null,
      });

      if (contextCreates.length > 0) {
        await tx.orm.public.ProjectContext.createAll(
          contextCreates.map((ctx) => ({
            ...ctx,
            projectId,
          }))
        );
      }
    });

    return findFullProjectOrThrow(this.prisma, projectId);
  }

  async update(
    projectId: string,
    input: UpdateProjectFormValues
  ): Promise<CryptoProject> {
    const existing = await fullProjectQuery(this.prisma.db.orm)
      .where({ id: projectId })
      .first();

    if (!existing) {
      throw new NotFoundException(`Project "${projectId}" not found.`);
    }

    const trimmedTicker = input.ticker.trim();
    const cleanTicker = trimmedTicker.startsWith("$")
      ? trimmedTicker.toUpperCase()
      : `$${trimmedTicker.toUpperCase()}`;

    const normalizedLogoUrl =
      input.logoUrl && input.logoUrl.trim().length > 0
        ? input.logoUrl.trim()
        : null;

    const normalizedTagline =
      input.tagline.trim() || `${input.chain} project (${input.stage})`;

    const effectiveStatus: ProjectBusinessStatus =
      input.businessStatus === existing.businessStatus &&
      shouldAutoActivateOnActivity(existing.businessStatus)
        ? "active"
        : input.businessStatus;

    const preservedTags = existing.tags.filter(
      (tag) =>
        tag !== "new" &&
        tag !== existing.chain.toLowerCase() &&
        tag !== existing.stage.toLowerCase().replace(/[^a-z0-9]+/g, "-")
    );
    const tags = Array.from(
      new Set([
        ...(effectiveStatus === "new" ? ["new"] : []),
        input.chain.toLowerCase(),
        input.stage.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        ...preservedTags,
      ])
    );

    const archivedAt =
      effectiveStatus === "archived"
        ? existing.archivedAt ?? new Date()
        : null;

    const suffix = randomUUID().slice(0, 8);
    const baseTime = Date.now();

    const profileSpecs: Array<{
      type: ContextType;
      shortKey: string;
      defaultTitle: string;
      rawValue: string;
      formatValue: (raw: string) => string;
      formatUrl: (formattedValue: string) => string;
      offsetMs: number;
    }> = [
      {
        type: "website",
        shortKey: "web",
        defaultTitle: "Official Website",
        rawValue: input.website.trim(),
        formatValue: (raw) => raw,
        formatUrl: (val) =>
          val.startsWith("http://") || val.startsWith("https://")
            ? val
            : `https://${val}`,
        offsetMs: 0,
      },
      {
        type: "x_handle",
        shortKey: "x",
        defaultTitle: "Official X",
        rawValue: input.xHandle.trim(),
        formatValue: (raw) => (raw.startsWith("@") ? raw : `@${raw}`),
        formatUrl: (val) => `https://x.com/${val.replace(/^@/, "")}`,
        offsetMs: 10,
      },
      {
        type: "linkedin",
        shortKey: "li",
        defaultTitle: "LinkedIn",
        rawValue: input.linkedin.trim(),
        formatValue: (raw) => raw,
        formatUrl: (val) =>
          val.startsWith("http://") || val.startsWith("https://")
            ? val
            : `https://${val}`,
        offsetMs: 20,
      },
      {
        type: "telegram",
        shortKey: "tg",
        defaultTitle: "Telegram Community",
        rawValue: (input.telegram ?? "").trim(),
        formatValue: (raw) => raw,
        formatUrl: (val) =>
          val.startsWith("http://") || val.startsWith("https://")
            ? val
            : val.startsWith("t.me/")
              ? `https://${val}`
              : `https://t.me/${val.replace(/^@/, "")}`,
        offsetMs: 30,
      },
    ];

    await this.prisma.db.transaction(async (tx) => {
      await tx.orm.public.Project.where({ id: projectId }).update({
        name: input.name.trim(),
        ticker: cleanTicker,
        chain: input.chain.trim(),
        stage: input.stage,
        businessStatus: effectiveStatus,
        avatarBg: input.avatarBg.trim() || existing.avatarBg,
        logoUrl: normalizedLogoUrl,
        tagline: normalizedTagline,
        campaignBudget: input.campaignBudget.trim() || existing.campaignBudget,
        sentimentScore: input.sentimentScore,
        isPinned: input.isPinned ?? existing.isPinned,
        tags,
        lastActivityTime: "Now",
        archivedAt,
      });

      for (const spec of profileSpecs) {
        const existingCtx = existing.contexts.find(
          (ctx) => ctx.type === spec.type
        );

        if (spec.rawValue.length > 0) {
          const formattedValue = spec.formatValue(spec.rawValue);
          const formattedUrl = spec.formatUrl(formattedValue);

          if (existingCtx) {
            if (
              existingCtx.value !== formattedValue ||
              existingCtx.url !== formattedUrl
            ) {
              await tx.orm.public.ProjectContext.where({
                id: existingCtx.id,
              }).update({
                value: formattedValue,
                url: formattedUrl,
                updatedAtLabel: "Now",
              });
            }
          } else {
            await tx.orm.public.ProjectContext.create({
              id: `ctx-${baseTime}-${spec.shortKey}-${suffix}`,
              projectId,
              type: spec.type,
              title: spec.defaultTitle,
              value: formattedValue,
              url: formattedUrl,
              isActive: true,
              updatedAtLabel: "Now",
              createdAt: new Date(baseTime + spec.offsetMs),
            });
          }
        } else if (existingCtx) {
          await tx.orm.public.ProjectContext.where({
            id: existingCtx.id,
          }).delete();
        }
      }

      const positioningNote = existing.contexts.find(
        (ctx) =>
          ctx.type === "message" && ctx.title === "Project Positioning"
      );
      if (
        positioningNote &&
        input.tagline.trim() &&
        positioningNote.value !== input.tagline.trim()
      ) {
        await tx.orm.public.ProjectContext.where({
          id: positioningNote.id,
        }).update({
          value: input.tagline.trim(),
          updatedAtLabel: "Now",
        });
      }
    });

    return findFullProjectOrThrow(this.prisma, projectId);
  }

  async markAsRead(projectId: string): Promise<CryptoProject> {
    const updated = await this.prisma.db.orm.public.Project.where({
      id: projectId,
    }).update({ unreadInsights: 0 });
    if (!updated) {
      throw new NotFoundException(`Project "${projectId}" not found.`);
    }
    return findFullProjectOrThrow(this.prisma, projectId);
  }

  async updateBusinessStatus(
    projectId: string,
    status: ProjectBusinessStatus
  ): Promise<CryptoProject> {
    const existing = await this.prisma.db.orm.public.Project.where({
      id: projectId,
    }).first();
    if (!existing) {
      throw new NotFoundException(`Project "${projectId}" not found.`);
    }

    const baseTags = existing.tags.filter((t) => t !== "new");
    const nextTags =
      status === "new" ? ["new", ...baseTags] : baseTags;

    await this.prisma.db.orm.public.Project.where({
      id: projectId,
    }).update({
      businessStatus: status,
      tags: nextTags,
      archivedAt: status === "archived" ? new Date() : null,
      lastActivityTime: "Now",
    });
    return findFullProjectOrThrow(this.prisma, projectId);
  }

  async bulkUpdateBusinessStatus(
    projectIds: readonly string[],
    status: ProjectBusinessStatus
  ): Promise<{
    updatedCount: number;
    updatedIds: string[];
    status: ProjectBusinessStatus;
  }> {
    const uniqueIds = Array.from(
      new Set(projectIds.map((id) => id.trim()).filter(Boolean))
    );
    if (uniqueIds.length === 0) {
      throw new BadRequestException("Select at least one project to update.");
    }

    const updatedIds: string[] = [];
    const archivedAt = status === "archived" ? new Date() : null;

    await this.prisma.db.transaction(async (tx) => {
      for (const id of uniqueIds) {
        const existing = await tx.orm.public.Project.select(
          "id",
          "tags",
          "archivedAt"
        )
          .where({ id })
          .first();
        if (!existing) continue;

        const baseTags = existing.tags.filter((t) => t !== "new");
        const nextTags = status === "new" ? ["new", ...baseTags] : baseTags;

        await tx.orm.public.Project.where({ id }).update({
          businessStatus: status,
          tags: nextTags,
          archivedAt:
            status === "archived" ? existing.archivedAt ?? archivedAt : null,
          lastActivityTime: "Now",
        });
        updatedIds.push(id);
      }
    });

    return {
      updatedCount: updatedIds.length,
      updatedIds,
      status,
    };
  }

  async updateLogo(
    projectId: string,
    logoUrl: string | null | undefined
  ): Promise<CryptoProject> {
    const existing = await this.prisma.db.orm.public.Project.select(
      "id",
      "businessStatus",
      "tags"
    )
      .where({ id: projectId })
      .first();

    if (!existing) {
      throw new NotFoundException(`Project "${projectId}" not found.`);
    }

    const activityPatch = computeActivatedProjectPatch(existing, "Now");
    await this.prisma.db.orm.public.Project.where({
      id: projectId,
    }).update({
      logoUrl: logoUrl && logoUrl.trim().length > 0 ? logoUrl.trim() : null,
      ...activityPatch,
    });
    return findFullProjectOrThrow(this.prisma, projectId);
  }

  async delete(projectId: string): Promise<{ deleted: true; id: string }> {
    const deleted = await this.prisma.db.orm.public.Project.where({
      id: projectId,
    }).delete();
    if (!deleted) {
      throw new NotFoundException(`Project "${projectId}" not found.`);
    }
    return { deleted: true, id: projectId };
  }

  async bulkDelete(projectIds: readonly string[]): Promise<{
    deletedCount: number;
    deletedIds: string[];
  }> {
    const uniqueIds = Array.from(
      new Set(projectIds.map((id) => id.trim()).filter(Boolean))
    );
    if (uniqueIds.length === 0) {
      throw new BadRequestException("Select at least one project to delete.");
    }

    const deletedIds: string[] = [];

    await this.prisma.db.transaction(async (tx) => {
      for (const id of uniqueIds) {
        const deleted = await tx.orm.public.Project.where({ id }).delete();
        if (deleted) {
          deletedIds.push(id);
        }
      }
    });

    return {
      deletedCount: deletedIds.length,
      deletedIds,
    };
  }
}
