import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings/settings.module.js";
import { ChatController } from "./chat.controller.js";
import { ChatService } from "./chat.service.js";

@Module({
  imports: [SettingsModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
