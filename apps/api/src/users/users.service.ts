import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { hashPassword } from "@repo/database";
import {
  SOLID_AVATAR_COLORS,
  USER_ROLE_META,
  type AuditLogItem,
  type AuthUser,
  type CreateUserDto,
  type UpdateUserRoleDto,
  type UpdateUserStatusDto,
  type UserRole,
} from "@repo/shared";
import { randomUUID } from "crypto";
import type { AuthenticatedUser } from "../auth/auth.decorators.js";
import {
  AuthService,
  mapPrismaUserToAuthUser,
} from "../auth/auth.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

const ROLE_SORT_PRIORITY: Record<UserRole, number> = {
  admin: 0,
  manager: 1,
  analyst: 2,
  viewer: 3,
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService
  ) {}

  async listUsers(): Promise<AuthUser[]> {
    const rows = await this.prisma.db.orm.public.User.orderBy((u) =>
      u.createdAt.asc()
    ).all();

    return [...rows]
      .sort(
        (a, b) =>
          Number(a.isActive) - Number(b.isActive) ||
          ROLE_SORT_PRIORITY[a.role] - ROLE_SORT_PRIORITY[b.role] ||
          a.name.localeCompare(b.name)
      )
      .map(mapPrismaUserToAuthUser);
  }

  async listAuditLogs(): Promise<AuditLogItem[]> {
    const rows = await this.prisma.db.orm.public.AuditLog.orderBy((l) =>
      l.createdAt.desc()
    )
      .limit(50)
      .all();

    return rows.map((row) => ({
      id: row.id,
      actorId: row.actorId,
      actorEmail: row.actorEmail,
      actorRole: row.actorRole,
      action: row.action,
      resource: row.resource,
      resourceId: row.resourceId,
      details:
        typeof row.details === "object" && row.details !== null
          ? (row.details as Record<string, unknown>)
          : null,
      ipAddress: row.ipAddress,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async createUser(
    actor: AuthenticatedUser,
    dto: CreateUserDto,
    ipAddress?: string
  ): Promise<AuthUser[]> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const existing = await this.prisma.db.orm.public.User.select("id")
      .where({ email: normalizedEmail })
      .first();

    if (existing) {
      throw new ConflictException(
        `A user with email "${normalizedEmail}" already exists.`
      );
    }

    const avatarColor =
      SOLID_AVATAR_COLORS[
        Math.floor(Math.random() * SOLID_AVATAR_COLORS.length)
      ];
    const userId = `usr-${Date.now()}-${randomUUID().slice(0, 8)}`;

    const created = await this.prisma.db.orm.public.User.create({
      id: userId,
      email: normalizedEmail,
      name: dto.name.trim(),
      passwordHash: hashPassword(dto.password),
      role: dto.role,
      title: dto.title?.trim() || USER_ROLE_META[dto.role].label,
      avatarColor,
      isActive: true,
    });

    await this.authService.recordAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "user.created",
      resource: "user",
      resourceId: created.id,
      details: {
        targetEmail: created.email,
        assignedRole: created.role,
      },
      ipAddress,
    });

    return this.listUsers();
  }

  async updateUserRole(
    actor: AuthenticatedUser,
    targetUserId: string,
    dto: UpdateUserRoleDto,
    ipAddress?: string
  ): Promise<AuthUser[]> {
    if (actor.id === targetUserId && dto.role !== "admin") {
      throw new BadRequestException(
        "You cannot demote your own administrator role."
      );
    }

    const target = await this.prisma.db.orm.public.User.where({
      id: targetUserId,
    }).first();

    if (!target) {
      throw new NotFoundException(`User "${targetUserId}" not found.`);
    }

    if (target.role === "admin" && dto.role !== "admin") {
      const activeAdmins = await this.prisma.db.orm.public.User.select("id")
        .where({ role: "admin", isActive: true })
        .all();
      if (activeAdmins.length <= 1) {
        throw new BadRequestException(
          "Cannot demote the last active workspace administrator."
        );
      }
    }

    await this.prisma.db.orm.public.User.where({ id: targetUserId }).update({
      role: dto.role,
    });

    await this.authService.recordAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "user.role_updated",
      resource: "user",
      resourceId: target.id,
      details: {
        targetEmail: target.email,
        previousRole: target.role,
        newRole: dto.role,
      },
      ipAddress,
    });

    return this.listUsers();
  }

  async updateUserStatus(
    actor: AuthenticatedUser,
    targetUserId: string,
    dto: UpdateUserStatusDto,
    ipAddress?: string
  ): Promise<AuthUser[]> {
    if (actor.id === targetUserId && !dto.isActive) {
      throw new BadRequestException(
        "You cannot deactivate your own account."
      );
    }

    const target = await this.prisma.db.orm.public.User.where({
      id: targetUserId,
    }).first();

    if (!target) {
      throw new NotFoundException(`User "${targetUserId}" not found.`);
    }

    if (target.role === "admin" && target.isActive && !dto.isActive) {
      const activeAdmins = await this.prisma.db.orm.public.User.select("id")
        .where({ role: "admin", isActive: true })
        .all();
      if (activeAdmins.length <= 1) {
        throw new BadRequestException(
          "Cannot deactivate the last active workspace administrator."
        );
      }
    }

    await this.prisma.db.transaction(async (tx) => {
      await tx.orm.public.User.where({ id: targetUserId }).update({
        isActive: dto.isActive,
      });

      if (!dto.isActive) {
        await tx.orm.public.AuthSession.where({ userId: targetUserId }).update({
          revokedAt: new Date(),
        });
      }
    });

    await this.authService.recordAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: dto.isActive ? "user.activated" : "user.deactivated",
      resource: "user",
      resourceId: target.id,
      details: {
        targetEmail: target.email,
        isActive: dto.isActive,
      },
      ipAddress,
    });

    return this.listUsers();
  }

  async deleteUser(
    actor: AuthenticatedUser,
    targetUserId: string,
    ipAddress?: string
  ): Promise<AuthUser[]> {
    if (actor.id === targetUserId) {
      throw new BadRequestException("You cannot delete your own account.");
    }

    const target = await this.prisma.db.orm.public.User.where({
      id: targetUserId,
    }).first();

    if (!target) {
      throw new NotFoundException(`User "${targetUserId}" not found.`);
    }

    if (target.role === "admin" && target.isActive) {
      const activeAdmins = await this.prisma.db.orm.public.User.select("id")
        .where({ role: "admin", isActive: true })
        .all();
      if (activeAdmins.length <= 1) {
        throw new BadRequestException(
          "Cannot delete the last active workspace administrator."
        );
      }
    }

    await this.prisma.db.orm.public.User.where({ id: targetUserId }).delete();

    await this.authService.recordAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "user.deleted",
      resource: "user",
      resourceId: target.id,
      details: {
        targetEmail: target.email,
        role: target.role,
      },
      ipAddress,
    });

    return this.listUsers();
  }
}
