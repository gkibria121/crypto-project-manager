import { Injectable } from "@nestjs/common";
import type { ChecklistItemConfig, PromptTemplate } from "@repo/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPromptTemplates(): Promise<PromptTemplate[]> {
    const rows = await this.prisma.promptTemplate.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      systemPrompt: r.systemPrompt,
    }));
  }

  async savePromptTemplate(
    template: PromptTemplate
  ): Promise<PromptTemplate[]> {
    const count = await this.prisma.promptTemplate.count();
    await this.prisma.promptTemplate.upsert({
      where: { id: template.id },
      update: {
        label: template.label,
        systemPrompt: template.systemPrompt,
      },
      create: {
        id: template.id,
        label: template.label,
        systemPrompt: template.systemPrompt,
        sortOrder: count,
      },
    });
    return this.listPromptTemplates();
  }

  async deletePromptTemplate(id: string): Promise<PromptTemplate[]> {
    await this.prisma.promptTemplate.deleteMany({ where: { id } });
    return this.listPromptTemplates();
  }

  async listChecklistItems(): Promise<ChecklistItemConfig[]> {
    const rows = await this.prisma.checklistItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      scanPrompt: r.scanPrompt,
    }));
  }

  async saveChecklistItem(
    item: ChecklistItemConfig
  ): Promise<ChecklistItemConfig[]> {
    const count = await this.prisma.checklistItem.count();
    await this.prisma.checklistItem.upsert({
      where: { id: item.id },
      update: {
        label: item.label,
        scanPrompt: item.scanPrompt,
      },
      create: {
        id: item.id,
        label: item.label,
        scanPrompt: item.scanPrompt,
        sortOrder: count,
      },
    });
    return this.listChecklistItems();
  }

  async deleteChecklistItem(id: string): Promise<ChecklistItemConfig[]> {
    await this.prisma.checklistItem.deleteMany({ where: { id } });
    return this.listChecklistItems();
  }
}
