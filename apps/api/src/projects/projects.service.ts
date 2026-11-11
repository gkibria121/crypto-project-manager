import { Injectable, NotFoundException } from "@nestjs/common";
import {
  SOLID_AVATAR_COLORS,
  type ContextType,
  type CryptoProject,
  type NewProjectFormValues,
  type ProjectBusinessStatus,
} from "@repo/shared";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service.js";
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

    const tags = [
      input.chain.toLowerCase(),
      input.stage.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    ];

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

      await tx.orm.public.ChatMessage.create({
        id: `msg-${baseTime}-${suffix}`,
        projectId,
        sender: "ai",
        content: `Chat initialized for **${input.name} (${cleanTicker})** with ${contextCreates.length} context items active.`,
        timestampLabel: "Now",
        usedContextIds: contextCreates.map((c) => c.id),
        suggestedActions: [],
        model: "pulseos-engine",
      });
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
    const updated = await this.prisma.db.orm.public.Project.where({
      id: projectId,
    }).update({
      businessStatus: status,
      archivedAt: status === "archived" ? new Date() : null,
      lastActivityTime: "Now",
    });
    if (!updated) {
      throw new NotFoundException(`Project "${projectId}" not found.`);
    }
    return findFullProjectOrThrow(this.prisma, projectId);
  }

  async updateLogo(
    projectId: string,
    logoUrl: string | null | undefined
  ): Promise<CryptoProject> {
    const updated = await this.prisma.db.orm.public.Project.where({
      id: projectId,
    }).update({
      logoUrl: logoUrl && logoUrl.trim().length > 0 ? logoUrl.trim() : null,
    });
    if (!updated) {
      throw new NotFoundException(`Project "${projectId}" not found.`);
    }
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
}
