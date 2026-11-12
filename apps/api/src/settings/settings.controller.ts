import { Body, Controller, Delete, Get, Param, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  checklistItemConfigSchema,
  promptTemplateSchema,
  type ChecklistItemConfig,
  type PromptTemplate,
} from "@repo/shared";
import { RequirePermissions } from "../auth/auth.decorators.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { SettingsService } from "./settings.service.js";

@ApiTags("settings")
@ApiBearerAuth()
@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get("prompt-templates")
  @RequirePermissions("settings:read")
  @ApiOperation({ summary: "List global system prompt templates" })
  listPromptTemplates() {
    return this.settingsService.listPromptTemplates();
  }

  @Put("prompt-templates")
  @RequirePermissions("settings:write")
  @ApiOperation({ summary: "Create or update a global prompt template" })
  savePromptTemplate(
    @Body(new ZodValidationPipe(promptTemplateSchema))
    body: PromptTemplate
  ) {
    return this.settingsService.savePromptTemplate(body);
  }

  @Delete("prompt-templates/:id")
  @RequirePermissions("settings:write")
  @ApiOperation({ summary: "Delete a global prompt template" })
  deletePromptTemplate(@Param("id") id: string) {
    return this.settingsService.deletePromptTemplate(id);
  }

  @Get("checklist-items")
  @RequirePermissions("settings:read")
  @ApiOperation({ summary: "List global feature checklist items" })
  listChecklistItems() {
    return this.settingsService.listChecklistItems();
  }

  @Put("checklist-items")
  @RequirePermissions("settings:write")
  @ApiOperation({ summary: "Create or update a global checklist item" })
  saveChecklistItem(
    @Body(new ZodValidationPipe(checklistItemConfigSchema))
    body: ChecklistItemConfig
  ) {
    return this.settingsService.saveChecklistItem(body);
  }

  @Delete("checklist-items/:id")
  @RequirePermissions("settings:write")
  @ApiOperation({ summary: "Delete a global checklist item" })
  deleteChecklistItem(@Param("id") id: string) {
    return this.settingsService.deleteChecklistItem(id);
  }
}
