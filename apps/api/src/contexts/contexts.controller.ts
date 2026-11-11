import { Body, Controller, Delete, Param, Patch, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  addContextFormSchema,
  toggleAllContextsDtoSchema,
  type AddContextFormValues,
  type ToggleAllContextsDto,
} from "@repo/shared";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ContextsService } from "./contexts.service";

@ApiTags("contexts")
@Controller("projects/:projectId/contexts")
export class ContextsController {
  constructor(private readonly contextsService: ContextsService) {}

  @Post()
  @ApiOperation({ summary: "Add a context source to a project" })
  addContext(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(addContextFormSchema))
    body: AddContextFormValues
  ) {
    return this.contextsService.addContext(projectId, body);
  }

  @Patch("toggle-all")
  @ApiOperation({ summary: "Enable or mute all contexts for a project" })
  toggleAll(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(toggleAllContextsDtoSchema))
    body: ToggleAllContextsDto
  ) {
    return this.contextsService.toggleAllContexts(projectId, body.enable);
  }

  @Patch(":contextId/toggle")
  @ApiOperation({ summary: "Toggle a single project context active state" })
  toggleSingle(
    @Param("projectId") projectId: string,
    @Param("contextId") contextId: string
  ) {
    return this.contextsService.toggleContext(projectId, contextId);
  }

  @Delete(":contextId")
  @ApiOperation({ summary: "Delete a project context item" })
  deleteContext(
    @Param("projectId") projectId: string,
    @Param("contextId") contextId: string
  ) {
    return this.contextsService.deleteContext(projectId, contextId);
  }
}
