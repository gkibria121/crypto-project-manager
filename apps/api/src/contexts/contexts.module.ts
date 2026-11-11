import { Module } from "@nestjs/common";
import { ContextsController } from "./contexts.controller";
import { ContextsService } from "./contexts.service";

@Module({
  controllers: [ContextsController],
  providers: [ContextsService],
})
export class ContextsModule {}
