import { Injectable, NotFoundException } from "@nestjs/common";
import {
  normalizeContextUrl,
  type AddContextFormValues,
  type CryptoProject,
} from "@repo/shared";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service.js";
import { findFullProjectOrThrow } from "../projects/project.mapper.js";

@Injectable()
export class ContextsService {
  constructor(private readonly prisma: PrismaService) {}

  async addContext(
    projectId: string,
    values: AddContextFormValues
  ): Promise<CryptoProject> {
    await findFullProjectOrThrow(this.prisma, projectId);

    const id = `ctx-${Date.now()}-${randomUUID().slice(0, 6)}`;
    await this.prisma.db.orm.public.ProjectContext.create({
      id,
      projectId,
      type: values.type,
      title: values.title,
      value: values.value,
      url: normalizeContextUrl(values.type, values.value) ?? null,
      summary: values.summary || null,
      isActive: true,
      updatedAtLabel: "Now",
    });

    return findFullProjectOrThrow(this.prisma, projectId);
  }

  async toggleContext(
    projectId: string,
    contextId: string
  ): Promise<CryptoProject> {
    const ctx = await this.prisma.db.orm.public.ProjectContext.where({
      id: contextId,
      projectId,
    }).first();

    if (!ctx) {
      throw new NotFoundException(
        `Context "${contextId}" not found for project "${projectId}".`
      );
    }

    await this.prisma.db.orm.public.ProjectContext.where({
      id: contextId,
    }).update({ isActive: !ctx.isActive });

    return findFullProjectOrThrow(this.prisma, projectId);
  }

  async toggleAllContexts(
    projectId: string,
    enable: boolean
  ): Promise<CryptoProject> {
    await findFullProjectOrThrow(this.prisma, projectId);

    await this.prisma.db.orm.public.ProjectContext.where({
      projectId,
    }).updateAll({ isActive: enable });

    return findFullProjectOrThrow(this.prisma, projectId);
  }

  async deleteContext(
    projectId: string,
    contextId: string
  ): Promise<CryptoProject> {
    const deleted = await this.prisma.db.orm.public.ProjectContext.where({
      id: contextId,
      projectId,
    }).delete();

    if (!deleted) {
      throw new NotFoundException(
        `Context "${contextId}" not found for project "${projectId}".`
      );
    }

    return findFullProjectOrThrow(this.prisma, projectId);
  }
}
