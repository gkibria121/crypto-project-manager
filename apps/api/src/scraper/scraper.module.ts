import { Module } from "@nestjs/common";
import {
  ScraperController,
  ScraperProvidersController,
} from "./scraper.controller.js";
import { ScraperService } from "./scraper.service.js";

@Module({
  controllers: [ScraperController, ScraperProvidersController],
  providers: [ScraperService],
  exports: [ScraperService],
})
export class ScraperModule {}
