import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  specializedScraperProviderSchema,
  triggerScrapeDtoSchema,
  updateScraperProviderKeyDtoSchema,
  type TriggerScrapeDto,
  type UpdateScraperProviderKeyDto,
} from "@repo/shared";
import {
  CurrentUser,
  RequirePermissions,
  type AuthenticatedUser,
} from "../auth/auth.decorators.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { ScraperService } from "./scraper.service.js";

@ApiTags("scraper")
@ApiBearerAuth()
@Controller("projects/:projectId")
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @Post("contexts/:contextId/scrape")
  @RequirePermissions("scraper:trigger")
  @ApiOperation({
    summary:
      "Trigger Python scraper microservice for a single project context with configurable levels & options",
  })
  scrapeSingleContext(
    @Param("projectId") projectId: string,
    @Param("contextId") contextId: string,
    @Body(new ZodValidationPipe(triggerScrapeDtoSchema))
    body?: TriggerScrapeDto
  ) {
    return this.scraperService.scrapeContext(projectId, contextId, body);
  }

  @Post("scrape-all")
  @RequirePermissions("scraper:trigger")
  @ApiOperation({
    summary:
      "Batch-scrape all contexts for a project via Python scraper with configurable crawl depth & options",
  })
  scrapeAll(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(triggerScrapeDtoSchema))
    body?: TriggerScrapeDto
  ) {
    return this.scraperService.scrapeAllProjectContexts(projectId, body);
  }

  @Get("scrape-jobs")
  @RequirePermissions("projects:read")
  @ApiOperation({ summary: "List recent scrape jobs for a project" })
  listScrapeJobs(@Param("projectId") projectId: string) {
    return this.scraperService.listJobsForProject(projectId);
  }

  @Get("scraped-data")
  @RequirePermissions("projects:read")
  @ApiOperation({
    summary:
      "Fetch relational scraped jobs and multi-level pages for a project (optionally filtered by contextId or jobId)",
  })
  getProjectScrapedData(
    @Param("projectId") projectId: string,
    @Query("contextId") contextId?: string,
    @Query("jobId") jobId?: string
  ) {
    return this.scraperService.getProjectScrapedData(projectId, {
      contextId: contextId?.trim() || undefined,
      jobId: jobId?.trim() || undefined,
    });
  }

  @Get("contexts/:contextId/scraped-data")
  @RequirePermissions("projects:read")
  @ApiOperation({
    summary: "Fetch relational scraped jobs and pages for a specific context link",
  })
  getContextScrapedData(
    @Param("projectId") projectId: string,
    @Param("contextId") contextId: string
  ) {
    return this.scraperService.getProjectScrapedData(projectId, { contextId });
  }
}

@ApiTags("scraper")
@ApiBearerAuth()
@Controller("scraper/providers")
export class ScraperProvidersController {
  constructor(private readonly scraperService: ScraperService) {}

  @Get()
  @RequirePermissions("projects:read")
  @ApiOperation({
    summary:
      "List specialized platform scraper API key statuses (X, LinkedIn, Telegram)",
  })
  listProviderStatuses() {
    return this.scraperService.listProviderStatuses();
  }

  @Put(":provider")
  @RequirePermissions("settings:write")
  @ApiOperation({
    summary:
      "Save or update an encrypted specialized scraper API key/token for X, LinkedIn, or Telegram",
  })
  saveProviderKey(
    @Param("provider") providerParam: string,
    @Body(new ZodValidationPipe(updateScraperProviderKeyDtoSchema))
    body: UpdateScraperProviderKeyDto,
    @CurrentUser() user: AuthenticatedUser | undefined
  ) {
    const parsed = specializedScraperProviderSchema.safeParse(providerParam);
    if (!parsed.success) {
      throw new BadRequestException(
        `Unsupported scraper provider "${providerParam}". Expected: x, linkedin, telegram.`
      );
    }
    return this.scraperService.saveProviderKey(parsed.data, body.apiKey, user);
  }

  @Delete(":provider")
  @RequirePermissions("settings:write")
  @ApiOperation({
    summary:
      "Remove workspace override API key for a specialized scraper provider",
  })
  deleteProviderKey(
    @Param("provider") providerParam: string,
    @CurrentUser() user: AuthenticatedUser | undefined
  ) {
    const parsed = specializedScraperProviderSchema.safeParse(providerParam);
    if (!parsed.success) {
      throw new BadRequestException(
        `Unsupported scraper provider "${providerParam}". Expected: x, linkedin, telegram.`
      );
    }
    return this.scraperService.deleteProviderKey(parsed.data, user);
  }
}
