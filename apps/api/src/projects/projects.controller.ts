import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  newProjectFormSchema,
  syncProjectsDtoSchema,
  updateBusinessStatusDtoSchema,
  updateProjectFormSchema,
  updateProjectLogoDtoSchema,
  type NewProjectFormValues,
  type SyncProjectsDto,
  type UpdateBusinessStatusDto,
  type UpdateProjectFormValues,
  type UpdateProjectLogoDto,
} from "@repo/shared";
import {
  CurrentUser,
  RequirePermissions,
  type AuthenticatedUser,
} from "../auth/auth.decorators.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { ProjectSyncService } from "./project-sync.service.js";
import { ProjectsService } from "./projects.service.js";

@ApiTags("projects")
@ApiBearerAuth()
@Controller("projects")
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly projectSyncService: ProjectSyncService
  ) {}

  @Get()
  @RequirePermissions("projects:read")
  @ApiOperation({ summary: "List all crypto projects with contexts and messages" })
  findAll() {
    return this.projectsService.findAll();
  }

  @Get("sync/providers")
  @RequirePermissions("projects:create")
  @ApiOperation({
    summary:
      "List available third-party crypto market cap sync providers and API key configuration status",
  })
  listSyncProviders() {
    return this.projectSyncService.listProvidersStatus();
  }

  @Post("sync")
  @RequirePermissions("projects:create")
  @ApiOperation({
    summary:
      "Sync crypto projects from a third-party market cap API provider into New status with Website, X, and LinkedIn contexts",
  })
  syncProjects(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body(new ZodValidationPipe(syncProjectsDtoSchema))
    body: SyncProjectsDto
  ) {
    return this.projectSyncService.syncFromProvider(body, user);
  }

  @Get(":projectId")
  @RequirePermissions("projects:read")
  @ApiOperation({ summary: "Get a single crypto project workspace" })
  findOne(@Param("projectId") projectId: string) {
    return this.projectsService.findOne(projectId);
  }

  @Post()
  @RequirePermissions("projects:create")
  @ApiOperation({ summary: "Create a new crypto project workspace" })
  create(
    @Body(new ZodValidationPipe(newProjectFormSchema))
    body: NewProjectFormValues
  ) {
    return this.projectsService.create(body);
  }

  @Patch(":projectId")
  @RequirePermissions("projects:update")
  @ApiOperation({ summary: "Update an existing crypto project info and profile" })
  update(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(updateProjectFormSchema))
    body: UpdateProjectFormValues
  ) {
    return this.projectsService.update(projectId, body);
  }

  @Patch(":projectId/read")
  @RequirePermissions("projects:read")
  @ApiOperation({ summary: "Mark project insights as read" })
  markAsRead(@Param("projectId") projectId: string) {
    return this.projectsService.markAsRead(projectId);
  }

  @Patch(":projectId/status")
  @RequirePermissions("projects:update")
  @ApiOperation({ summary: "Update project business pipeline status" })
  updateStatus(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(updateBusinessStatusDtoSchema))
    body: UpdateBusinessStatusDto
  ) {
    return this.projectsService.updateBusinessStatus(projectId, body.status);
  }

  @Patch(":projectId/logo")
  @RequirePermissions("projects:update")
  @ApiOperation({ summary: "Update project profile avatar/logo URL" })
  updateLogo(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(updateProjectLogoDtoSchema))
    body: UpdateProjectLogoDto
  ) {
    return this.projectsService.updateLogo(projectId, body.logoUrl);
  }

  @Delete(":projectId")
  @RequirePermissions("projects:delete")
  @ApiOperation({ summary: "Delete a crypto project workspace" })
  remove(@Param("projectId") projectId: string) {
    return this.projectsService.delete(projectId);
  }
}
