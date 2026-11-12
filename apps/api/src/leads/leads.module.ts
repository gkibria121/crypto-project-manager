import { Module } from "@nestjs/common";
import { ScraperModule } from "../scraper/scraper.module.js";
import { LeadsController } from "./leads.controller.js";
import { LeadsService } from "./leads.service.js";

@Module({
  imports: [ScraperModule],
  controllers: [LeadsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
