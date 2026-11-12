import { Module } from "@nestjs/common";
import { McpModule } from "../mcp/mcp.module.js";
import { SettingsModule } from "../settings/settings.module.js";
import { ChatController } from "./chat.controller.js";
import { ChatService } from "./chat.service.js";

@Module({
  imports: [SettingsModule, McpModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
