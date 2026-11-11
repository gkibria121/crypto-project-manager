import { Module } from "@nestjs/common";
import { ScraperController } from "./scraper.controller.js";
import { ScraperService } from "./scraper.service.js";

@Module({
  controllers: [ScraperController],
  providers: [ScraperService],
  exports: [ScraperService],
})
export class ScraperModule {}
