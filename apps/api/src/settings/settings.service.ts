import { Injectable } from "@nestjs/common";
import type {
  AgencyProfile,
  ChecklistItemConfig,
  PromptTemplate,
  UpdateAgencyProfileDto,
} from "@repo/shared";
import type { AuthenticatedUser } from "../auth/auth.decorators.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  DEFAULT_AGENCY_PROFILE_ID,
  mapAgencyProfileRowToDomain,
} from "./agency-profile.helper.js";

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

  async getAgencyProfile(): Promise<AgencyProfile> {
    const row = await this.prisma.db.orm.public.AgencyProfile.where({
      id: DEFAULT_AGENCY_PROFILE_ID,
    }).first();
    return mapAgencyProfileRowToDomain(row);
  }

  async saveAgencyProfile(
    dto: UpdateAgencyProfileDto,
    actor?: AuthenticatedUser
  ): Promise<AgencyProfile> {
    const saved = await this.prisma.db.transaction(async (tx) => {
      const row = await tx.orm.public.AgencyProfile.upsert({
        create: {
          id: DEFAULT_AGENCY_PROFILE_ID,
          companyName: dto.companyName,
          tagline: dto.tagline || null,
          aboutUs: dto.aboutUs || null,
          services: dto.services || null,
          website: dto.website || null,
          email: dto.email || null,
          phone: dto.phone || null,
          address: dto.address || null,
          city: dto.city || null,
          country: dto.country || null,
          representativeName: dto.representativeName,
          representativeTitle: dto.representativeTitle || null,
          representativeEmail: dto.representativeEmail || null,
          representativePhone: dto.representativePhone || null,
          socialLinks: dto.socialLinks as never,
          notes: dto.notes || null,
          updatedBy: actor?.email ?? null,
        },
        update: {
          companyName: dto.companyName,
          tagline: dto.tagline || null,
          aboutUs: dto.aboutUs || null,
          services: dto.services || null,
          website: dto.website || null,
          email: dto.email || null,
          phone: dto.phone || null,
          address: dto.address || null,
          city: dto.city || null,
          country: dto.country || null,
          representativeName: dto.representativeName,
          representativeTitle: dto.representativeTitle || null,
          representativeEmail: dto.representativeEmail || null,
          representativePhone: dto.representativePhone || null,
          socialLinks: dto.socialLinks as never,
          notes: dto.notes || null,
          updatedBy: actor?.email ?? null,
        },
      });

      if (actor) {
        await tx.orm.public.AuditLog.create({
          actorId: actor.id,
          actorEmail: actor.email,
          actorRole: actor.role,
          action: "AGENCY_PROFILE_UPDATED",
          resource: "agency_profiles",
          resourceId: DEFAULT_AGENCY_PROFILE_ID,
          details: {
            companyName: dto.companyName,
            representativeName: dto.representativeName,
          },
        });
      }

      return row;
    });

    return mapAgencyProfileRowToDomain(saved);
  }
}
