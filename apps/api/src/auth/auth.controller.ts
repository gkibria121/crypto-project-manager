import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  loginDtoSchema,
  registerDtoSchema,
  type AuthUser,
  type LoginDto,
  type RegisterDto,
} from "@repo/shared";
import type { Request, Response } from "express";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { clearSessionCookie, setSessionCookie } from "./auth.cookie.js";
import {
  CurrentUser,
  Public,
  type AuthenticatedUser,
} from "./auth.decorators.js";
import { AuthService } from "./auth.service.js";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Sign in with email & password and issue an RBAC session",
  })
  async login(
    @Body(new ZodValidationPipe(loginDtoSchema)) body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.authService.login(body, {
      userAgent: request.headers["user-agent"],
      ipAddress: request.ip,
    });
    setSessionCookie(
      request,
      response,
      result.accessToken,
      this.authService.getSessionTtlSeconds()
    );
    return result;
  }

  @Public()
  @Post("register")
  @ApiOperation({
    summary:
      "Register a new team account (created as inactive until activated by an administrator)",
  })
  async register(
    @Body(new ZodValidationPipe(registerDtoSchema)) body: RegisterDto,
    @Req() request: Request
  ) {
    return this.authService.register(body, {
      userAgent: request.headers["user-agent"],
      ipAddress: request.ip,
    });
  }

  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Return the currently authenticated user profile and RBAC permissions",
  })
  me(@CurrentUser() user: AuthenticatedUser | undefined): AuthUser {
    if (!user) {
      throw new UnauthorizedException("Not authenticated.");
    }
    const { sessionId: _sessionId, ...profile } = user;
    return profile;
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Revoke the current session and clear cookies & site data",
  })
  async logout(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    clearSessionCookie(request, response);
    if (user) {
      await this.authService.logout(user, { ipAddress: request.ip });
    }
    return { loggedOut: true as const };
  }
}
