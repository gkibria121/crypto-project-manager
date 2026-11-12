import { Injectable, NotFoundException } from "@nestjs/common";
import {
  evaluateChecklistItemAgainstProject,
  type ChecklistItemConfig,
  type CryptoProject,
} from "@repo/shared";
import { PrismaService } from "../prisma/prisma.service.js";
import { computeActivatedProjectPatch } from "../projects/project-lifecycle.helper.js";
import { findFullProjectOrThrow } from "../projects/project.mapper.js";

@Injectable()
export class ChecklistService {
  constructor(private readonly prisma: PrismaService) {}

  async toggleChecklistItem(
    projectId: string,
    itemId: string
  ): Promise<CryptoProject> {
    const project = await findFullProjectOrThrow(this.prisma, projectId);

    const itemExists = await this.prisma.db.orm.public.ChecklistItem.select(
      "id"
    )
      .where({ id: itemId })
      .first();
    if (!itemExists) {
      throw new NotFoundException(`Checklist item "${itemId}" not found.`);
    }

    const existingState =
      await this.prisma.db.orm.public.ProjectChecklistState.where({
        projectId,
        checklistItemId: itemId,
      }).first();

    await this.prisma.db.transaction(async (tx) => {
      await tx.orm.public.ProjectChecklistState.upsert({
        create: {
          projectId,
          checklistItemId: itemId,
          checked: true,
        },
        update: {
          checked: !existingState?.checked,
        },
        conflictOn: {
          projectId,
          checklistItemId: itemId,
        },
      });

      await tx.orm.public.Project.where({ id: projectId }).update(
        computeActivatedProjectPatch(project, "Just now")
      );
    });

    return findFullProjectOrThrow(this.prisma, projectId);
  }

  async scanAllChecklistItems(projectId: string): Promise<CryptoProject> {
    const project = await findFullProjectOrThrow(this.prisma, projectId);
    const items = await this.prisma.db.orm.public.ChecklistItem.orderBy([
      (i) => i.sortOrder.asc(),
      (i) => i.createdAt.asc(),
    ]).all();

    await this.prisma.db.transaction(async (tx) => {
      for (const item of items) {
        const configItem: ChecklistItemConfig = {
          id: item.id,
          label: item.label,
          scanPrompt: item.scanPrompt,
        };
        const res = evaluateChecklistItemAgainstProject(project, configItem);

        await tx.orm.public.ProjectChecklistState.upsert({
          create: {
            projectId,
            checklistItemId: item.id,
            checked: res.checked,
            scanResultNote: res.scanResultNote ?? null,
            scannedAtLabel: res.scannedAt ?? "Just now",
          },
          update: {
            checked: res.checked,
            scanResultNote: res.scanResultNote ?? null,
            scannedAtLabel: res.scannedAt ?? "Just now",
          },
          conflictOn: {
            projectId,
            checklistItemId: item.id,
          },
        });
      }

      await tx.orm.public.Project.where({ id: projectId }).update(
        computeActivatedProjectPatch(project, "Just now")
      );
    });

    return findFullProjectOrThrow(this.prisma, projectId);
  }

  async scanSingleChecklistItem(
    projectId: string,
    itemId: string,
    overrideItem?: ChecklistItemConfig
  ): Promise<CryptoProject> {
    const project = await findFullProjectOrThrow(this.prisma, projectId);
    const dbItem = await this.prisma.db.orm.public.ChecklistItem.where({
      id: itemId,
    }).first();

    const item: ChecklistItemConfig | null = dbItem
      ? {
          id: dbItem.id,
          label: overrideItem?.label || dbItem.label,
          scanPrompt: overrideItem?.scanPrompt || dbItem.scanPrompt,
        }
      : overrideItem ?? null;

    if (!item) {
      throw new NotFoundException(`Checklist item "${itemId}" not found.`);
    }

    const res = evaluateChecklistItemAgainstProject(project, item);

    await this.prisma.db.transaction(async (tx) => {
      if (dbItem) {
        await tx.orm.public.ProjectChecklistState.upsert({
          create: {
            projectId,
            checklistItemId: dbItem.id,
            checked: res.checked,
            scanResultNote: res.scanResultNote ?? null,
            scannedAtLabel: res.scannedAt ?? "Just now",
          },
          update: {
            checked: res.checked,
            scanResultNote: res.scanResultNote ?? null,
            scannedAtLabel: res.scannedAt ?? "Just now",
          },
          conflictOn: {
            projectId,
            checklistItemId: dbItem.id,
          },
        });
      }

      await tx.orm.public.Project.where({ id: projectId }).update(
        computeActivatedProjectPatch(project, "Just now")
      );
    });

    return findFullProjectOrThrow(this.prisma, projectId);
  }
}
