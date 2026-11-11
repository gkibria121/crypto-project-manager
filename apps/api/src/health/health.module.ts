import { Module } from "@nestjs/common";
import { ScraperModule } from "../scraper/scraper.module.js";
import { HealthController } from "./health.controller.js";

@Module({
  imports: [ScraperModule],
  controllers: [HealthController],
})
export class HealthModule {}
