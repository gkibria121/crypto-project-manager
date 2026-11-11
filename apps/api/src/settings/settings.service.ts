import { Injectable } from "@nestjs/common";
import type { ChecklistItemConfig, PromptTemplate } from "@repo/shared";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPromptTemplates(): Promise<PromptTemplate[]> {
    const rows = await this.prisma.db.orm.public.PromptTemplate.orderBy([
      (t) => t.sortOrder.asc(),
      (t) => t.createdAt.asc(),
    ]).all();
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      systemPrompt: r.systemPrompt,
    }));
  }

  async savePromptTemplate(
    template: PromptTemplate
  ): Promise<PromptTemplate[]> {
    const { total } =
      await this.prisma.db.orm.public.PromptTemplate.aggregate((agg) => ({
        total: agg.count(),
      }));
    await this.prisma.db.orm.public.PromptTemplate.upsert({
      create: {
        id: template.id,
        label: template.label,
        systemPrompt: template.systemPrompt,
        sortOrder: total,
      },
      update: {
        label: template.label,
        systemPrompt: template.systemPrompt,
      },
    });
    return this.listPromptTemplates();
  }

  async deletePromptTemplate(id: string): Promise<PromptTemplate[]> {
    await this.prisma.db.orm.public.PromptTemplate.where({ id }).deleteAll();
    return this.listPromptTemplates();
  }

  async listChecklistItems(): Promise<ChecklistItemConfig[]> {
    const rows = await this.prisma.db.orm.public.ChecklistItem.orderBy([
      (i) => i.sortOrder.asc(),
      (i) => i.createdAt.asc(),
    ]).all();
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      scanPrompt: r.scanPrompt,
    }));
  }

  async saveChecklistItem(
    item: ChecklistItemConfig
  ): Promise<ChecklistItemConfig[]> {
    const { total } =
      await this.prisma.db.orm.public.ChecklistItem.aggregate((agg) => ({
        total: agg.count(),
      }));
    await this.prisma.db.orm.public.ChecklistItem.upsert({
      create: {
        id: item.id,
        label: item.label,
        scanPrompt: item.scanPrompt,
        sortOrder: total,
      },
      update: {
        label: item.label,
        scanPrompt: item.scanPrompt,
      },
    });
    return this.listChecklistItems();
  }

  async deleteChecklistItem(id: string): Promise<ChecklistItemConfig[]> {
    await this.prisma.db.orm.public.ChecklistItem.where({ id }).deleteAll();
    return this.listChecklistItems();
  }
}
