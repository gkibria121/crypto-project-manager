import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  fetchLeadsDtoSchema,
  leadProviderSchema,
  updateLeadProviderKeyDtoSchema,
  type FetchLeadsDto,
  type UpdateLeadProviderKeyDto,
} from "@repo/shared";
import {
  CurrentUser,
  RequirePermissions,
  type AuthenticatedUser,
} from "../auth/auth.decorators.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { LeadsService } from "./leads.service.js";

@ApiTags("leads")
@ApiBearerAuth()
@Controller()
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get("leads/providers")
  @RequirePermissions("projects:read")
  @ApiOperation({
    summary:
      "List supported lead enrichment providers (Apollo, Hunter, Snov, Lusha, Web Scraper) and API key statuses",
  })
  listProviders() {
    return this.leadsService.listProviderStatuses();
  }

  @Put("leads/providers/:provider")
  @RequirePermissions("settings:write")
  @ApiOperation({
    summary: "Save or update an encrypted API key for a lead enrichment provider",
  })
  saveProviderKey(
    @Param("provider") providerParam: string,
    @Body(new ZodValidationPipe(updateLeadProviderKeyDtoSchema))
    body: UpdateLeadProviderKeyDto,
    @CurrentUser() user: AuthenticatedUser | undefined
  ) {
    const parsed = leadProviderSchema.safeParse(providerParam);
    if (!parsed.success) {
      throw new BadRequestException(
        `Unsupported lead provider "${providerParam}".`
      );
    }
    return this.leadsService.saveProviderKey(parsed.data, body.apiKey, user);
  }

  @Delete("leads/providers/:provider")
  @RequirePermissions("settings:write")
  @ApiOperation({
    summary: "Remove workspace API key for a lead enrichment provider",
  })
  deleteProviderKey(
    @Param("provider") providerParam: string,
    @CurrentUser() user: AuthenticatedUser | undefined
  ) {
    const parsed = leadProviderSchema.safeParse(providerParam);
    if (!parsed.success) {
      throw new BadRequestException(
        `Unsupported lead provider "${providerParam}".`
      );
    }
    return this.leadsService.deleteProviderKey(parsed.data, user);
  }

  @Post("projects/:projectId/leads/fetch")
  @RequirePermissions("contexts:write")
  @ApiOperation({
    summary:
      "Gather contacts/leads from a selected provider and store them in the project's right-side context panel",
  })
  fetchProjectLeads(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(fetchLeadsDtoSchema))
    body: FetchLeadsDto
  ) {
    return this.leadsService.fetchLeadsForProject(projectId, body);
  }
}
