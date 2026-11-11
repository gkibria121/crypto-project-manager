import { Module } from "@nestjs/common";
import { ScraperModule } from "../scraper/scraper.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [ScraperModule],
  controllers: [HealthController],
})
export class HealthModule {}
