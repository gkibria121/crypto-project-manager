import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { sendMessageDtoSchema, type SendMessageDto } from "@repo/shared";
import { RequirePermissions } from "../auth/auth.decorators.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { McpService } from "../mcp/mcp.service.js";
import { ChatService } from "./chat.service.js";

@ApiTags("chat")
@ApiBearerAuth()
@Controller("projects/:projectId/chat")
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly mcpService: McpService
  ) {}

  @Get("mentions")
  @RequirePermissions("projects:read")
  @ApiOperation({
    summary:
      "List dynamic @mention tags (@context, @linkedin, @website, @x, etc.) available from the backend for this project",
  })
  listMentions(@Param("projectId") projectId: string) {
    return this.mcpService.getChatMentionSuggestions(projectId);
  }

  @Post("messages")
  @RequirePermissions("chat:write")
  @ApiOperation({ summary: "Send a user prompt and generate AI campaign output" })
  sendMessage(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(sendMessageDtoSchema))
    body: SendMessageDto
  ) {
    return this.chatService.sendMessage(projectId, body);
  }

  @Post("reset")
  @RequirePermissions("chat:write")
  @ApiOperation({ summary: "Reset project conversation history" })
  resetConversation(@Param("projectId") projectId: string) {
    return this.chatService.resetConversation(projectId);
  }
}
