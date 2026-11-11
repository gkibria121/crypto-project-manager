import { Injectable, NotFoundException } from "@nestjs/common";
import { MessageSender } from "@repo/database";
import {
  evaluateChecklistItemAgainstProject,
  formatCurrentTimestamp,
  type ChecklistItemConfig,
  type CryptoProject,
} from "@repo/shared";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { findFullProjectOrThrow } from "../projects/project.mapper";

@Injectable()
export class ChecklistService {
  constructor(private readonly prisma: PrismaService) {}

  async toggleChecklistItem(
    projectId: string,
    itemId: string
  ): Promise<CryptoProject> {
    await findFullProjectOrThrow(this.prisma, projectId);

    const itemExists = await this.prisma.checklistItem.findUnique({
      where: { id: itemId },
      select: { id: true },
    });
    if (!itemExists) {
      throw new NotFoundException(`Checklist item "${itemId}" not found.`);
    }

    const existingState = await this.prisma.projectChecklistState.findUnique({
      where: {
        projectId_checklistItemId: {
          projectId,
          checklistItemId: itemId,
        },
      },
    });

    await this.prisma.projectChecklistState.upsert({
      where: {
        projectId_checklistItemId: {
          projectId,
          checklistItemId: itemId,
        },
      },
      update: {
        checked: !existingState?.checked,
      },
      create: {
        projectId,
        checklistItemId: itemId,
        checked: true,
      },
    });

    return findFullProjectOrThrow(this.prisma, projectId);
  }

  async scanAllChecklistItems(projectId: string): Promise<CryptoProject> {
    const project = await findFullProjectOrThrow(this.prisma, projectId);
    const items = await this.prisma.checklistItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    const enabledContexts = project.contexts.filter((c) => c.isActive);
    const reportLines: string[] = [
      `### Checklist Scan Report — ${project.name} (${project.ticker})`,
    ];

    for (const item of items) {
      const configItem: ChecklistItemConfig = {
        id: item.id,
        label: item.label,
        scanPrompt: item.scanPrompt,
      };
      const res = evaluateChecklistItemAgainstProject(project, configItem);

      await this.prisma.projectChecklistState.upsert({
        where: {
          projectId_checklistItemId: {
            projectId,
            checklistItemId: item.id,
          },
        },
        update: {
          checked: res.checked,
          scanResultNote: res.scanResultNote ?? null,
          scannedAtLabel: res.scannedAt ?? "Just now",
        },
        create: {
          projectId,
          checklistItemId: item.id,
          checked: res.checked,
          scanResultNote: res.scanResultNote ?? null,
          scannedAtLabel: res.scannedAt ?? "Just now",
        },
      });

      reportLines.push(
        `- **${item.label}** (${res.checked ? "Yes / Detected" : "Missing"}): *${item.scanPrompt}* — ${res.scanResultNote}`
      );
    }

    await this.prisma.chatMessage.create({
      data: {
        id: `msg-scan-${Date.now()}-${randomUUID().slice(0, 6)}`,
        projectId,
        sender: MessageSender.ai,
        content: reportLines.join("\n"),
        timestampLabel: formatCurrentTimestamp(),
        usedContextIds: enabledContexts.map((c) => c.id),
        suggestedActions: [],
      },
    });

    await this.prisma.project.update({
      where: { id: projectId },
      data: { lastActivityTime: "Just now" },
    });

    return findFullProjectOrThrow(this.prisma, projectId);
  }

  async scanSingleChecklistItem(
    projectId: string,
    itemId: string,
    overrideItem?: ChecklistItemConfig
  ): Promise<CryptoProject> {
    const project = await findFullProjectOrThrow(this.prisma, projectId);
    const dbItem = await this.prisma.checklistItem.findUnique({
      where: { id: itemId },
    });

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

    if (dbItem) {
      await this.prisma.projectChecklistState.upsert({
        where: {
          projectId_checklistItemId: {
            projectId,
            checklistItemId: dbItem.id,
          },
        },
        update: {
          checked: res.checked,
          scanResultNote: res.scanResultNote ?? null,
          scannedAtLabel: res.scannedAt ?? "Just now",
        },
        create: {
          projectId,
          checklistItemId: dbItem.id,
          checked: res.checked,
          scanResultNote: res.scanResultNote ?? null,
          scannedAtLabel: res.scannedAt ?? "Just now",
        },
      });
    }

    await this.prisma.chatMessage.create({
      data: {
        id: `msg-chk-q-${now}-${suffix}`,
        projectId,
        sender: MessageSender.admin,
        content: `Checklist check — ${item.label}: ${item.scanPrompt}`,
        timestampLabel: timestamp,
        usedContextIds: [],
        suggestedActions: [],
        createdAt: new Date(now),
      },
    });

    await this.prisma.chatMessage.create({
      data: {
        id: `msg-chk-a-${now + 1}-${suffix}`,
        projectId,
        sender: MessageSender.ai,
        content: `### Checklist Result: ${item.label} — ${res.checked ? "Detected" : "Not Found"}\n- **Scanned Prompt:** "${item.scanPrompt}"\n- **Finding:** ${res.scanResultNote}`,
        timestampLabel: timestamp,
        usedContextIds: enabledContexts.map((c) => c.id),
        suggestedActions: [],
        createdAt: new Date(now + 5),
      },
    });

    await this.prisma.project.update({
      where: { id: projectId },
      data: { lastActivityTime: "Just now" },
    });

    return findFullProjectOrThrow(this.prisma, projectId);
  }
}
