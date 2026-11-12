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
  bulkDeleteProjectsDtoSchema,
  bulkUpdateBusinessStatusDtoSchema,
  newProjectFormSchema,
  syncProjectsDtoSchema,
  updateBusinessStatusDtoSchema,
  updateProjectFormSchema,
  updateProjectLogoDtoSchema,
  type BulkDeleteProjectsDto,
  type BulkUpdateBusinessStatusDto,
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

  @Get("sync/status")
  @RequirePermissions("projects:create")
  @ApiOperation({
    summary:
      "Get current asynchronous background sync job status, progress counters, and recent logs",
  })
  getSyncStatus() {
    return this.projectSyncService.getJobState();
  }

  @Post("sync/start")
  @RequirePermissions("projects:create")
  @ApiOperation({
    summary:
      "Start an asynchronous background crypto project sync job with live WebSocket streaming",
  })
  startAsyncSync(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body(new ZodValidationPipe(syncProjectsDtoSchema))
    body: SyncProjectsDto
  ) {
    return this.projectSyncService.startAsyncSync(body, user);
  }

  @Post("sync/stop")
  @RequirePermissions("projects:create")
  @ApiOperation({
    summary: "Stop the running asynchronous background crypto project sync job",
  })
  stopAsyncSync() {
    return this.projectSyncService.stopAsyncSync();
  }

  @Post("sync/next")
  @RequirePermissions("projects:create")
  @ApiOperation({
    summary:
      "Skip the current inter-page rate-limit wait and trigger the next sync batch immediately",
  })
  triggerNextSyncPage() {
    return this.projectSyncService.triggerNextPageNow();
  }

  @Post("sync/reset")
  @RequirePermissions("projects:create")
  @ApiOperation({
    summary: "Reset the background sync pagination cursor and counters back to Page 1",
  })
  resetSyncCursor() {
    return this.projectSyncService.resetSyncCursor();
  }

  @Post("sync/logs/clear")
  @RequirePermissions("projects:create")
  @ApiOperation({
    summary: "Clear the background sync activity log buffer",
  })
  clearSyncLogs() {
    return this.projectSyncService.clearSyncLogs();
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

  @Patch("bulk/status")
  @RequirePermissions("projects:update")
  @ApiOperation({ summary: "Bulk-update pipeline business status for selected projects" })
  bulkUpdateStatus(
    @Body(new ZodValidationPipe(bulkUpdateBusinessStatusDtoSchema))
    body: BulkUpdateBusinessStatusDto
  ) {
    return this.projectsService.bulkUpdateBusinessStatus(
      body.projectIds,
      body.status
    );
  }

  @Post("bulk/delete")
  @RequirePermissions("projects:delete")
  @ApiOperation({ summary: "Bulk-delete selected crypto project workspaces" })
  bulkDelete(
    @Body(new ZodValidationPipe(bulkDeleteProjectsDtoSchema))
    body: BulkDeleteProjectsDto
  ) {
    return this.projectsService.bulkDelete(body.projectIds);
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
