import { Injectable, NotFoundException } from "@nestjs/common";
import {
  evaluateChecklistItemAgainstProject,
  formatCurrentTimestamp,
  type ChecklistItemConfig,
  type CryptoProject,
} from "@repo/shared";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service.js";
import { findFullProjectOrThrow } from "../projects/project.mapper.js";

@Injectable()
export class ChecklistService {
  constructor(private readonly prisma: PrismaService) {}

  async toggleChecklistItem(
    projectId: string,
    itemId: string
  ): Promise<CryptoProject> {
    await findFullProjectOrThrow(this.prisma, projectId);

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

    await this.prisma.db.orm.public.ProjectChecklistState.upsert({
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

    return findFullProjectOrThrow(this.prisma, projectId);
  }

  async scanAllChecklistItems(projectId: string): Promise<CryptoProject> {
    const project = await findFullProjectOrThrow(this.prisma, projectId);
    const items = await this.prisma.db.orm.public.ChecklistItem.orderBy([
      (i) => i.sortOrder.asc(),
      (i) => i.createdAt.asc(),
    ]).all();

    const enabledContexts = project.contexts.filter((c) => c.isActive);
    const reportLines: string[] = [
      `### Checklist Scan Report — ${project.name} (${project.ticker})`,
    ];

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

        reportLines.push(
          `- **${item.label}** (${res.checked ? "Yes / Detected" : "Missing"}): *${item.scanPrompt}* — ${res.scanResultNote}`
        );
      }

      await tx.orm.public.ChatMessage.create({
        id: `msg-scan-${Date.now()}-${randomUUID().slice(0, 6)}`,
        projectId,
        sender: "ai",
        content: reportLines.join("\n"),
        timestampLabel: formatCurrentTimestamp(),
        usedContextIds: enabledContexts.map((c) => c.id),
        suggestedActions: [],
        model: "pulseos-engine",
      });

      await tx.orm.public.Project.where({ id: projectId }).update({
        lastActivityTime: "Just now",
      });
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

    const enabledContexts = project.contexts.filter((c) => c.isActive);
    const res = evaluateChecklistItemAgainstProject(project, item);
    const timestamp = formatCurrentTimestamp();
    const now = Date.now();
    const suffix = randomUUID().slice(0, 6);

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

      await tx.orm.public.ChatMessage.create({
        id: `msg-chk-q-${now}-${suffix}`,
        projectId,
        sender: "admin",
        content: `Checklist check — ${item.label}: ${item.scanPrompt}`,
        timestampLabel: timestamp,
        usedContextIds: [],
        suggestedActions: [],
        createdAt: new Date(now),
      });

      await tx.orm.public.ChatMessage.create({
        id: `msg-chk-a-${now + 1}-${suffix}`,
        projectId,
        sender: "ai",
        content: `### Checklist Result: ${item.label} — ${res.checked ? "Detected" : "Not Found"}\n- **Scanned Prompt:** "${item.scanPrompt}"\n- **Finding:** ${res.scanResultNote}`,
        timestampLabel: timestamp,
        usedContextIds: enabledContexts.map((c) => c.id),
        suggestedActions: [],
        model: "pulseos-engine",
        createdAt: new Date(now + 5),
      });

      await tx.orm.public.Project.where({ id: projectId }).update({
        lastActivityTime: "Just now",
      });
    });

    return findFullProjectOrThrow(this.prisma, projectId);
  }
}
