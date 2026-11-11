import { Module } from "@nestjs/common";
import { ContextsController } from "./contexts.controller.js";
import { ContextsService } from "./contexts.service.js";

@Module({
  controllers: [ContextsController],
  providers: [ContextsService],
})
export class ContextsModule {}
