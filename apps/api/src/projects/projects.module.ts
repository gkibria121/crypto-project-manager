import { Module } from "@nestjs/common";
import { ProjectSyncService } from "./project-sync.service.js";
import { ProjectsController } from "./projects.controller.js";
import { ProjectsService } from "./projects.service.js";

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectSyncService],
  exports: [ProjectsService, ProjectSyncService],
})
export class ProjectsModule {}
