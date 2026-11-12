import { Module } from "@nestjs/common";
import { ScraperModule } from "../scraper/scraper.module.js";
import { McpController } from "./mcp.controller.js";
import { McpService } from "./mcp.service.js";

@Module({
  imports: [ScraperModule],
  controllers: [McpController],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
