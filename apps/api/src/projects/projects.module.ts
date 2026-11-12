import { Module } from "@nestjs/common";
import { ProjectSyncWsService } from "./project-sync-ws.service.js";
import { ProjectSyncService } from "./project-sync.service.js";
import { ProjectsController } from "./projects.controller.js";
import { ProjectsService } from "./projects.service.js";

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectSyncService, ProjectSyncWsService],
  exports: [ProjectsService, ProjectSyncService, ProjectSyncWsService],
})
export class ProjectsModule {}
