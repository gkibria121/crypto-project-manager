import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { extractSessionToken } from "./auth.cookie.js";
import {
  IS_PUBLIC_KEY,
  type AuthenticatedRequest,
} from "./auth.decorators.js";
import { AuthService } from "./auth.service.js";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractSessionToken(request);

    if (isPublic) {
      if (token) {
        try {
          const user = await this.authService.verifySessionToken(token);
          if (user) {
            request.user = user;
          }
        } catch {
          // Public endpoints remain accessible even if an expired cookie is sent
        }
      }
      return true;
    }

    if (!token) {
      throw new UnauthorizedException(
        "Authentication required. Please sign in to access this resource."
      );
    }

    const user = await this.authService.verifySessionToken(token);
    if (!user) {
      throw new UnauthorizedException(
        "Your session has expired or is invalid. Please sign in again."
      );
    }

    request.user = user;
    return true;
  }
}
