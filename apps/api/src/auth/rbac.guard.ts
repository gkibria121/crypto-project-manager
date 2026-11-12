import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  hasAnyRole,
  hasPermission,
  type Permission,
  type UserRole,
} from "@repo/shared";
import {
  IS_PUBLIC_KEY,
  PERMISSIONS_KEY,
  ROLES_KEY,
  type AuthenticatedRequest,
} from "./auth.decorators.js";

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()]
    );

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (
      (!requiredRoles || requiredRoles.length === 0) &&
      (!requiredPermissions || requiredPermissions.length === 0)
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException(
        "Authentication required before evaluating RBAC permissions."
      );
    }

    if (requiredRoles && requiredRoles.length > 0) {
      if (!hasAnyRole(user, requiredRoles)) {
        throw new ForbiddenException(
          `Access denied: role "${user.role}" is not authorized. Required role(s): ${requiredRoles.join(", ")}.`
        );
      }
    }

    if (requiredPermissions && requiredPermissions.length > 0) {
      const missingPermissions = requiredPermissions.filter(
        (perm) => !hasPermission(user, perm)
      );
      if (missingPermissions.length > 0) {
        throw new ForbiddenException(
          `Access denied: role "${user.role}" lacks required permission(s): ${missingPermissions.join(", ")}.`
        );
      }
    }

    return true;
  }
}
