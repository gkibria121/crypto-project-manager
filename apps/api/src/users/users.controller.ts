import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  createUserDtoSchema,
  updateUserRoleDtoSchema,
  updateUserStatusDtoSchema,
  type CreateUserDto,
  type UpdateUserRoleDto,
  type UpdateUserStatusDto,
} from "@repo/shared";
import type { Request } from "express";
import {
  CurrentUser,
  RequirePermissions,
  type AuthenticatedUser,
} from "../auth/auth.decorators.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { UsersService } from "./users.service.js";

@ApiTags("users & rbac")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions("users:read")
  @ApiOperation({
    summary: "List workspace members with their assigned RBAC roles & permissions",
  })
  listUsers() {
    return this.usersService.listUsers();
  }

  @Get("audit-logs")
  @RequirePermissions("users:read")
  @ApiOperation({
    summary: "List recent authentication and RBAC authorization audit logs",
  })
  listAuditLogs() {
    return this.usersService.listAuditLogs();
  }

  @Post()
  @RequirePermissions("users:write")
  @ApiOperation({
    summary: "Provision a new workspace user with an explicit RBAC role (Admin only)",
  })
  createUser(
    @CurrentUser() actor: AuthenticatedUser,
    @Body(new ZodValidationPipe(createUserDtoSchema)) body: CreateUserDto,
    @Req() request: Request
  ) {
    return this.usersService.createUser(actor, body, request.ip);
  }

  @Patch(":userId/role")
  @RequirePermissions("users:write")
  @ApiOperation({
    summary: "Update a user's RBAC role (Admin only)",
  })
  updateUserRole(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("userId") userId: string,
    @Body(new ZodValidationPipe(updateUserRoleDtoSchema))
    body: UpdateUserRoleDto,
    @Req() request: Request
  ) {
    return this.usersService.updateUserRole(actor, userId, body, request.ip);
  }

  @Patch(":userId/status")
  @RequirePermissions("users:write")
  @ApiOperation({
    summary: "Activate or deactivate a user account and revoke sessions (Admin only)",
  })
  updateUserStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("userId") userId: string,
    @Body(new ZodValidationPipe(updateUserStatusDtoSchema))
    body: UpdateUserStatusDto,
    @Req() request: Request
  ) {
    return this.usersService.updateUserStatus(actor, userId, body, request.ip);
  }

  @Patch(":userId/activate")
  @RequirePermissions("users:write")
  @ApiOperation({
    summary: "Activate a newly registered or deactivated user account (Admin only)",
  })
  activateUser(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("userId") userId: string,
    @Req() request: Request
  ) {
    return this.usersService.updateUserStatus(
      actor,
      userId,
      { isActive: true },
      request.ip
    );
  }

  @Delete(":userId")
  @RequirePermissions("users:write")
  @ApiOperation({
    summary: "Delete a workspace user account (Admin only)",
  })
  deleteUser(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("userId") userId: string,
    @Req() request: Request
  ) {
    return this.usersService.deleteUser(actor, userId, request.ip);
  }
}
