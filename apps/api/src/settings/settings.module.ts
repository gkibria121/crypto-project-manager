import { Module } from "@nestjs/common";
import { AiProvidersService } from "./ai-providers.service.js";
import { SettingsController } from "./settings.controller.js";
import { SettingsService } from "./settings.service.js";

@Module({
  controllers: [SettingsController],
  providers: [SettingsService, AiProvidersService],
  exports: [AiProvidersService],
})
export class SettingsModule {}
