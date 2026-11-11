import { Body, Controller, Param, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { sendMessageDtoSchema, type SendMessageDto } from "@repo/shared";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ChatService } from "./chat.service";

@ApiTags("chat")
@Controller("projects/:projectId/chat")
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post("messages")
  @ApiOperation({ summary: "Send a user prompt and generate AI campaign output" })
  sendMessage(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(sendMessageDtoSchema))
    body: SendMessageDto
  ) {
    return this.chatService.sendMessage(projectId, body);
  }

  @Post("reset")
  @ApiOperation({ summary: "Reset project conversation history" })
  resetConversation(@Param("projectId") projectId: string) {
    return this.chatService.resetConversation(projectId);
  }
}
