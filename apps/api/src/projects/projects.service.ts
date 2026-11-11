import { Injectable } from "@nestjs/common";
import { ContextType, MessageSender } from "@repo/database";
import {
  SOLID_AVATAR_COLORS,
  type CryptoProject,
  type NewProjectFormValues,
  type ProjectBusinessStatus,
} from "@repo/shared";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import {
  FULL_PROJECT_INCLUDE,
  findFullProjectOrThrow,
  mapPrismaProjectToDomain,
  toPrismaStage,
} from "./project.mapper";

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<CryptoProject[]> {
    const projects = await this.prisma.project.findMany({
      include: FULL_PROJECT_INCLUDE,
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    });
    return projects.map(mapPrismaProjectToDomain);
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
        type: ContextType.website,
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
        type: ContextType.x_handle,
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
        type: ContextType.linkedin,
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
        type: ContextType.message,
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

    const created = await this.prisma.project.create({
      data: {
        id: projectId,
        name: input.name,
        ticker: cleanTicker,
        chain: input.chain,
        stage: toPrismaStage(input.stage),
        businessStatus: input.businessStatus,
        avatarBg,
        logoUrl: input.logoUrl || null,
        tagline: input.tagline || `${input.chain} project (${input.stage})`,
        campaignBudget: "$25,000 / mo",
        sentimentScore: 90,
        isPinned: true,
        unreadInsights: 0,
        lastActivityTime: "Now",
        contexts: {
          create: contextCreates,
        },
        messages: {
          create: [
            {
              id: `msg-${baseTime}-${suffix}`,
              sender: MessageSender.ai,
              content: `Chat initialized for **${input.name} (${cleanTicker})** with ${contextCreates.length} context items active.`,
              timestampLabel: "Now",
              usedContextIds: contextCreates.map((c) => c.id),
              suggestedActions: [],
            },
          ],
        },
      },
      include: FULL_PROJECT_INCLUDE,
    });

    return mapPrismaProjectToDomain(created);
  }

  async markAsRead(projectId: string): Promise<CryptoProject> {
    await this.prisma.project.update({
      where: { id: projectId },
      data: { unreadInsights: 0 },
    });
    return findFullProjectOrThrow(this.prisma, projectId);
  }

  async updateBusinessStatus(
    projectId: string,
    status: ProjectBusinessStatus
  ): Promise<CryptoProject> {
    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        businessStatus: status,
        lastActivityTime: "Now",
      },
    });
    return findFullProjectOrThrow(this.prisma, projectId);
  }

  async updateLogo(
    projectId: string,
    logoUrl: string | null | undefined
  ): Promise<CryptoProject> {
    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        logoUrl: logoUrl && logoUrl.trim().length > 0 ? logoUrl.trim() : null,
      },
    });
    return findFullProjectOrThrow(this.prisma, projectId);
  }

  async delete(projectId: string): Promise<{ deleted: true; id: string }> {
    await this.prisma.project.delete({
      where: { id: projectId },
    });
    return { deleted: true, id: projectId };
  }
}
