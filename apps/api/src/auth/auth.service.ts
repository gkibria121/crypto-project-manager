import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  hashPassword,
  hashSessionToken,
  signJwt,
  verifyJwt,
  verifyPassword,
} from "@repo/database";
import {
  SOLID_AVATAR_COLORS,
  USER_ROLE_META,
  getPermissionsForRole,
  type AuthRegisterResponse,
  type AuthSessionResponse,
  type AuthUser,
  type LoginDto,
  type RegisterDto,
  type UserRole,
} from "@repo/shared";
import { randomUUID } from "crypto";
import type { AppEnv } from "../config/env.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { AuthenticatedUser } from "./auth.decorators.js";

const DUMMY_PASSWORD_HASH = hashPassword("pulseos-constant-time-dummy-secret");

export function mapPrismaUserToAuthUser(row: {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  title: string;
  avatarColor: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}): AuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    title: row.title,
    avatarColor: row.avatarColor,
    isActive: row.isActive,
    permissions: getPermissionsForRole(row.role),
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppEnv, true>
  ) {}

  getSessionTtlSeconds(): number {
    return this.config.get("SESSION_TTL_SECONDS", { infer: true });
  }

  private getJwtSecret(): string {
    return this.config.get("JWT_SECRET", { infer: true });
  }

  async login(
    dto: LoginDto,
    meta: { userAgent?: string; ipAddress?: string } = {}
  ): Promise<AuthSessionResponse> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const user = await this.prisma.db.orm.public.User.where({
      email: normalizedEmail,
    }).first();

    if (!user) {
      verifyPassword(dto.password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException("Invalid email or password.");
    }

    const passwordValid = verifyPassword(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    if (!user.isActive) {
      throw new ForbiddenException(
        "Your account is currently inactive and awaiting approval by a workspace administrator."
      );
    }

    return this.issueSessionForUser(user, "auth.login", meta);
  }

  async register(
    dto: RegisterDto,
    meta: { userAgent?: string; ipAddress?: string } = {}
  ): Promise<AuthRegisterResponse> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const existing = await this.prisma.db.orm.public.User.select("id")
      .where({ email: normalizedEmail })
      .first();

    if (existing) {
      throw new ConflictException(
        "An account with this email address already exists."
      );
    }

    const role: UserRole = "analyst";
    const avatarColor =
      SOLID_AVATAR_COLORS[
        Math.floor(Math.random() * SOLID_AVATAR_COLORS.length)
      ];
    const userId = `usr-${Date.now()}-${randomUUID().slice(0, 8)}`;

    const createdUser = await this.prisma.db.orm.public.User.create({
      id: userId,
      email: normalizedEmail,
      name: dto.name.trim(),
      passwordHash: hashPassword(dto.password),
      role,
      title: dto.title?.trim() || USER_ROLE_META[role].label,
      avatarColor,
      isActive: false,
      lastLoginAt: null,
    });

    await this.recordAuditLog({
      actorId: createdUser.id,
      actorEmail: createdUser.email,
      actorRole: createdUser.role,
      action: "auth.register_pending",
      resource: "user",
      resourceId: createdUser.id,
      details: {
        isActive: false,
        status: "pending_admin_activation",
        role: createdUser.role,
      },
      ipAddress: meta.ipAddress,
    });

    return {
      user: mapPrismaUserToAuthUser(createdUser),
      requiresActivation: true,
      message:
        "Account registered as inactive. A workspace administrator must activate your account before you can sign in.",
    };
  }

  async verifySessionToken(token: string): Promise<AuthenticatedUser | null> {
    const payload = verifyJwt(token, this.getJwtSecret());
    if (!payload) {
      return null;
    }

    const tokenHash = hashSessionToken(token);
    const session = await this.prisma.db.orm.public.AuthSession.where({
      id: payload.sid,
      tokenHash,
    }).first();

    if (!session || session.revokedAt !== null) {
      return null;
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    const user = await this.prisma.db.orm.public.User.where({
      id: session.userId,
    }).first();

    if (!user || !user.isActive) {
      return null;
    }

    return {
      ...mapPrismaUserToAuthUser(user),
      sessionId: session.id,
    };
  }

  async logout(
    user: AuthenticatedUser,
    meta: { ipAddress?: string } = {}
  ): Promise<{ loggedOut: true }> {
    await this.prisma.db.orm.public.AuthSession.where({
      id: user.sessionId,
    }).update({
      revokedAt: new Date(),
    });

    await this.recordAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: "auth.logout",
      resource: "session",
      resourceId: user.sessionId,
      ipAddress: meta.ipAddress,
    });

    return { loggedOut: true };
  }

  async recordAuditLog(params: {
    actorId?: string | null;
    actorEmail: string;
    actorRole: UserRole;
    action: string;
    resource: string;
    resourceId?: string | null;
    details?: Record<string, string | number | boolean | null> | null;
    ipAddress?: string | null;
  }): Promise<void> {
    try {
      await this.prisma.db.orm.public.AuditLog.create({
        id: `aud-${Date.now()}-${randomUUID().slice(0, 8)}`,
        actorId: params.actorId ?? null,
        actorEmail: params.actorEmail,
        actorRole: params.actorRole,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId ?? null,
        details: params.details ?? null,
        ipAddress: params.ipAddress ?? null,
      });
    } catch {
      // Avoid failing domain mutations if audit log write fails
    }
  }

  private async issueSessionForUser(
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      title: string;
      avatarColor: string;
      isActive: boolean;
      lastLoginAt: Date | null;
      createdAt: Date;
    },
    auditAction: "auth.login" | "auth.register",
    meta: { userAgent?: string; ipAddress?: string }
  ): Promise<AuthSessionResponse> {
    const sessionId = `ses-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const ttlSeconds = this.getSessionTtlSeconds();
    const { token, expiresAt } = signJwt(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        sid: sessionId,
      },
      this.getJwtSecret(),
      ttlSeconds
    );

    const now = new Date();

    await this.prisma.db.transaction(async (tx) => {
      await tx.orm.public.AuthSession.create({
        id: sessionId,
        userId: user.id,
        tokenHash: hashSessionToken(token),
        userAgent: meta.userAgent ?? null,
        ipAddress: meta.ipAddress ?? null,
        expiresAt,
      });

      await tx.orm.public.User.where({ id: user.id }).update({
        lastLoginAt: now,
      });
    });

    await this.recordAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: auditAction,
      resource: "session",
      resourceId: sessionId,
      ipAddress: meta.ipAddress,
    });

    return {
      user: mapPrismaUserToAuthUser({
        ...user,
        lastLoginAt: now,
      }),
      accessToken: token,
      expiresAt: expiresAt.toISOString(),
    };
  }
}
