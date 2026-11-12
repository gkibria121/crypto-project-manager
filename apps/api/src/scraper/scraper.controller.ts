import { Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../auth/auth.decorators.js";
import { ScraperService } from "./scraper.service.js";

@ApiTags("scraper")
@ApiBearerAuth()
@Controller("projects/:projectId")
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @Post("contexts/:contextId/scrape")
  @RequirePermissions("scraper:trigger")
  @ApiOperation({
    summary: "Trigger Python scraper microservice for a single project context",
  })
  scrapeSingleContext(
    @Param("projectId") projectId: string,
    @Param("contextId") contextId: string
  ) {
    return this.scraperService.scrapeContext(projectId, contextId);
  }

  @Post("scrape-all")
  @RequirePermissions("scraper:trigger")
  @ApiOperation({
    summary: "Batch-scrape all contexts for a project via Python scraper",
  })
  scrapeAll(@Param("projectId") projectId: string) {
    return this.scraperService.scrapeAllProjectContexts(projectId);
  }

  @Get("scrape-jobs")
  @RequirePermissions("projects:read")
  @ApiOperation({ summary: "List recent scrape jobs for a project" })
  listScrapeJobs(@Param("projectId") projectId: string) {
    return this.scraperService.listJobsForProject(projectId);
  }
}
