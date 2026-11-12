import {
  All,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  callMcpToolDtoSchema,
  createMcpServerDtoSchema,
  updateMcpServerDtoSchema,
  type CallMcpToolDto,
  type CreateMcpServerDto,
  type UpdateMcpServerDto,
} from "@repo/shared";
import type { Request, Response } from "express";
import {
  CurrentUser,
  RequirePermissions,
  type AuthenticatedUser,
} from "../auth/auth.decorators.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { McpService } from "./mcp.service.js";

@ApiTags("mcp")
@ApiBearerAuth()
@Controller("mcp")
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @All()
  @RequirePermissions("chat:write")
  @ApiOperation({
    summary:
      "Streamable HTTP Model Context Protocol (MCP) server endpoint (JSON-RPC 2.0)",
  })
  async handleMcpTransport(@Req() req: Request, @Res() res: Response) {
    await this.mcpService.handleStreamableHttpRequest(req, res, req.body);
  }

  @Get("servers")
  @RequirePermissions("projects:read")
  @ApiOperation({
    summary:
      "List built-in and external MCP servers along with their discovered tools",
  })
  listServers() {
    return this.mcpService.listServers();
  }

  @Get("tools")
  @RequirePermissions("projects:read")
  @ApiOperation({ summary: "List all active MCP tools known by the system" })
  listTools() {
    return this.mcpService.getAvailableTools();
  }

  @Post("servers")
  @RequirePermissions("settings:write")
  @ApiOperation({ summary: "Register an external MCP server and discover its tools" })
  createServer(
    @Body(new ZodValidationPipe(createMcpServerDtoSchema))
    body: CreateMcpServerDto,
    @CurrentUser() user: AuthenticatedUser | undefined
  ) {
    return this.mcpService.createExternalServer(body, user);
  }

  @Patch("servers/:serverId")
  @RequirePermissions("settings:write")
  @ApiOperation({ summary: "Update or toggle an external MCP server" })
  updateServer(
    @Param("serverId") serverId: string,
    @Body(new ZodValidationPipe(updateMcpServerDtoSchema))
    body: UpdateMcpServerDto,
    @CurrentUser() user: AuthenticatedUser | undefined
  ) {
    return this.mcpService.updateExternalServer(serverId, body, user);
  }

  @Post("servers/:serverId/refresh")
  @RequirePermissions("settings:write")
  @ApiOperation({ summary: "Reconnect to an MCP server and refresh its tool list" })
  refreshServer(@Param("serverId") serverId: string) {
    return this.mcpService.refreshServer(serverId);
  }

  @Delete("servers/:serverId")
  @RequirePermissions("settings:write")
  @ApiOperation({ summary: "Remove an external MCP server" })
  deleteServer(
    @Param("serverId") serverId: string,
    @CurrentUser() user: AuthenticatedUser | undefined
  ) {
    return this.mcpService.deleteExternalServer(serverId, user);
  }

  @Post("tools/call")
  @RequirePermissions("chat:write")
  @ApiOperation({ summary: "Invoke a registered MCP tool directly" })
  callTool(
    @Body(new ZodValidationPipe(callMcpToolDtoSchema))
    body: CallMcpToolDto
  ) {
    return this.mcpService.invokeToolDirect(body);
  }
}
