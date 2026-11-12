import {
  SetMetadata,
  createParamDecorator,
  type ExecutionContext,
} from "@nestjs/common";
import type { AuthUser, Permission, UserRole } from "@repo/shared";
import type { Request } from "express";

export const IS_PUBLIC_KEY = "isPublic";
export const ROLES_KEY = "rbacRoles";
export const PERMISSIONS_KEY = "rbacPermissions";

export interface AuthenticatedUser extends AuthUser {
  sessionId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Marks a route handler or controller as publicly accessible without authentication.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Restricts route access to users possessing at least one of the specified RBAC roles.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Restricts route access to users possessing ALL of the specified fine-grained RBAC permissions.
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Extracts the authenticated user attached by AuthGuard from the request object.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  }
);
