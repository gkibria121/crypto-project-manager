import { Injectable, NotFoundException } from "@nestjs/common";
import {
  normalizeContextUrl,
  type AddContextFormValues,
  type CryptoProject,
} from "@repo/shared";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { findFullProjectOrThrow } from "../projects/project.mapper";

@Injectable()
export class ContextsService {
  constructor(private readonly prisma: PrismaService) {}

  async addContext(
    projectId: string,
    values: AddContextFormValues
  ): Promise<CryptoProject> {
    await findFullProjectOrThrow(this.prisma, projectId);

    const id = `ctx-${Date.now()}-${randomUUID().slice(0, 6)}`;
    await this.prisma.projectContext.create({
      data: {
        id,
        projectId,
        type: values.type,
        title: values.title,
        value: values.value,
        url: normalizeContextUrl(values.type, values.value) ?? null,
        summary: values.summary || null,
        isActive: true,
        updatedAtLabel: "Now",
      },
    });

    return findFullProjectOrThrow(this.prisma, projectId);
  }

  async toggleContext(
    projectId: string,
    contextId: string
  ): Promise<CryptoProject> {
    const ctx = await this.prisma.projectContext.findFirst({
      where: { id: contextId, projectId },
    });

    if (!ctx) {
      throw new NotFoundException(
        `Context "${contextId}" not found for project "${projectId}".`
      );
    }

    await this.prisma.projectContext.update({
      where: { id: contextId },
      data: { isActive: !ctx.isActive },
    });

    return findFullProjectOrThrow(this.prisma, projectId);
  }

  async toggleAllContexts(
    projectId: string,
    enable: boolean
  ): Promise<CryptoProject> {
    await findFullProjectOrThrow(this.prisma, projectId);

    await this.prisma.projectContext.updateMany({
      where: { projectId },
      data: { isActive: enable },
    });

    return findFullProjectOrThrow(this.prisma, projectId);
  }

  async deleteContext(
    projectId: string,
    contextId: string
  ): Promise<CryptoProject> {
    const existing = await this.prisma.projectContext.findFirst({
      where: { id: contextId, projectId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException(
        `Context "${contextId}" not found for project "${projectId}".`
      );
    }

    await this.prisma.projectContext.delete({
      where: { id: contextId },
    });

    return findFullProjectOrThrow(this.prisma, projectId);
  }
}
