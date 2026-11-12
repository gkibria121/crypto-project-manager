import { Module } from "@nestjs/common";
import { LeadsModule } from "../leads/leads.module.js";
import { ScraperModule } from "../scraper/scraper.module.js";
import { McpController } from "./mcp.controller.js";
import { McpService } from "./mcp.service.js";

@Module({
  imports: [ScraperModule, LeadsModule],
  controllers: [McpController],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
